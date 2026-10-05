import { env } from "../config/env.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  claimUsdtAttemptsAwaitingVerification,
  releaseUsdtAttemptForRetry,
  updateUsdtAttemptStatus,
  type PendingVerificationRow,
} from "../repositories/usdtVerificationRepository.js";

import {
  settleVerifiedUsdtTransfer,
} from "./usdtSettlementService.js";

import {
  verifyUsdtTransactionOnChain,
  type VerifiedUsdtTransfer,
} from "../web3/usdtVerifier.js";

export type VerificationFunction =
  (
    input: {
      txHash: string;
      expectedReceiver: string;
      expectedAmountMinor: bigint;
    },
  ) => Promise<VerifiedUsdtTransfer>;

export type VerificationResult =
  | {
      publicId: string;
      outcome:
        "VERIFIED";
    }
  | {
      publicId: string;
      outcome:
        "AWAITING_CONFIRMATIONS";
    }
  | {
      publicId: string;
      outcome:
        "NOT_FOUND_YET";
    }
  | {
      publicId: string;
      outcome:
        "BLOCKED_BY_PAYMENT_GUARD";
    }
  | {
      publicId: string;
      outcome:
        "REJECTED";
      reason: string;
    };

function settlementAuthorityEnabled() {
  return (
    env.REAL_PAYMENTS_ENABLED ===
      true &&
    env.PAYMENT_READINESS ===
      true
  );
}

function auditPipelineEvent(
  input: {
    attemptId: string;
    publicId: string;
    eventType: string;
    payload?:
      Record<string, unknown>;
  },
) {
  createAuditEvent({
    eventType:
      input.eventType,

    entityType:
      "PAYMENT_ATTEMPT",

    entityId:
      input.attemptId,

    payload: {
      paymentAttemptPublicId:
        input.publicId,

      ...(input.payload ?? {}),
    },
  });
}

export async function processUsdtAttempt(
  attempt:
    PendingVerificationRow,

  verifier:
    VerificationFunction =
      verifyUsdtTransactionOnChain,

  options?: {
    testSettlementAuthority?:
      boolean;
  },
): Promise<VerificationResult> {
  /*
   * IMPORTANT:
   *
   * The attempt already owns an exclusive VERIFYING
   * lease before this function is called.
   *
   * SUBMITTED -> VERIFYING happens atomically inside
   * claimUsdtAttemptsAwaitingVerification().
   */
  auditPipelineEvent({
    attemptId:
      attempt.id,

    publicId:
      attempt.publicId,

    eventType:
      "USDT_VERIFICATION_STARTED",

    payload: {
      txHash:
        attempt.txHash,

      verificationAttempt:
        attempt.verificationAttempts,
    },
  });

  try {
    const transfer =
      await verifier({
        txHash:
          attempt.txHash,

        expectedReceiver:
          attempt.receiverAddress,

        expectedAmountMinor:
          BigInt(
            attempt.expectedAmountMinor,
          ),
      });

    const testAuthority =
      env.NODE_ENV === "test" &&
      options
        ?.testSettlementAuthority ===
        true;

    /*
     * Chain evidence may be valid while settlement
     * authority is deliberately disabled.
     *
     * In that situation we do NOT mark VERIFIED and
     * do NOT leave an infinite VERIFYING lease.
     */
    if (
      !settlementAuthorityEnabled() &&
      !testAuthority
    ) {
      auditPipelineEvent({
        attemptId:
          attempt.id,

        publicId:
          attempt.publicId,

        eventType:
          "USDT_CHAIN_VERIFIED_SETTLEMENT_BLOCKED",

        payload: {
          txHash:
            transfer.txHash,

          realPaymentsEnabled:
            env.REAL_PAYMENTS_ENABLED,

          paymentReadiness:
            env.PAYMENT_READINESS,
        },
      });

      releaseUsdtAttemptForRetry({
        attemptId:
          attempt.id,

        reason:
          "PAYMENT_GUARD_DISABLED",

        delayMs:
          5 * 60 * 1000,
      });

      return {
        publicId:
          attempt.publicId,

        outcome:
          "BLOCKED_BY_PAYMENT_GUARD",
      };
    }

    /*
     * The settlement service remains the sole
     * authoritative transition to VERIFIED / PAID.
     */
    settleVerifiedUsdtTransfer({
      paymentAttemptPublicId:
        attempt.publicId,

      transfer,
    });

    return {
      publicId:
        attempt.publicId,

      outcome:
        "VERIFIED",
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "UNKNOWN_VERIFICATION_ERROR";

    /*
     * Expected transient blockchain state:
     * transaction exists but needs more confirmations.
     */
    if (
      reason ===
        "INSUFFICIENT_CONFIRMATIONS"
    ) {
      releaseUsdtAttemptForRetry({
        attemptId:
          attempt.id,

        reason:
          "INSUFFICIENT_CONFIRMATIONS",

        delayMs:
          60 * 1000,
      });

      return {
        publicId:
          attempt.publicId,

        outcome:
          "AWAITING_CONFIRMATIONS",
      };
    }

    /*
     * RPC/indexing propagation may temporarily make
     * a freshly submitted transaction unavailable.
     */
    if (
      reason ===
        "TRANSACTION_NOT_FOUND"
    ) {
      releaseUsdtAttemptForRetry({
        attemptId:
          attempt.id,

        reason:
          "TRANSACTION_NOT_FOUND",

        delayMs:
          2 * 60 * 1000,
      });

      return {
        publicId:
          attempt.publicId,

        outcome:
          "NOT_FOUND_YET",
      };
    }

    const permanentFailures =
      new Set([
        "WRONG_CHAIN",
        "TRANSACTION_FAILED",
        "EXPECTED_USDT_TRANSFER_NOT_FOUND",
        "AMBIGUOUS_USDT_TRANSFER",
        "INVALID_TX_HASH",
        "INVALID_BLOCK_CONFIRMATION_STATE",
      ]);

    if (
      permanentFailures.has(
        reason,
      )
    ) {
      updateUsdtAttemptStatus({
        attemptId:
          attempt.id,

        status:
          "REJECTED",

        lastVerificationError:
          reason,
      });

      auditPipelineEvent({
        attemptId:
          attempt.id,

        publicId:
          attempt.publicId,

        eventType:
          "USDT_VERIFICATION_REJECTED",

        payload: {
          reason,
        },
      });

      return {
        publicId:
          attempt.publicId,

        outcome:
          "REJECTED",

        reason,
      };
    }

    /*
     * Unexpected infrastructure error.
     *
     * Attempt 1 -> 60 seconds
     * Attempt 2 -> 120 seconds
     * Attempt 3 -> 240 seconds
     * ...
     * capped at 15 minutes.
     */
    const retryDelayMs =
      Math.min(
        60 * 1000 *
          2 **
            Math.max(
              attempt.verificationAttempts -
                1,
              0,
            ),

        15 * 60 * 1000,
      );

    releaseUsdtAttemptForRetry({
      attemptId:
        attempt.id,

      reason:
        "VERIFICATION_INFRASTRUCTURE_ERROR",

      delayMs:
        retryDelayMs,
    });

    throw error;
  }
}

export async function processPendingUsdtVerifications(
  input?: {
    limit?: number;

    verifier?:
      VerificationFunction;

    testSettlementAuthority?:
      boolean;
  },
) {
  const attempts =
    claimUsdtAttemptsAwaitingVerification(
      input?.limit ?? 20,
    );

  const results:
    VerificationResult[] =
    [];

  for (
    const attempt of attempts
  ) {
    const result =
      await processUsdtAttempt(
        attempt,

        input?.verifier ??
          verifyUsdtTransactionOnChain,

        {
          testSettlementAuthority:
            input
              ?.testSettlementAuthority,
        },
      );

    results.push(
      result,
    );
  }

  return results;
}
