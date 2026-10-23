import { sha256 } from "ethers";

const TTL_MS = 15 * 60 * 1000;
const TOKEN_PATTERN = /^0x[0-9a-f]{64}$/;

function fail(code) {
  throw new Error(code);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function eligible(storage, membershipId) {
  const rows = storage.sql.exec(`
    SELECT m.id
    FROM founding_memberships m
    JOIN founding_orders o ON o.id = m.order_id
    JOIN nft_mint_jobs j ON j.membership_id = m.id
    WHERE m.id = ?
      AND o.status = 'PAID'
      AND m.status = 'ACTIVATION_PENDING'
      AND j.status = 'AWAITING_WALLET'
  `, membershipId).toArray();

  if (rows.length !== 1) {
    fail("NFT_CLAIM_NOT_ELIGIBLE");
  }
}

/*
 * Internal-only primitive.
 *
 * The caller MUST authenticate the purchaser and obtain
 * membershipId from a trusted authorization context.
 * This function MUST NOT be exposed directly to HTTP.
 */
export function issueNftClaimGrant({
  storage,
  membershipId,
  emailChallengeId,
  now = Date.now(),
}) {
  if (!Number.isSafeInteger(now) || now < 0) {
    fail("INVALID_CLAIM_TIME");
  }

  return storage.transactionSync(() => {
    eligible(storage, membershipId);

    /*
     * NFT_EMAIL_GRANT_AUTHORIZATION_V1
     * Email verification must belong to this membership.
     * Consume it atomically with claim issuance.
     */
    if (
      typeof emailChallengeId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(emailChallengeId)
    ) {
      fail("NFT_VERIFIED_EMAIL_REQUIRED");
    }

    const verifiedEmail = storage.sql.exec(`
      SELECT id, expires_at AS expiresAt
      FROM nft_buyer_email_codes
      WHERE id = ?
        AND membership_id = ?
        AND status = 'VERIFIED'
    `, emailChallengeId, membershipId).toArray()[0];

    if (
      !verifiedEmail ||
      !Number.isFinite(Date.parse(verifiedEmail.expiresAt)) ||
      now >= Date.parse(verifiedEmail.expiresAt)
    ) {
      fail("NFT_VERIFIED_EMAIL_REQUIRED");
    }

    // REVOKED marks the email proof as no longer reusable.
    // No database CHECK constraint migration is needed.
    storage.sql.exec(`
      UPDATE nft_buyer_email_codes
      SET status = 'REVOKED'
      WHERE id = ?
        AND membership_id = ?
        AND status = 'VERIFIED'
    `, emailChallengeId, membershipId);

    const emailConsumed = storage.sql.exec(`
      SELECT status
      FROM nft_buyer_email_codes
      WHERE id = ? AND membership_id = ?
    `, emailChallengeId, membershipId).toArray()[0];

    if (emailConsumed?.status !== 'REVOKED') {
      fail("NFT_EMAIL_PROOF_CONSUMPTION_FAILED");
    }

    storage.sql.exec(`
      UPDATE nft_claim_grants
      SET status = 'REVOKED'
      WHERE membership_id = ?
        AND status = 'ISSUED'
    `, membershipId);

    const token = randomToken();
    const issuedAt = new Date(now).toISOString();
    const expiresAt =
      new Date(now + TTL_MS).toISOString();

    storage.sql.exec(`
      INSERT INTO nft_claim_grants (
        id, membership_id, token_hash, status,
        expires_at, consumed_at, created_at
      )
      VALUES (?, ?, ?, 'ISSUED', ?, NULL, ?)
    `,
      crypto.randomUUID(),
      membershipId,
      sha256(token),
      expiresAt,
      issuedAt,
    );

    return { token, expiresAt };
  });
}

/*
 * Consumes a claim after the caller has also completed
 * its separate wallet-ownership verification.
 *
 * Token consumption alone never changes a mint job.
 */
export function consumeNftClaimGrant({
  storage,
  membershipId,
  token,
  now = Date.now(),
}) {
  if (
    !TOKEN_PATTERN.test(token ?? "") ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    fail("NFT_CLAIM_INVALID");
  }

  return storage.transactionSync(() => {
    eligible(storage, membershipId);

    const row = storage.sql.exec(`
      SELECT id, status, expires_at AS expiresAt
      FROM nft_claim_grants
      WHERE membership_id = ?
        AND token_hash = ?
    `, membershipId, sha256(token)).toArray()[0];

    if (
      !row ||
      row.status !== "ISSUED" ||
      now >= Date.parse(row.expiresAt)
    ) {
      fail("NFT_CLAIM_NOT_VALID");
    }

    const updated = storage.sql.exec(`
      UPDATE nft_claim_grants
      SET status = 'CONSUMED',
          consumed_at = ?
      WHERE id = ? AND status = 'ISSUED'
    `, new Date(now).toISOString(), row.id);

    // Transaction serialization ensures one-time use.
    // Re-read to verify the final state.
    const result = storage.sql.exec(`
      SELECT status, consumed_at AS consumedAt
      FROM nft_claim_grants WHERE id = ?
    `, row.id).toArray()[0];

    if (
      result?.status !== "CONSUMED" ||
      !result.consumedAt
    ) {
      fail("NFT_CLAIM_CONSUMPTION_FAILED");
    }

    return { consumed: true, membershipId };
  });
}
