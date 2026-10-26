import { getAddress } from "ethers";

import {
  evaluateNftDeliveryPreflight,
} from "./nftWalletDeliveryPreflight.mjs";

/*
 * OriginX — PHASE 5J.5
 *
 * INTERNAL ONLY.
 *
 * The authorizeReadiness callback is an
 * integration boundary for a future trusted
 * backend authority.
 *
 * Do not expose this primitive to public HTTP.
 * Do not build authorizeReadiness from a
 * browser-supplied role, flag or boolean.
 *
 * This function DOES NOT authorize or execute
 * an on-chain mint.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailable() {
  throw new Error("NFT_MINT_READINESS_UNAVAILABLE");
}

export function prepareNftMintReadiness({
  storage,
  membershipId,
  email,
  authorizeReadiness,
  now = Date.now(),
}) {
  if (
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof membershipId !== "string" ||
    !UUID.test(membershipId) ||
    typeof email !== "string" ||
    email.length > 320 ||
    typeof authorizeReadiness !== "function" ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    unavailable();
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  if (!EMAIL.test(normalizedEmail)) {
    unavailable();
  }

  /*
   * This callback must be provided only by a
   * trusted internal adapter. It is not an
   * independently secure authorization system.
   */
  let authorized;

  try {
    authorized = authorizeReadiness({
      operation: "NFT_MINT_READINESS",
      membershipId,
    });
  } catch {
    unavailable();
  }

  if (authorized !== true) {
    unavailable();
  }

  /*
   * Fresh validation and all writes share
   * one SQLite transaction.
   */
  return storage.transactionSync(() => {
    const evidence = evaluateNftDeliveryPreflight({
      storage,
      membershipId,
      email: normalizedEmail,
    });

    if (
      evidence.eligibleForDeliveryReview !== true ||
      evidence.mintAuthority !== false ||
      evidence.blockchainTransaction !== false
    ) {
      unavailable();
    }

    let wallet;

    try {
      wallet = getAddress(
        evidence.walletAddress
      );
    } catch {
      unavailable();
    }

    if (
      wallet !== evidence.walletAddress ||
      evidence.chainId !== 8453
    ) {
      unavailable();
    }

    /*
     * Conditional UPDATE provides an additional
     * database-level check against stale states.
     *
     * This service does not accept an arbitrary
     * recipient address from its caller.
     */
    storage.sql.exec(`
      UPDATE nft_mint_jobs
      SET recipient_address = ?,
          status = 'READY',
          updated_at = ?
      WHERE id = ?
        AND membership_id = ?
        AND serial_number = ?
        AND status = 'AWAITING_WALLET'
        AND recipient_address IS NULL
        AND mint_tx_hash IS NULL
    `,
      wallet,
      new Date(now).toISOString(),
      evidence.mintJobId,
      membershipId,
      evidence.serialNumber,
    );

    const changed = storage.sql.exec(`
      SELECT
        id,
        membership_id AS membershipId,
        serial_number AS serialNumber,
        recipient_address AS recipientAddress,
        status
      FROM nft_mint_jobs
      WHERE id = ?
        AND membership_id = ?
    `,
      evidence.mintJobId,
      membershipId,
    ).toArray();

    if (
      changed.length !== 1 ||
      changed[0].status !== "READY" ||
      changed[0].recipientAddress !== wallet ||
      changed[0].serialNumber !==
        evidence.serialNumber
    ) {
      unavailable();
    }

    /*
     * Exactly one readiness event is persisted.
     *
     * UNIQUE constraints reject duplicate
     * events even if the service is called
     * again through an unexpected path.
     */
    const eventId = crypto.randomUUID();
    const stamp = new Date(now).toISOString();

    storage.sql.exec(`
      INSERT INTO nft_mint_readiness_events (
        id,
        mint_job_id,
        membership_id,
        binding_id,
        recipient_address,
        event_type,
        created_at
      )
      VALUES (?, ?, ?, ?, ?,
        'MINT_JOB_READY', ?)
    `,
      eventId,
      evidence.mintJobId,
      membershipId,
      evidence.bindingId,
      wallet,
      stamp,
    );

    const events = storage.sql.exec(`
      SELECT id
      FROM nft_mint_readiness_events
      WHERE mint_job_id = ?
        AND membership_id = ?
        AND binding_id = ?
        AND recipient_address = ?
        AND event_type = 'MINT_JOB_READY'
    `,
      evidence.mintJobId,
      membershipId,
      evidence.bindingId,
      wallet,
    ).toArray();

    if (
      events.length !== 1 ||
      events[0].id !== eventId
    ) {
      unavailable();
    }

    return Object.freeze({
      prepared: true,
      membershipId,
      mintJobId: evidence.mintJobId,
      serialNumber: evidence.serialNumber,
      walletAddress: wallet,
      status: "READY",
      mintAuthority: false,
      transactionSubmitted: false,
    });
  });
}
