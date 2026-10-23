import {
  reserveBuyerEmailSend,
} from "./nftEmailRateLimit.mjs";

import {
  issueBuyerEmailCode,
} from "./nftBuyerEmailAuth.mjs";

import {
  sendBuyerVerificationEmail,
} from "./nftEmailDelivery.mjs";

/*
 * INTERNAL ONLY.
 *
 * Authorization of the buyer must happen upstream.
 * Never expose this function directly to public HTTP.
 */
export async function deliverBuyerEmailCode({
  storage,
  membershipId,
  apiKey,
  from,
  now = Date.now(),
  fetcher = fetch,
}) {
  /*
   * Fail before touching storage when email is
   * not configured.
   */
  if (
    typeof apiKey !== "string" ||
    !apiKey.startsWith("re_") ||
    typeof from !== "string" ||
    !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(from)
  ) {
    throw new Error("NFT_EMAIL_NOT_CONFIGURED");
  }

  /*
   * Both existing functions open transactions.
   * This scoped adapter joins an already active
   * transaction instead of opening nested ones.
   */
  const joinedStorage = {
    sql: storage.sql,
    transactionSync: (fn) => fn(),
  };

  const prepared = storage.transactionSync(() => {
    reserveBuyerEmailSend({
      storage: joinedStorage,
      membershipId,
      now,
    });

    const issued = issueBuyerEmailCode({
      storage: joinedStorage,
      membershipId,
      now,
    });

    storage.sql.exec(`
      INSERT INTO nft_email_deliveries (
        challenge_id, membership_id, status,
        provider_message_id, prepared_at,
        accepted_at, failed_at
      )
      VALUES (?, ?, 'PREPARED', NULL, ?, NULL, NULL)
    `,
      issued.challengeId,
      membershipId,
      new Date(now).toISOString(),
    );

    return issued;
  });

  try {
    const result = await sendBuyerVerificationEmail({
      apiKey,
      from,
      to: prepared.email,
      code: prepared.code,
      challengeId: prepared.challengeId,
      fetcher,
    });

    storage.transactionSync(() => {
      storage.sql.exec(`
        UPDATE nft_email_deliveries
        SET status = 'ACCEPTED',
            provider_message_id = ?,
            accepted_at = ?
        WHERE challenge_id = ?
          AND membership_id = ?
          AND status = 'PREPARED'
      `,
        result.providerMessageId,
        new Date().toISOString(),
        prepared.challengeId,
        membershipId,
      );

      const row = storage.sql.exec(`
        SELECT status
        FROM nft_email_deliveries
        WHERE challenge_id = ?
          AND membership_id = ?
      `, prepared.challengeId, membershipId).toArray()[0];

      if (row?.status !== "ACCEPTED") {
        throw new Error("NFT_EMAIL_AUDIT_UPDATE_FAILED");
      }
    });

    return {
      accepted: true,
      challengeId: prepared.challengeId,
      expiresAt: prepared.expiresAt,
      providerMessageId: result.providerMessageId,
    };
  } catch {
    /*
     * A failed or uncertain provider response must
     * not leave the newly issued code usable.
     *
     * The rate reservation is retained.
     */
    storage.transactionSync(() => {
      storage.sql.exec(`
        UPDATE nft_buyer_email_codes
        SET status = 'REVOKED'
        WHERE id = ?
          AND membership_id = ?
          AND status = 'PENDING'
      `, prepared.challengeId, membershipId);

      storage.sql.exec(`
        UPDATE nft_email_deliveries
        SET status = 'FAILED',
            failed_at = ?
        WHERE challenge_id = ?
          AND membership_id = ?
          AND status = 'PREPARED'
      `,
        new Date().toISOString(),
        prepared.challengeId,
        membershipId,
      );
    });

    throw new Error("NFT_EMAIL_DELIVERY_UNAVAILABLE");
  }
}
