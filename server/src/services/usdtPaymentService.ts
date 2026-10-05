import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import {
  formatUnits,
} from "ethers";

import { db } from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  getUsdtAttemptByIdempotencyKey,
  getUsdtAttemptByPublicId,
  type UsdtPaymentAttemptRow,
} from "../repositories/usdtPaymentRepository.js";

import {
  getUsdtRuntimeConfig,
} from "../web3/usdtConfig.js";

type OrderRow = {
  id: string;
  publicId: string;
  referencePriceUsd: number;
  status: string;
};

function paymentPublicId() {
  return `PAY-USDT-${randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeAttempt(
  attempt: UsdtPaymentAttemptRow,
) {
  return {
    publicId:
      attempt.publicId,

    paymentMethod:
      "USDT" as const,

    network:
      attempt.network,

    chainId:
      Number(
        attempt.chainId,
      ),

    tokenContract:
      attempt.tokenContract,

    tokenDecimals:
      Number(
        attempt.tokenDecimals,
      ),

    receiverAddress:
      attempt.receiverAddress,

    expectedAmountMinor:
      Number(
        attempt.expectedAmountMinor,
      ),

    expectedAmountUsdt:
      formatUnits(
        BigInt(
          attempt.expectedAmountMinor,
        ),
        attempt.tokenDecimals,
      ),

    status:
      attempt.status,

    txHash:
      attempt.txHash,

    createdAt:
      attempt.createdAt,
  };
}

export function createUsdtPaymentAttempt(
  input: {
    orderPublicId: string;
    idempotencyKey?: string | null;
  },
) {
  if (input.idempotencyKey) {
    const existing =
      getUsdtAttemptByIdempotencyKey(
        input.idempotencyKey,
      );

    if (existing) {
      const existingOrder =
        db.prepare(`
          SELECT
            public_id AS publicId

          FROM founding_orders

          WHERE id = ?
        `).get(
          existing.orderId,
        ) as
          | {
              publicId: string;
            }
          | undefined;

      /*
       * The same idempotency key may replay only
       * the same original order request.
       *
       * It cannot be rebound to another order.
       */
      if (
        !existingOrder ||
        existingOrder.publicId !==
          input.orderPublicId
      ) {
        throw new Error(
          "IDEMPOTENCY_KEY_CONFLICT",
        );
      }

      return {
        attempt:
          normalizeAttempt(
            existing,
          ),

        idempotentReplay:
          true,
      };
    }
  }

  const order =
    db.prepare(`
      SELECT
        id,
        public_id AS publicId,
        reference_price_usd AS referencePriceUsd,
        status
      FROM founding_orders
      WHERE public_id = ?
    `).get(
      input.orderPublicId,
    ) as OrderRow | undefined;

  if (!order) {
    throw new Error(
      "ORDER_NOT_FOUND",
    );
  }

  if (
    [
      "PAID",
      "REFUNDED",
      "CANCELLED",
      "EXPIRED",
    ].includes(
      order.status,
    )
  ) {
    throw new Error(
      "ORDER_NOT_PAYABLE",
    );
  }

  const config =
    getUsdtRuntimeConfig();

  /*
   * Campaign settlement policy:
   *
   * Genesis US$50 reference
   * -> 50.000000 USDT due.
   *
   * Gas is paid separately by the sender in ETH.
   */
  const expectedAmountMinor =
    order.referencePriceUsd *
    10 ** config.decimals;

  if (
    !Number.isSafeInteger(
      expectedAmountMinor,
    )
  ) {
    throw new Error(
      "UNSAFE_USDT_AMOUNT",
    );
  }

  const id =
    randomUUID();

  const publicId =
    paymentPublicId();

  const now =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO payment_attempts (
      id,
      public_id,
      order_id,
      payment_method,
      network,
      chain_id,
      token_contract,
      token_decimals,
      receiver_address,
      expected_amount_minor,
      status,
      tx_hash,
      idempotency_key,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, 'USDT',
      ?, ?, ?, ?, ?, ?,
      'AWAITING_TRANSFER',
      NULL, ?, ?, ?
    )
  `).run(
    id,
    publicId,
    order.id,
    config.network,
    config.chainId,
    config.tokenContract,
    config.decimals,
    config.receiverAddress,
    expectedAmountMinor,
    input.idempotencyKey ?? null,
    now,
    now,
  );

  createAuditEvent({
    eventType:
      "USDT_PAYMENT_ATTEMPT_CREATED",

    entityType:
      "PAYMENT_ATTEMPT",

    entityId:
      id,

    payload: {
      paymentPublicId:
        publicId,

      orderPublicId:
        order.publicId,

      network:
        config.network,

      chainId:
        config.chainId,

      tokenContract:
        config.tokenContract,

      receiverAddress:
        config.receiverAddress,

      expectedAmountMinor,

      realPaymentEnabled:
        false,
    },
  });

  const stored =
    getUsdtAttemptByPublicId(
      publicId,
    );

  if (!stored) {
    throw new Error(
      "PAYMENT_ATTEMPT_PERSISTENCE_FAILED",
    );
  }

  return {
    attempt:
      normalizeAttempt(
        stored,
      ),

    idempotentReplay:
      false,
  };
}

export function submitUsdtTransactionHash(
  input: {
    paymentAttemptPublicId: string;
    txHash: string;
  },
) {
  const attempt =
    getUsdtAttemptByPublicId(
      input.paymentAttemptPublicId,
    );

  if (!attempt) {
    throw new Error(
      "PAYMENT_ATTEMPT_NOT_FOUND",
    );
  }

  const normalizedTxHash =
    input.txHash
      .trim()
      .toLowerCase();

  /*
   * Terminal states cannot accept new evidence.
   */
  if (
    attempt.status === "VERIFIED"
  ) {
    throw new Error(
      "PAYMENT_ATTEMPT_ALREADY_VERIFIED",
    );
  }

  if (
    [
      "REJECTED",
      "EXPIRED",
    ].includes(
      attempt.status,
    )
  ) {
    throw new Error(
      "PAYMENT_ATTEMPT_NOT_SUBMITTABLE",
    );
  }

  /*
   * Same hash + same attempt is a safe replay.
   * It does NOT verify the payment and does NOT
   * create a settlement.
   */
  if (
    attempt.txHash &&
    attempt.txHash.toLowerCase() ===
      normalizedTxHash
  ) {
    return {
      attempt:
        normalizeAttempt(
          attempt,
        ),

      idempotentReplay:
        true,
    };
  }

  /*
   * Once evidence was submitted, its hash becomes
   * immutable. A different hash cannot replace it.
   */
  if (
    attempt.status === "SUBMITTED" ||
    attempt.status === "VERIFYING" ||
    attempt.txHash
  ) {
    throw new Error(
      "PAYMENT_ATTEMPT_HASH_LOCKED",
    );
  }

  /*
   * A transaction hash cannot belong to another
   * campaign payment attempt.
   */
  const existing =
    db.prepare(`
      SELECT
        public_id AS publicId

      FROM payment_attempts

      WHERE
        tx_hash = ?
        AND id <> ?

      LIMIT 1
    `).get(
      normalizedTxHash,
      attempt.id,
    ) as
      | {
          publicId: string;
        }
      | undefined;

  if (existing) {
    throw new Error(
      "TX_HASH_ALREADY_SUBMITTED",
    );
  }

  const now =
    new Date().toISOString();

  /*
   * Conditional UPDATE prevents a concurrent request
   * from replacing evidence after another request wins.
   */
  const updateResult =
    db.prepare(`
      UPDATE payment_attempts

      SET
        tx_hash = ?,
        status = 'SUBMITTED',
        updated_at = ?

      WHERE
        id = ?
        AND status = 'AWAITING_TRANSFER'
        AND tx_hash IS NULL
    `).run(
      normalizedTxHash,
      now,
      attempt.id,
    );

  if (
    Number(
      updateResult.changes,
    ) !== 1
  ) {
    const concurrent =
      getUsdtAttemptByPublicId(
        attempt.publicId,
      );

    if (
      concurrent?.txHash &&
      concurrent.txHash.toLowerCase() ===
        normalizedTxHash
    ) {
      return {
        attempt:
          normalizeAttempt(
            concurrent,
          ),

        idempotentReplay:
          true,
      };
    }

    throw new Error(
      "PAYMENT_ATTEMPT_HASH_LOCKED",
    );
  }

  createAuditEvent({
    eventType:
      "USDT_TX_HASH_SUBMITTED",

    entityType:
      "PAYMENT_ATTEMPT",

    entityId:
      attempt.id,

    payload: {
      paymentAttemptPublicId:
        attempt.publicId,

      txHash:
        normalizedTxHash,

      authoritativePayment:
        false,

      settlementCreated:
        false,
    },
  });

  const updated =
    getUsdtAttemptByPublicId(
      attempt.publicId,
    );

  if (!updated) {
    throw new Error(
      "PAYMENT_ATTEMPT_UPDATE_FAILED",
    );
  }

  return {
    attempt:
      normalizeAttempt(
        updated,
      ),

    idempotentReplay:
      false,
  };
}

export function getUsdtPaymentAttempt(
  publicId: string,
) {
  const attempt =
    getUsdtAttemptByPublicId(
      publicId,
    );

  if (!attempt) {
    return null;
  }

  return normalizeAttempt(
    attempt,
  );
}
