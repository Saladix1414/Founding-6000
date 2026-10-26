import {
  buildNftMintExecutionPlan,
} from "./nftMintExecutionPlan.mjs";

/*
 * ORIGINX — MINT EXECUTION PART 2
 *
 * SIMULATION ONLY.
 *
 * No production endpoint invokes this service.
 * Never treat this function as an authority
 * to submit or sign an on-chain transaction.
 *
 * The MINTING status produced here represents
 * a test reservation, not a real blockchain mint.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unavailable() {
  throw new Error(
    "NFT_MINT_SIMULATION_UNAVAILABLE"
  );
}

export function reserveSimulatedNftMint({
  storage,
  mintJobId,
  now = Date.now(),
}) {
  if (
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof mintJobId !== "string" ||
    !UUID.test(mintJobId) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    unavailable();
  }

  return storage.transactionSync(() => {
    /*
     * Rebuild the plan inside the transaction.
     * Never accept tokenId, wallet or calldata
     * supplied by the caller.
     */
    const plan = buildNftMintExecutionPlan({
      storage,
      mintJobId,
    });

    if (
      plan.readyForExecutionReview !== true ||
      plan.mintAuthority !== false ||
      plan.transactionSigned !== false ||
      plan.transactionSubmitted !== false ||
      plan.chainId !== 8453
    ) {
      unavailable();
    }

    const stamp = new Date(now).toISOString();

    /*
     * The conditional UPDATE owns the race.
     * SQLite changes() must report exactly one.
     */
    storage.sql.exec(`
      UPDATE nft_mint_jobs
      SET status = 'MINTING',
          updated_at = ?
      WHERE id = ?
        AND membership_id = ?
        AND serial_number = ?
        AND recipient_address = ?
        AND status = 'READY'
        AND mint_tx_hash IS NULL
    `,
      stamp,
      plan.mintJobId,
      plan.membershipId,
      plan.tokenId,
      plan.recipient,
    );

    const changes = storage.sql.exec(`
      SELECT changes() AS total
    `).toArray();

    if (
      changes.length !== 1 ||
      changes[0].total !== 1
    ) {
      unavailable();
    }

    const reservationId = crypto.randomUUID();

    storage.sql.exec(`
      INSERT INTO nft_mint_simulation_reservations (
        id,
        mint_job_id,
        membership_id,
        binding_id,
        serial_number,
        recipient_address,
        chain_id,
        event_type,
        reserved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 8453,
        'SIMULATED_MINT_RESERVED', ?)
    `,
      reservationId,
      plan.mintJobId,
      plan.membershipId,
      plan.bindingId,
      plan.tokenId,
      plan.recipient,
      stamp,
    );

    const rows = storage.sql.exec(`
      SELECT
        j.status AS status,
        j.recipient_address AS recipient,
        j.mint_tx_hash AS txHash,
        r.id AS reservationId
      FROM nft_mint_jobs j
      JOIN nft_mint_simulation_reservations r
        ON r.mint_job_id = j.id
      WHERE j.id = ?
        AND r.id = ?
        AND r.membership_id = ?
        AND r.serial_number = ?
        AND r.recipient_address = ?
    `,
      plan.mintJobId,
      reservationId,
      plan.membershipId,
      plan.tokenId,
      plan.recipient,
    ).toArray();

    if (
      rows.length !== 1 ||
      rows[0].status !== "MINTING" ||
      rows[0].recipient !== plan.recipient ||
      rows[0].txHash !== null ||
      rows[0].reservationId !== reservationId
    ) {
      unavailable();
    }

    return Object.freeze({
      simulated: true,
      reservationId,
      mintJobId: plan.mintJobId,
      membershipId: plan.membershipId,
      tokenId: plan.tokenId,
      recipient: plan.recipient,
      chainId: 8453,
      status: "MINTING",
      mintAuthority: false,
      transactionSigned: false,
      transactionSubmitted: false,
    });
  });
}
