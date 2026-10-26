/*
 * OriginX Mint Lifecycle — simulated submission.
 *
 * Simulation evidence only.
 * Never writes nft_mint_jobs.mint_tx_hash.
 * Never moves a job to SUBMITTED.
 * No signer, RPC or blockchain transaction.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unavailable() {
  throw new Error("NFT_SIMULATED_SUBMISSION_UNAVAILABLE");
}

export function recordSimulatedMintSubmission({
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
     * A trusted simulated reservation must exist.
     * The current job and reservation must agree.
     */
    const rows = storage.sql.exec(`
      SELECT
        j.id AS mintJobId,
        j.membership_id AS membershipId,
        j.serial_number AS tokenId,
        j.recipient_address AS recipient,
        j.status AS jobStatus,
        j.mint_tx_hash AS txHash,
        r.id AS reservationId,
        r.binding_id AS bindingId,
        r.chain_id AS chainId
      FROM nft_mint_jobs j
      JOIN nft_mint_simulation_reservations r
        ON r.mint_job_id = j.id
       AND r.membership_id = j.membership_id
       AND r.serial_number = j.serial_number
       AND r.recipient_address = j.recipient_address
      JOIN founding_memberships m
        ON m.id = j.membership_id
       AND m.order_id = j.order_id
       AND m.serial_number = j.serial_number
      JOIN founding_orders o
        ON o.id = j.order_id
      JOIN nft_wallet_bindings b
        ON b.id = r.binding_id
       AND b.membership_id = j.membership_id
       AND b.wallet_address = j.recipient_address
       AND b.chain_id = r.chain_id
      JOIN nft_mint_readiness_events e
        ON e.mint_job_id = j.id
       AND e.membership_id = j.membership_id
       AND e.binding_id = b.id
       AND e.recipient_address = j.recipient_address
      WHERE j.id = ?
        AND j.status = 'MINTING'
        AND j.mint_tx_hash IS NULL
        AND m.status = 'ACTIVATION_PENDING'
        AND o.status = 'PAID'
        AND b.status = 'BOUND'
        AND r.chain_id = 8453
        AND r.event_type = 'SIMULATED_MINT_RESERVED'
        AND e.event_type = 'MINT_JOB_READY'
      LIMIT 2
    `, mintJobId).toArray();

    if (rows.length !== 1) {
      unavailable();
    }

    const row = rows[0];

    if (
      row.jobStatus !== "MINTING" ||
      row.txHash !== null ||
      row.chainId !== 8453 ||
      !Number.isInteger(row.tokenId) ||
      row.tokenId < 1 ||
      row.tokenId > 6000 ||
      typeof row.recipient !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(row.recipient) ||
      !UUID.test(row.reservationId)
    ) {
      unavailable();
    }

    /*
     * Deliberately NOT a 0x transaction hash.
     * Impossible to mistake for an Ethereum tx.
     */
    /*
     * Reject previously recorded simulations
     * with a stable service-level error.
     *
     * The database UNIQUE constraints remain
     * mandatory protection against races.
     */
    const existing = storage.sql.exec(`
      SELECT id
      FROM nft_mint_simulated_submissions
      WHERE mint_job_id = ?
         OR membership_id = ?
         OR reservation_id = ?
         OR serial_number = ?
      LIMIT 1
    `,
      row.mintJobId,
      row.membershipId,
      row.reservationId,
      row.tokenId,
    ).toArray();

    if (existing.length !== 0) {
      unavailable();
    }

    const simulationId = crypto.randomUUID();
    const stamp = new Date(now).toISOString();

    storage.sql.exec(`
      INSERT INTO nft_mint_simulated_submissions (
        id,
        mint_job_id,
        membership_id,
        reservation_id,
        serial_number,
        recipient_address,
        chain_id,
        event_type,
        recorded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 8453,
        'SIMULATED_SUBMISSION_RECORDED', ?)
    `,
      simulationId,
      row.mintJobId,
      row.membershipId,
      row.reservationId,
      row.tokenId,
      row.recipient,
      stamp,
    );

    const saved = storage.sql.exec(`
      SELECT
        id,
        mint_job_id AS mintJobId,
        membership_id AS membershipId,
        reservation_id AS reservationId,
        serial_number AS tokenId,
        recipient_address AS recipient,
        chain_id AS chainId,
        event_type AS eventType
      FROM nft_mint_simulated_submissions
      WHERE id = ?
        AND mint_job_id = ?
        AND reservation_id = ?
    `,
      simulationId,
      row.mintJobId,
      row.reservationId,
    ).toArray();

    if (
      saved.length !== 1 ||
      saved[0].id !== simulationId ||
      saved[0].mintJobId !== row.mintJobId ||
      saved[0].membershipId !== row.membershipId ||
      saved[0].reservationId !== row.reservationId ||
      saved[0].tokenId !== row.tokenId ||
      saved[0].recipient !== row.recipient ||
      saved[0].chainId !== 8453 ||
      saved[0].eventType !==
        "SIMULATED_SUBMISSION_RECORDED"
    ) {
      unavailable();
    }

    /*
     * No mutation to the production-shaped job.
     * This is independent simulation evidence.
     */
    const current = storage.sql.exec(`
      SELECT status, mint_tx_hash AS txHash
      FROM nft_mint_jobs
      WHERE id = ?
    `, row.mintJobId).toArray();

    if (
      current.length !== 1 ||
      current[0].status !== "MINTING" ||
      current[0].txHash !== null
    ) {
      unavailable();
    }

    return Object.freeze({
      simulated: true,
      simulationId,
      mintJobId: row.mintJobId,
      reservationId: row.reservationId,
      tokenId: row.tokenId,
      recipient: row.recipient,
      chainId: 8453,
      jobStatus: "MINTING",
      simulationStatus: "SUBMISSION_RECORDED",
      mintAuthority: false,
      transactionSigned: false,
      transactionSubmitted: false,
      transactionHash: null,
    });
  });
}
