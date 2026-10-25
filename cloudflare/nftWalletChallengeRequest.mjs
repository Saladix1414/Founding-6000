import { getAddress, sha256 } from "ethers";

/*
 * ORIGINX — PHASE 5J.1
 *
 * INTERNAL DOMAIN SERVICE ONLY.
 *
 * A valid email-bound claim credential is
 * required before issuing a wallet challenge.
 *
 * This function DOES NOT:
 * - verify a wallet signature
 * - consume the NFT claim grant
 * - bind the wallet
 * - authorize minting
 * - transfer an NFT
 */

const TTL_MS = 5 * 60 * 1000;
const BASE_CHAIN_ID = 8453;

const TOKEN = /^0x[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = /^[a-z0-9.-]+$/;

function unavailable() {
  throw new Error("NFT_WALLET_CHALLENGE_UNAVAILABLE");
}

function normalizeEmail(value) {
  if (
    typeof value !== "string" ||
    value.length > 320
  ) {
    unavailable();
  }

  const normalized = value.trim().toLowerCase();

  if (!EMAIL.test(normalized)) {
    unavailable();
  }

  return normalized;
}

export function issueEmailBoundWalletChallenge({
  storage,
  claimToken,
  email,
  walletAddress,
  domain,
  uri,
  chainId = BASE_CHAIN_ID,
  now = Date.now(),
}) {
  if (
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof claimToken !== "string" ||
    !TOKEN.test(claimToken) ||
    typeof domain !== "string" ||
    !DOMAIN.test(domain) ||
    domain.length > 253 ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    chainId !== BASE_CHAIN_ID
  ) {
    unavailable();
  }

  const registeredEmail = normalizeEmail(email);

  let wallet;
  let parsedUri;

  try {
    wallet = getAddress(walletAddress);
    parsedUri = new URL(uri);
  } catch {
    unavailable();
  }

  if (
    parsedUri.protocol !== "https:" ||
    parsedUri.hostname !== domain ||
    parsedUri.username ||
    parsedUri.password ||
    parsedUri.search ||
    parsedUri.hash ||
    parsedUri.pathname !== "/" ||
    parsedUri.port
  ) {
    unavailable();
  }

  /*
   * Membership identity is sourced from the
   * existing paid order, never from a caller-
   * supplied membership ID.
   *
   * The normalized order email is authoritative
   * for the original purchaser.
   */
  return storage.transactionSync(() => {
    const rows = storage.sql.exec(`
      SELECT
        m.id AS membershipId,
        m.serial_number AS serialNumber,
        g.expires_at AS claimExpiresAt
      FROM nft_claim_grants g
      JOIN founding_memberships m
        ON m.id = g.membership_id
      JOIN founding_orders o
        ON o.id = m.order_id
      JOIN nft_mint_jobs j
        ON j.membership_id = m.id
       AND j.order_id = o.id
       AND j.serial_number = m.serial_number
      WHERE g.token_hash = ?
        AND g.status = 'ISSUED'
        AND o.normalized_email = ?
        AND o.status = 'PAID'
        AND m.status = 'ACTIVATION_PENDING'
        AND j.status = 'AWAITING_WALLET'
      LIMIT 2
    `, sha256(claimToken), registeredEmail)
      .toArray();

    if (rows.length !== 1) {
      unavailable();
    }

    const member = rows[0];

    if (
      typeof member.membershipId !== "string" ||
      !Number.isInteger(member.serialNumber) ||
      member.serialNumber < 1 ||
      member.serialNumber > 6000 ||
      !Number.isFinite(
        Date.parse(member.claimExpiresAt)
      ) ||
      now >= Date.parse(member.claimExpiresAt)
    ) {
      unavailable();
    }

    /*
     * A newer challenge revokes any older
     * pending challenge for this membership.
     */
    storage.sql.exec(`
      UPDATE nft_wallet_challenges
      SET status = 'REVOKED'
      WHERE membership_id = ?
        AND status = 'PENDING'
    `, member.membershipId);

    const challengeId = crypto.randomUUID();

    const nonceBytes = new Uint8Array(16);
    crypto.getRandomValues(nonceBytes);

    const nonce = Array.from(nonceBytes, byte =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    const issuedAt = new Date(now).toISOString();

    const expiresAt = new Date(
      now + TTL_MS
    ).toISOString();

    /*
     * SIWE-formatted message.
     *
     * Email stays in the server database;
     * it is intentionally not published
     * inside the wallet signature message.
     */
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      wallet,
      "",
      "Verify wallet control for OriginX Founding 6000.",
      "This signature does not authorize payments or NFT minting.",
      "",
      `URI: ${parsedUri.origin}`,
      "Version: 1",
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      `Expiration Time: ${expiresAt}`,
      `Request ID: ${challengeId}`,
    ].join("\n");

    storage.sql.exec(`
      INSERT INTO nft_wallet_challenges (
        id,
        membership_id,
        wallet_address,
        nonce,
        challenge_message,
        status,
        created_at,
        expires_at,
        verified_at
      )
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, NULL)
    `,
      challengeId,
      member.membershipId,
      wallet,
      nonce,
      message,
      issuedAt,
      expiresAt,
    );

    return Object.freeze({
      challengeId,
      walletAddress: wallet,
      chainId,
      message,
      expiresAt,
    });
  });
}
