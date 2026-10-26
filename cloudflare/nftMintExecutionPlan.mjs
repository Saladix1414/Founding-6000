import {
  Interface,
  getAddress,
} from "ethers";

/*
 * ORIGINX — NFT MINT EXECUTION PART 1
 *
 * Builds and validates mint calldata.
 *
 * Does NOT sign, submit, approve, or
 * execute a blockchain transaction.
 *
 * The output is NOT mint authorization.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ABI = new Interface([
  "function mint(address to,uint256 tokenId)",
]);

const CHAIN_ID = 8453;
const MAX_SUPPLY = 6000;

function unavailable() {
  throw new Error("NFT_MINT_PLAN_UNAVAILABLE");
}

export function buildNftMintExecutionPlan({
  storage,
  mintJobId,
}) {
  if (
    !storage?.sql ||
    typeof mintJobId !== "string" ||
    !UUID.test(mintJobId)
  ) {
    unavailable();
  }

  /*
   * Require an unambiguous persisted
   * relationship between job, membership,
   * buyer, wallet binding and readiness event.
   */
  const rows = storage.sql.exec(`
    SELECT
      j.id AS mintJobId,
      j.membership_id AS membershipId,
      j.serial_number AS serialNumber,
      j.recipient_address AS recipientAddress,
      j.status AS jobStatus,
      j.mint_tx_hash AS txHash,
      b.id AS bindingId,
      b.wallet_address AS boundWallet,
      b.chain_id AS bindingChainId,
      e.recipient_address AS auditedWallet,
      o.normalized_email AS subscriberEmail
    FROM nft_mint_jobs j
    JOIN founding_memberships m
      ON m.id = j.membership_id
     AND m.order_id = j.order_id
     AND m.serial_number = j.serial_number
    JOIN founding_orders o
      ON o.id = j.order_id
    JOIN nft_wallet_bindings b
      ON b.membership_id = m.id
    JOIN nft_mint_readiness_events e
      ON e.mint_job_id = j.id
     AND e.membership_id = m.id
     AND e.binding_id = b.id
    WHERE j.id = ?
      AND j.status = 'READY'
      AND j.mint_tx_hash IS NULL
      AND j.recipient_address IS NOT NULL
      AND m.status = 'ACTIVATION_PENDING'
      AND o.status = 'PAID'
      AND b.status = 'BOUND'
      AND b.chain_id = 8453
      AND e.event_type = 'MINT_JOB_READY'
    LIMIT 2
  `, mintJobId).toArray();

  if (rows.length !== 1) {
    unavailable();
  }

  const row = rows[0];

  if (
    row.jobStatus !== "READY" ||
    row.txHash !== null ||
    row.bindingChainId !== CHAIN_ID ||
    !Number.isInteger(row.serialNumber) ||
    row.serialNumber < 1 ||
    row.serialNumber > MAX_SUPPLY ||
    typeof row.subscriberEmail !== "string" ||
    row.subscriberEmail.length === 0
  ) {
    unavailable();
  }

  let recipient;

  try {
    recipient = getAddress(
      row.recipientAddress
    );

    if (
      recipient !== row.recipientAddress ||
      recipient !== getAddress(row.boundWallet) ||
      recipient !== getAddress(row.auditedWallet)
    ) {
      unavailable();
    }
  } catch {
    unavailable();
  }

  const calldata = ABI.encodeFunctionData(
    "mint",
    [
      recipient,
      BigInt(row.serialNumber),
    ],
  );

  const decoded = ABI.decodeFunctionData(
    "mint",
    calldata,
  );

  if (
    decoded[0] !== recipient ||
    decoded[1] !== BigInt(row.serialNumber)
  ) {
    unavailable();
  }

  return Object.freeze({
    readyForExecutionReview: true,
    mintJobId: row.mintJobId,
    membershipId: row.membershipId,
    bindingId: row.bindingId,
    tokenId: row.serialNumber,
    recipient,
    chainId: CHAIN_ID,
    functionName: "mint",
    calldata,
    mintAuthority: false,
    transactionSigned: false,
    transactionSubmitted: false,
  });
}
