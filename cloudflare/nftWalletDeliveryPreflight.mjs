import { getAddress } from "ethers";

/*
 * ORIGINX — PHASE 5J.4
 *
 * Internal, read-only delivery eligibility.
 *
 * This is evidence for a future mint policy.
 * It is NOT mint approval or authorization.
 *
 * Do not expose this function directly to
 * public HTTP or use it as signing authority.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailable() {
  throw new Error("NFT_DELIVERY_PREFLIGHT_UNAVAILABLE");
}

export function evaluateNftDeliveryPreflight({
  storage,
  membershipId,
  email,
}) {
  if (
    !storage?.sql ||
    typeof membershipId !== "string" ||
    !UUID.test(membershipId) ||
    typeof email !== "string" ||
    email.length > 320
  ) {
    unavailable();
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL.test(normalizedEmail)) {
    unavailable();
  }

  /*
   * Every condition must be satisfied by
   * persisted server-side evidence.
   *
   * This operation performs SELECT only.
   */
  const rows = storage.sql.exec(`
    SELECT
      m.id AS membershipId,
      m.serial_number AS serialNumber,
      b.id AS bindingId,
      b.wallet_address AS walletAddress,
      b.chain_id AS chainId,
      c.id AS challengeId,
      c.verified_at AS verifiedAt,
      j.id AS mintJobId,
      j.status AS mintJobStatus,
      j.recipient_address AS recipientAddress
    FROM founding_memberships m
    JOIN founding_orders o
      ON o.id = m.order_id
    JOIN nft_wallet_bindings b
      ON b.membership_id = m.id
    JOIN nft_wallet_challenges c
      ON c.id = b.challenge_id
     AND c.membership_id = m.id
     AND c.wallet_address = b.wallet_address
    JOIN nft_mint_jobs j
      ON j.membership_id = m.id
     AND j.order_id = o.id
     AND j.serial_number = m.serial_number
    WHERE m.id = ?
      AND o.normalized_email = ?
      AND o.status = 'PAID'
      AND m.status = 'ACTIVATION_PENDING'
      AND b.status = 'BOUND'
      AND b.chain_id = 8453
      AND c.status = 'VERIFIED'
      AND c.verified_at IS NOT NULL
      AND j.status = 'AWAITING_WALLET'
      AND j.recipient_address IS NULL
      AND j.mint_tx_hash IS NULL
      AND EXISTS (
        SELECT 1
        FROM nft_claim_grants g
        WHERE g.membership_id = m.id
          AND g.status = 'CONSUMED'
          AND g.consumed_at = c.verified_at
      )
      AND EXISTS (
        SELECT 1
        FROM nft_wallet_binding_events e
        WHERE e.binding_id = b.id
          AND e.membership_id = m.id
          AND e.challenge_id = c.id
          AND e.event_type = 'WALLET_BOUND'
      )
    LIMIT 2
  `, membershipId, normalizedEmail).toArray();

  if (rows.length !== 1) {
    unavailable();
  }

  const row = rows[0];

  if (
    !Number.isInteger(row.serialNumber) ||
    row.serialNumber < 1 ||
    row.serialNumber > 6000 ||
    row.chainId !== 8453 ||
    row.mintJobStatus !== "AWAITING_WALLET" ||
    row.recipientAddress !== null ||
    typeof row.bindingId !== "string" ||
    typeof row.mintJobId !== "string" ||
    !Number.isFinite(Date.parse(row.verifiedAt))
  ) {
    unavailable();
  }

  let wallet;

  try {
    wallet = getAddress(row.walletAddress);
  } catch {
    unavailable();
  }

  if (wallet !== row.walletAddress) {
    unavailable();
  }

  /*
   * Snapshot only. No transaction, queue
   * transition, token mint or approval.
   */
  return Object.freeze({
    eligibleForDeliveryReview: true,
    membershipId: row.membershipId,
    serialNumber: row.serialNumber,
    bindingId: row.bindingId,
    mintJobId: row.mintJobId,
    walletAddress: wallet,
    chainId: 8453,
    mintAuthority: false,
    blockchainTransaction: false,
  });
}
