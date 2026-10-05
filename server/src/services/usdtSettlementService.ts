import {
  randomUUID,
} from "node:crypto";

import { db } from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  getUsdtAttemptByPublicId,
} from "../repositories/usdtPaymentRepository.js";

import {
  allocateInventoryWithinTransaction,
} from "./inventoryService.js";

import {
  createMembershipForPaidOrderWithinTransaction,
} from "./membershipService.js";

import {
  queueFoundingEmailWithinTransaction,
} from "./emailOutboxService.js";

import type {
  VerifiedUsdtTransfer,
} from "../web3/usdtVerifier.js";

type AttemptContext = {
  attemptId: string;
  attemptPublicId: string;

  orderId: string;
  orderPublicId: string;

  attemptStatus: string;

  receiverAddress: string;
  expectedAmountMinor: number;
};

export function settleVerifiedUsdtTransfer(
  input: {
    paymentAttemptPublicId:
      string;

    transfer:
      VerifiedUsdtTransfer;
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

  const context =
    db.prepare(`
      SELECT
        pa.id AS attemptId,
        pa.public_id AS attemptPublicId,

        pa.order_id AS orderId,

        o.public_id AS orderPublicId,

        pa.status AS attemptStatus,

        pa.receiver_address AS receiverAddress,

        pa.expected_amount_minor AS expectedAmountMinor

      FROM payment_attempts pa

      JOIN founding_orders o
        ON o.id = pa.order_id

      WHERE pa.id = ?
    `).get(
      attempt.id,
    ) as AttemptContext | undefined;

  if (!context) {
    throw new Error(
      "PAYMENT_CONTEXT_NOT_FOUND",
    );
  }

  if (
    BigInt(
      context.expectedAmountMinor,
    ) !==
    input.transfer.amountMinor
  ) {
    throw new Error(
      "SETTLEMENT_AMOUNT_MISMATCH",
    );
  }

  if (
    context.receiverAddress
      .toLowerCase() !==
    input.transfer.receiverAddress
      .toLowerCase()
  ) {
    throw new Error(
      "SETTLEMENT_RECEIVER_MISMATCH",
    );
  }

  const txHash =
    input.transfer.txHash
      .toLowerCase();

  db.exec(
    "BEGIN IMMEDIATE",
  );

  try {
    const existingSettlement =
      db.prepare(`
        SELECT
          id,
          external_reference AS externalReference

        FROM payment_settlements

        WHERE external_reference = ?
      `).get(
        txHash,
      ) as
        | {
            id: string;
            externalReference: string;
          }
        | undefined;

    if (existingSettlement) {
      throw new Error(
        "TRANSACTION_ALREADY_SETTLED",
      );
    }

    const existingAttemptSettlement =
      db.prepare(`
        SELECT
          id,
          external_reference AS externalReference

        FROM payment_settlements

        WHERE payment_attempt_id = ?
      `).get(
        context.attemptId,
      ) as
        | {
            id: string;
            externalReference: string;
          }
        | undefined;

    if (existingAttemptSettlement) {
      throw new Error(
        "PAYMENT_ATTEMPT_ALREADY_SETTLED",
      );
    }

    const allocation =
      allocateInventoryWithinTransaction({
        orderPublicId:
          context.orderPublicId,

        settlementReference:
          txHash,
      });

    const settlementId =
      randomUUID();

    const now =
      new Date().toISOString();

    db.prepare(`
      INSERT INTO payment_settlements (
        id,
        payment_attempt_id,
        order_id,
        payment_method,
        external_reference,
        network,
        chain_id,
        token_contract,
        receiver_address,
        sender_address,
        amount_minor,
        block_number,
        transaction_index,
        confirmations,
        status,
        evidence_json,
        verified_at
      )
      VALUES (
        ?, ?, ?, 'USDT',
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'VERIFIED',
        ?, ?
      )
    `).run(
      settlementId,
      context.attemptId,
      context.orderId,
      txHash,
      "ethereum-mainnet",
      input.transfer.chainId,
      input.transfer.tokenContract,
      input.transfer.receiverAddress,
      input.transfer.senderAddress,
      Number(
        input.transfer.amountMinor,
      ),
      input.transfer.blockNumber,
      input.transfer.transactionIndex,
      input.transfer.confirmations,
      JSON.stringify({
        txHash,
        chainId:
          input.transfer.chainId,

        tokenContract:
          input.transfer.tokenContract,

        senderAddress:
          input.transfer.senderAddress,

        receiverAddress:
          input.transfer.receiverAddress,

        amountMinor:
          input.transfer.amountMinor
            .toString(),

        blockNumber:
          input.transfer.blockNumber,

        transactionIndex:
          input.transfer.transactionIndex,

        confirmations:
          input.transfer.confirmations,
      }),
      now,
    );

    db.prepare(`
      UPDATE payment_attempts

      SET
        status = 'VERIFIED',
        tx_hash = ?,
        updated_at = ?

      WHERE id = ?
    `).run(
      txHash,
      now,
      context.attemptId,
    );

    db.prepare(`
      UPDATE founding_orders

      SET
        status = 'PAID',
        updated_at = ?

      WHERE id = ?
    `).run(
      now,
      context.orderId,
    );

      const membershipResult =
        createMembershipForPaidOrderWithinTransaction({
          orderId:
            context.orderId,
        });

      const orderEmailRow =
        db.prepare(`
          SELECT email
          FROM founding_orders
          WHERE id = ?
        `).get(
          context.orderId,
        ) as
          | {
              email: string;
            }
          | undefined;

      if (!orderEmailRow) {
        throw new Error(
          "SETTLEMENT_ORDER_EMAIL_NOT_FOUND",
        );
      }

      queueFoundingEmailWithinTransaction({
        recipientEmail:
          orderEmailRow.email,

        template:
          "PAYMENT_VERIFIED",

        payload: {
          orderPublicId:
            context.orderPublicId,
        },

        idempotencyKey:
          `payment:${settlementId}`,
      });

      queueFoundingEmailWithinTransaction({
        recipientEmail:
          orderEmailRow.email,

        template:
          "MEMBERSHIP_CREATED",

        payload: {
          orderPublicId:
            context.orderPublicId,

          membershipPublicId:
            membershipResult.membership.publicId,

          serialNumber:
            membershipResult.membership.serialNumber,

          genesisMember:
            membershipResult.membership.genesisMember,
        },

        idempotencyKey:
          `membership-created:${membershipResult.membership.publicId}`,
      });


    createAuditEvent({
      eventType:
        "USDT_PAYMENT_SETTLED",

      entityType:
        "FOUNDING_ORDER",

      entityId:
        context.orderId,

      payload: {
        orderPublicId:
          context.orderPublicId,

        paymentAttemptPublicId:
          context.attemptPublicId,

        txHash,

        senderAddress:
          input.transfer.senderAddress,

        receiverAddress:
          input.transfer.receiverAddress,

        amountMinor:
          input.transfer.amountMinor
            .toString(),

        confirmations:
          input.transfer.confirmations,

        serialNumber:
          allocation.serialNumber,
      },
    });

    db.exec(
      "COMMIT",
    );

    return {
      settlementId,

      txHash,

      orderPublicId:
        context.orderPublicId,

      orderStatus:
        "PAID" as const,

      paymentStatus:
        "VERIFIED" as const,

      serialNumber:
        allocation.serialNumber,

      phaseCode:
        allocation.phaseCode,

      phaseTransitioned:
        allocation.phaseTransitioned,
    };
  } catch (error) {
    try {
      db.exec(
        "ROLLBACK",
      );
    } catch {
      // Transaction already closed.
    }

    throw error;
  }
}
