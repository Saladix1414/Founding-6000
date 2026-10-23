import { sha256, toUtf8Bytes } from "ethers";

const TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function fail(code) {
  throw new Error(code);
}

function one(storage, query, ...args) {
  return storage.sql.exec(query, ...args).toArray()[0];
}

function eligible(storage, membershipId) {
  const row = one(storage, `
    SELECT o.normalized_email AS email
    FROM founding_memberships m
    JOIN founding_orders o ON o.id = m.order_id
    JOIN nft_mint_jobs j ON j.membership_id = m.id
    WHERE m.id = ?
      AND o.status = 'PAID'
      AND m.status = 'ACTIVATION_PENDING'
      AND j.status = 'AWAITING_WALLET'
  `, membershipId);

  if (!row) fail("BUYER_AUTH_NOT_ELIGIBLE");
  return row;
}

function hashCode(membershipId, code, salt) {
  return sha256(toUtf8Bytes(
    `OriginX-email-v1:${membershipId}:${salt}:${code}`
  ));
}

/*
 * INTERNAL ONLY.
 * The caller must deliver the code to the order email.
 * Never return this code through a public endpoint.
 */
export function issueBuyerEmailCode({
  storage,
  membershipId,
  now = Date.now(),
}) {
  if (!Number.isSafeInteger(now) || now < 0) {
    fail("BUYER_AUTH_INVALID_TIME");
  }

  return storage.transactionSync(() => {
    const buyer = eligible(storage, membershipId);

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    const code = Array.from(bytes, b =>
      b.toString(16).padStart(2, "0")
    ).join("");

    const id = crypto.randomUUID();
    const expiresAt = new Date(now + TTL_MS).toISOString();

    storage.sql.exec(`
      UPDATE nft_buyer_email_codes
      SET status = 'REVOKED'
      WHERE membership_id = ? AND status = 'PENDING'
    `, membershipId);

    storage.sql.exec(`
      INSERT INTO nft_buyer_email_codes (
        id, membership_id, code_hash, status,
        attempts, expires_at, created_at, verified_at
      ) VALUES (?, ?, ?, 'PENDING', 0, ?, ?, NULL)
    `,
      id,
      membershipId,
      hashCode(membershipId, code, id),
      expiresAt,
      new Date(now).toISOString(),
    );

    return {
      email: buyer.email,
      code,
      challengeId: id,
      expiresAt,
    };
  });
}

/*
 * Verification consumes the email challenge.
 * It does NOT issue NFT claims or authorize minting.
 */
export function verifyBuyerEmailCode({
  storage,
  membershipId,
  challengeId,
  code,
  now = Date.now(),
}) {
  if (
    typeof challengeId !== "string" ||
    typeof code !== "string" ||
    !/^[0-9a-f]{32}$/.test(code) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    fail("BUYER_AUTH_INVALID");
  }

  return storage.transactionSync(() => {
    eligible(storage, membershipId);

    const row = one(storage, `
      SELECT code_hash AS codeHash, status,
             attempts, expires_at AS expiresAt
      FROM nft_buyer_email_codes
      WHERE id = ? AND membership_id = ?
    `, challengeId, membershipId);

    if (
      !row ||
      row.status !== "PENDING" ||
      !Number.isFinite(Date.parse(row.expiresAt)) ||
      now >= Date.parse(row.expiresAt)
    ) {
      fail("BUYER_AUTH_UNAVAILABLE");
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      fail("BUYER_AUTH_LOCKED");
    }

    const matches =
      hashCode(membershipId, code, challengeId) ===
      row.codeHash;

    storage.sql.exec(`
      UPDATE nft_buyer_email_codes
      SET attempts = attempts + 1
      WHERE id = ? AND status = 'PENDING'
    `, challengeId);

    if (!matches) {
      return { verified: false };
    }

    storage.sql.exec(`
      UPDATE nft_buyer_email_codes
      SET status = 'VERIFIED', verified_at = ?
      WHERE id = ? AND status = 'PENDING'
    `, new Date(now).toISOString(), challengeId);

    return { verified: true, membershipId };
  });
}
