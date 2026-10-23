const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_BATCH = 100;

/*
 * INTERNAL MAINTENANCE ONLY.
 *
 * PREPARED means the outcome is uncertain, not
 * necessarily that the provider did not send.
 *
 * Never retry the same challenge automatically.
 * Never change already ACCEPTED deliveries.
 */
export function recoverStaleBuyerEmailDeliveries({
  storage,
  now = Date.now(),
  limit = MAX_BATCH,
}) {
  if (
    !Number.isSafeInteger(now) ||
    now < STALE_AFTER_MS ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_BATCH
  ) {
    throw new Error("NFT_EMAIL_RECOVERY_INVALID_INPUT");
  }

  return storage.transactionSync(() => {
    const cutoff = new Date(
      now - STALE_AFTER_MS,
    ).toISOString();

    const rows = storage.sql.exec(`
      SELECT challenge_id AS challengeId,
             membership_id AS membershipId
      FROM nft_email_deliveries
      WHERE status = 'PREPARED'
        AND prepared_at <= ?
      ORDER BY prepared_at, challenge_id
      LIMIT ?
    `, cutoff, limit).toArray();

    let recovered = 0;

    for (const row of rows) {
      /*
       * Revoke the unknown-outcome challenge.
       * This does not create or send another code.
       */
      storage.sql.exec(`
        UPDATE nft_buyer_email_codes
        SET status = 'REVOKED'
        WHERE id = ?
          AND membership_id = ?
          AND status = 'PENDING'
      `, row.challengeId, row.membershipId);

      storage.sql.exec(`
        UPDATE nft_email_deliveries
        SET status = 'FAILED',
            failed_at = ?
        WHERE challenge_id = ?
          AND membership_id = ?
          AND status = 'PREPARED'
      `,
        new Date(now).toISOString(),
        row.challengeId,
        row.membershipId,
      );

      const result = storage.sql.exec(`
        SELECT status
        FROM nft_email_deliveries
        WHERE challenge_id = ?
          AND membership_id = ?
      `, row.challengeId, row.membershipId)
        .toArray()[0];

      if (result?.status !== "FAILED") {
        throw new Error(
          "NFT_EMAIL_RECOVERY_TRANSACTION_FAILED",
        );
      }

      recovered++;
    }

    return {
      recovered,
      batchLimit: limit,
      cutoff,
      emailsResent: 0,
    };
  });
}
