import { db } from "../db/database.js";

export type UsdtPaymentAttemptRow = {
  id: string;
  publicId: string;
  orderId: string;

  paymentMethod: "USDT";

  network: string;
  chainId: number;

  tokenContract: string;
  tokenDecimals: number;

  receiverAddress: string;
  expectedAmountMinor: number;

  status:
    | "AWAITING_TRANSFER"
    | "SUBMITTED"
    | "VERIFYING"
    | "VERIFIED"
    | "REJECTED"
    | "EXPIRED";

  txHash: string | null;

  idempotencyKey: string | null;

  createdAt: string;
  updatedAt: string;
};

const fields = `
  SELECT
    id,
    public_id AS publicId,
    order_id AS orderId,
    payment_method AS paymentMethod,
    network,
    chain_id AS chainId,
    token_contract AS tokenContract,
    token_decimals AS tokenDecimals,
    receiver_address AS receiverAddress,
    expected_amount_minor AS expectedAmountMinor,
    status,
    tx_hash AS txHash,
    idempotency_key AS idempotencyKey,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM payment_attempts
`;

export function getUsdtAttemptByPublicId(
  publicId: string,
) {
  return db.prepare(`
    ${fields}
    WHERE public_id = ?
      AND payment_method = 'USDT'
  `).get(
    publicId,
  ) as UsdtPaymentAttemptRow | undefined;
}

export function getUsdtAttemptByIdempotencyKey(
  key: string,
) {
  return db.prepare(`
    ${fields}
    WHERE idempotency_key = ?
      AND payment_method = 'USDT'
  `).get(
    key,
  ) as UsdtPaymentAttemptRow | undefined;
}
