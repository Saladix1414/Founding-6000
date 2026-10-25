import {
  getAddress,
  sha256,
  verifyMessage,
} from "ethers";

import {
  consumeNftClaimGrant,
} from "./nftClaimGrant.mjs";

/*
 * ORIGINX — OX-NFT-5J.2
 *
 * Internal-only verification.
 *
 * This verifies standard EOA personal_sign
 * signatures. EIP-1271 contract wallets require
 * a separate verifier in a future phase.
 *
 * No public route, mint authority or
 * ownership entitlement is created here.
 */

const TOKEN = /^0x[a-f0-9]{64}$/;
const SIGNATURE = /^0x[a-fA-F0-9]{130}$/;
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailable() {
  throw new Error("NFT_WALLET_VERIFICATION_UNAVAILABLE");
}

function trustedOrigin(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    unavailable();
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== value
  ) {
    unavailable();
  }

  return parsed;
}

function canonicalMessage({
  origin,
  wallet,
  chainId,
  nonce,
  issuedAt,
  expiresAt,
  challengeId,
}) {
  return [
    `${origin.hostname} wants you to sign in with your Ethereum account:`,
    wallet,
    "",
    "Verify wallet control for OriginX Founding 6000.",
    "This signature does not authorize payments or NFT minting.",
    "",
    `URI: ${origin.origin}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
    `Request ID: ${challengeId}`,
  ].join("\n");
}

/*
 * Trusted server caller supplies expectedOrigin
 * and expectedChainId from its own configuration.
 * NEVER accept either as browser authority.
 */
export function verifyEmailBoundWalletChallenge({
  storage,
  challengeId,
  claimToken,
  email,
  signature,
  expectedOrigin,
  expectedChainId = 8453,
  now = Date.now(),
}) {
  if (
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof challengeId !== "string" ||
    !UUID.test(challengeId) ||
    typeof claimToken !== "string" ||
    !TOKEN.test(claimToken) ||
    typeof signature !== "string" ||
    !SIGNATURE.test(signature) ||
    typeof email !== "string" ||
    email.length > 320 ||
    typeof expectedOrigin !== "string" ||
    expectedChainId !== 8453 ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    unavailable();
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL.test(normalizedEmail)) {
    unavailable();
  }

  const origin = trustedOrigin(expectedOrigin);

  /*
   * Single SQLite transaction:
   * - read challenge and membership
   * - verify wallet signature
   * - consume email-bound claim credential
   * - mark challenge VERIFIED
   *
   * Any failure rolls back the entire operation.
   */
  return storage.transactionSync(() => {
    const rows = storage.sql.exec(`
      SELECT
        c.id AS challengeId,
        c.membership_id AS membershipId,
        c.wallet_address AS walletAddress,
        c.nonce,
        c.challenge_message AS message,
        c.status,
        c.created_at AS issuedAt,
        c.expires_at AS expiresAt,
        g.expires_at AS claimExpiresAt
      FROM nft_wallet_challenges c
      JOIN founding_memberships m
        ON m.id = c.membership_id
      JOIN founding_orders o
        ON o.id = m.order_id
      JOIN nft_mint_jobs j
        ON j.membership_id = m.id
       AND j.order_id = o.id
       AND j.serial_number = m.serial_number
      JOIN nft_claim_grants g
        ON g.membership_id = m.id
      WHERE c.id = ?
        AND g.token_hash = ?
        AND g.status = 'ISSUED'
        AND o.normalized_email = ?
        AND o.status = 'PAID'
        AND m.status = 'ACTIVATION_PENDING'
        AND j.status = 'AWAITING_WALLET'
      LIMIT 2
    `,
      challengeId,
      sha256(claimToken),
      normalizedEmail,
    ).toArray();

    if (rows.length !== 1) {
      unavailable();
    }

    const row = rows[0];

    if (
      row.status !== "PENDING" ||
      typeof row.nonce !== "string" ||
      !/^[a-f0-9]{32}$/.test(row.nonce) ||
      !Number.isFinite(Date.parse(row.issuedAt)) ||
      !Number.isFinite(Date.parse(row.expiresAt)) ||
      !Number.isFinite(Date.parse(row.claimExpiresAt)) ||
      now < Date.parse(row.issuedAt) ||
      now >= Date.parse(row.expiresAt) ||
      now >= Date.parse(row.claimExpiresAt) ||
      Date.parse(row.expiresAt) -
        Date.parse(row.issuedAt) !== 5 * 60 * 1000
    ) {
      unavailable();
    }

    let wallet;

    try {
      wallet = getAddress(row.walletAddress);
    } catch {
      unavailable();
    }

    const expectedMessage = canonicalMessage({
      origin,
      wallet,
      chainId: expectedChainId,
      nonce: row.nonce,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      challengeId: row.challengeId,
    });

    /*
     * A signature must correspond to the
     * exact server-stored challenge.
     */
    if (row.message !== expectedMessage) {
      unavailable();
    }

    let recovered;

    try {
      recovered = getAddress(
        verifyMessage(row.message, signature)
      );
    } catch {
      unavailable();
    }

    if (recovered !== wallet) {
      unavailable();
    }

    /*
     * The grant consumption function owns its
     * validation and update. This adapter joins
     * the enclosing transaction without starting
     * another SQLite transaction.
     */
    const joinedStorage = {
      sql: storage.sql,
      transactionSync: fn => fn(),
    };

    const consumed = consumeNftClaimGrant({
      storage: joinedStorage,
      membershipId: row.membershipId,
      token: claimToken,
      now,
    });

    if (consumed.consumed !== true) {
      unavailable();
    }

    storage.sql.exec(`
      UPDATE nft_wallet_challenges
      SET status = 'VERIFIED',
          verified_at = ?
      WHERE id = ?
        AND membership_id = ?
        AND status = 'PENDING'
        AND verified_at IS NULL
    `,
      new Date(now).toISOString(),
      challengeId,
      row.membershipId,
    );

    const verified = storage.sql.exec(`
      SELECT status, verified_at AS verifiedAt
      FROM nft_wallet_challenges
      WHERE id = ?
    `, challengeId).toArray()[0];

    if (
      verified?.status !== "VERIFIED" ||
      verified.verifiedAt !== new Date(now).toISOString()
    ) {
      unavailable();
    }

    return Object.freeze({
      verified: true,
      challengeId,
      membershipId: row.membershipId,
      walletAddress: wallet,
      chainId: expectedChainId,
    });
  });
}
