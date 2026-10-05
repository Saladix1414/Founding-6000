import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  getAddress,
} from "ethers";

const databasePath =
  process.env.DATABASE_PATH;

if (!databasePath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(
    databasePath,
  );

for (
  const file of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

/*
 * Core DB first.
 */
const {
  db,
  initializeDatabase,
} = await import(
  "../db/database.js"
);

initializeDatabase();

const {
  ensureMembershipSchema,
} = await import(
  "../db/membershipSchema.js"
);

const {
  ensureEmailOutboxSchema,
} = await import(
  "../db/emailOutboxSchema.js"
);

ensureMembershipSchema();
ensureEmailOutboxSchema();

const {
  createOrder,
} = await import(
  "../services/orderService.js"
);

const {
  createUsdtPaymentAttempt,
  submitUsdtTransactionHash,
} = await import(
  "../services/usdtPaymentService.js"
);

const {
  processUsdtAttempt,
} = await import(
  "../services/usdtVerificationPipeline.js"
);

const {
  USDT_VERIFICATION_LEASE_MS,
  claimUsdtAttemptsAwaitingVerification,
  recoverStaleUsdtVerificationClaims,
  updateUsdtAttemptStatus,
} = await import(
  "../repositories/usdtVerificationRepository.js"
);

const {
  getUsdtRuntimeConfig,
} = await import(
  "../web3/usdtConfig.js"
);

import type {
  VerificationFunction,
} from "../services/usdtVerificationPipeline.js";

const config =
  getUsdtRuntimeConfig();

const sender =
  getAddress(
    "0x1111111111111111111111111111111111111111",
  );

let sequence =
  0;

function nextHash() {
  sequence += 1;

  return (
    "0x" +
    sequence
      .toString(16)
      .padStart(
        64,
        "0",
      )
  );
}

function createSubmittedAttempt(
  label: string,
) {
  const order =
    createOrder({
      email:
        `s1d-${label}@example.com`,

      idempotencyKey:
        `s1d-order-${label}`,
    });

  const attempt =
    createUsdtPaymentAttempt({
      orderPublicId:
        order.order.publicId,

      idempotencyKey:
        `s1d-attempt-${label}`,
    });

  const txHash =
    nextHash();

  submitUsdtTransactionHash({
    paymentAttemptPublicId:
      attempt.attempt.publicId,

    txHash,
  });

  const row =
    db.prepare(`
      SELECT
        id,
        public_id AS publicId,
        order_id AS orderId

      FROM payment_attempts

      WHERE public_id = ?
    `).get(
      attempt.attempt.publicId,
    ) as {
      id: string;
      publicId: string;
      orderId: string;
    };

  return {
    orderPublicId:
      order.order.publicId,

    attemptPublicId:
      attempt.attempt.publicId,

    attemptId:
      row.id,

    orderId:
      row.orderId,

    txHash,
  };
}

function getAttempt(
  publicId: string,
) {
  return db.prepare(`
    SELECT
      id,
      public_id AS publicId,
      status,
      tx_hash AS txHash,

      verification_attempts AS verificationAttempts,

      verification_started_at AS verificationStartedAt,

      next_verification_at AS nextVerificationAt,

      last_verification_error AS lastVerificationError,

      updated_at AS updatedAt

    FROM payment_attempts

    WHERE public_id = ?
  `).get(
    publicId,
  ) as {
    id: string;
    publicId: string;
    status: string;
    txHash: string;
    verificationAttempts: number;
    verificationStartedAt:
      string | null;
    nextVerificationAt:
      string | null;
    lastVerificationError:
      string | null;
    updatedAt: string;
  };
}

function makeValidVerifier(
  expectedHash: string,
): VerificationFunction {
  return async (input) => {
    if (
      input.txHash !==
      expectedHash
    ) {
      throw new Error(
        "TRANSACTION_NOT_FOUND",
      );
    }

    return {
      txHash:
        expectedHash
          .toLowerCase(),

      chainId:
        1,

      tokenContract:
        config.tokenContract,

      senderAddress:
        sender,

      receiverAddress:
        getAddress(
          input.expectedReceiver,
        ),

      amountMinor:
        input.expectedAmountMinor,

      blockNumber:
        1000,

      transactionIndex:
        1,

      confirmations:
        12,
    };
  };
}

function throwingVerifier(
  reason: string,
): VerificationFunction {
  return async () => {
    throw new Error(
      reason,
    );
  };
}

function claimSpecific(
  publicId: string,
) {
  const claimed =
    claimUsdtAttemptsAwaitingVerification(
      100,
    );

  const result =
    claimed.find(
      (item) =>
        item.publicId ===
        publicId,
    );

  if (!result) {
    throw new Error(
      `EXPECTED_CLAIM_NOT_FOUND_${publicId}`,
    );
  }

  return result;
}

try {
  console.log("");
  console.log(
    "[TEST 1] Atomic claim",
  );

  const atomic =
    createSubmittedAttempt(
      "atomic",
    );

  const firstClaim =
    claimUsdtAttemptsAwaitingVerification(
      100,
    );

  const claimedAtomic =
    firstClaim.find(
      (item) =>
        item.publicId ===
        atomic.attemptPublicId,
    );

  if (!claimedAtomic) {
    throw new Error(
      "FIRST_ATOMIC_CLAIM_FAILED",
    );
  }

  const secondClaim =
    claimUsdtAttemptsAwaitingVerification(
      100,
    );

  if (
    secondClaim.some(
      (item) =>
        item.publicId ===
        atomic.attemptPublicId,
    )
  ) {
    throw new Error(
      "SECOND_WORKER_CLAIMED_ACTIVE_LEASE",
    );
  }

  console.log(
    "[PASS] Second worker cannot claim active VERIFYING lease",
  );

  updateUsdtAttemptStatus({
    attemptId:
      atomic.attemptId,

    status:
      "REJECTED",

    lastVerificationError:
      "TEST_CLEANUP",
  });

  console.log("");
  console.log(
    "[TEST 2] Stale lease recovery",
  );

  const stale =
    createSubmittedAttempt(
      "stale",
    );

  const staleClaim =
    claimSpecific(
      stale.attemptPublicId,
    );

  const now =
    new Date();

  const staleTimestamp =
    new Date(
      now.getTime() -
        USDT_VERIFICATION_LEASE_MS -
        60_000,
    ).toISOString();

  db.prepare(`
    UPDATE payment_attempts

    SET
      verification_started_at = ?,
      updated_at = ?

    WHERE id = ?
  `).run(
    staleTimestamp,
    staleTimestamp,
    staleClaim.id,
  );

  recoverStaleUsdtVerificationClaims(
    now,
  );

  const afterRecovery =
    getAttempt(
      stale.attemptPublicId,
    );

  if (
    afterRecovery.status !==
      "SUBMITTED" ||
    afterRecovery
      .verificationStartedAt !==
        null ||
    !afterRecovery
      .nextVerificationAt
  ) {
    throw new Error(
      "STALE_VERIFYING_NOT_RECOVERED",
    );
  }

  const reclaimed =
    claimUsdtAttemptsAwaitingVerification(
      100,
      new Date(
        now.getTime() +
          1000,
      ),
    ).find(
      (item) =>
        item.publicId ===
        stale.attemptPublicId,
    );

  if (!reclaimed) {
    throw new Error(
      "RECOVERED_ATTEMPT_NOT_RECLAIMABLE",
    );
  }

  console.log(
    "[PASS] Expired VERIFYING lease recovered and reclaimed",
  );

  updateUsdtAttemptStatus({
    attemptId:
      stale.attemptId,

    status:
      "REJECTED",

    lastVerificationError:
      "TEST_CLEANUP",
  });

  console.log("");
  console.log(
    "[TEST 3] Insufficient confirmations",
  );

  const confirmations =
    createSubmittedAttempt(
      "confirmations",
    );

  const confirmationClaim =
    claimSpecific(
      confirmations.attemptPublicId,
    );

  const confirmationResult =
    await processUsdtAttempt(
      confirmationClaim,

      throwingVerifier(
        "INSUFFICIENT_CONFIRMATIONS",
      ),

      {
        testSettlementAuthority:
          false,
      },
    );

  if (
    confirmationResult.outcome !==
      "AWAITING_CONFIRMATIONS"
  ) {
    throw new Error(
      "WRONG_CONFIRMATION_OUTCOME",
    );
  }

  const confirmationRow =
    getAttempt(
      confirmations.attemptPublicId,
    );

  if (
    confirmationRow.status !==
      "SUBMITTED" ||
    confirmationRow
      .verificationStartedAt !==
        null ||
    !confirmationRow
      .nextVerificationAt ||
    confirmationRow
      .lastVerificationError !==
        "INSUFFICIENT_CONFIRMATIONS"
  ) {
    throw new Error(
      "CONFIRMATION_RETRY_STATE_FAILED",
    );
  }

  console.log(
    "[PASS] Insufficient confirmations released for retry",
  );

  console.log("");
  console.log(
    "[TEST 4] Transaction not found",
  );

  const notFound =
    createSubmittedAttempt(
      "not-found",
    );

  const notFoundClaim =
    claimSpecific(
      notFound.attemptPublicId,
    );

  const notFoundResult =
    await processUsdtAttempt(
      notFoundClaim,

      throwingVerifier(
        "TRANSACTION_NOT_FOUND",
      ),

      {
        testSettlementAuthority:
          false,
      },
    );

  if (
    notFoundResult.outcome !==
      "NOT_FOUND_YET"
  ) {
    throw new Error(
      "WRONG_NOT_FOUND_OUTCOME",
    );
  }

  const notFoundRow =
    getAttempt(
      notFound.attemptPublicId,
    );

  if (
    notFoundRow.status !==
      "SUBMITTED" ||
    !notFoundRow
      .nextVerificationAt ||
    notFoundRow
      .lastVerificationError !==
        "TRANSACTION_NOT_FOUND"
  ) {
    throw new Error(
      "NOT_FOUND_RETRY_STATE_FAILED",
    );
  }

  console.log(
    "[PASS] Missing transaction scheduled for retry",
  );

  console.log("");
  console.log(
    "[TEST 5] Infrastructure exponential backoff",
  );

  const infrastructure =
    createSubmittedAttempt(
      "infra",
    );

  const infraClaim1 =
    claimSpecific(
      infrastructure.attemptPublicId,
    );

  const beforeFailure1 =
    Date.now();

  let infraError1 =
    false;

  try {
    await processUsdtAttempt(
      infraClaim1,

      throwingVerifier(
        "RPC_TEMPORARY_FAILURE",
      ),
    );
  } catch (
    error
  ) {
    infraError1 =
      error instanceof Error &&
      error.message ===
        "RPC_TEMPORARY_FAILURE";
  }

  if (!infraError1) {
    throw new Error(
      "INFRASTRUCTURE_ERROR_NOT_PROPAGATED",
    );
  }

  const infraRow1 =
    getAttempt(
      infrastructure.attemptPublicId,
    );

  if (
    infraRow1.status !==
      "SUBMITTED" ||
    infraRow1
      .verificationAttempts !== 1 ||
    !infraRow1
      .nextVerificationAt ||
    infraRow1
      .lastVerificationError !==
        "VERIFICATION_INFRASTRUCTURE_ERROR"
  ) {
    throw new Error(
      "INFRA_RETRY_ONE_FAILED",
    );
  }

  const delay1 =
    new Date(
      infraRow1
        .nextVerificationAt,
    ).getTime() -
    beforeFailure1;

  if (
    delay1 < 55_000 ||
    delay1 > 70_000
  ) {
    throw new Error(
      `INFRA_FIRST_BACKOFF_INVALID_${delay1}`,
    );
  }

  /*
   * Force retry eligible.
   */
  db.prepare(`
    UPDATE payment_attempts

    SET next_verification_at = ?

    WHERE public_id = ?
  `).run(
    "2000-01-01T00:00:00.000Z",
    infrastructure.attemptPublicId,
  );

  const infraClaim2 =
    claimSpecific(
      infrastructure.attemptPublicId,
    );

  const beforeFailure2 =
    Date.now();

  let infraError2 =
    false;

  try {
    await processUsdtAttempt(
      infraClaim2,

      throwingVerifier(
        "RPC_TEMPORARY_FAILURE",
      ),
    );
  } catch (
    error
  ) {
    infraError2 =
      error instanceof Error &&
      error.message ===
        "RPC_TEMPORARY_FAILURE";
  }

  if (!infraError2) {
    throw new Error(
      "SECOND_INFRASTRUCTURE_ERROR_NOT_PROPAGATED",
    );
  }

  const infraRow2 =
    getAttempt(
      infrastructure.attemptPublicId,
    );

  const delay2 =
    new Date(
      infraRow2
        .nextVerificationAt!,
    ).getTime() -
    beforeFailure2;

  if (
    infraRow2
      .verificationAttempts !== 2 ||
    delay2 < 115_000 ||
    delay2 > 135_000
  ) {
    throw new Error(
      `INFRA_SECOND_BACKOFF_INVALID_${delay2}`,
    );
  }

  console.log(
    "[PASS] Infrastructure retry uses exponential backoff",
  );

  console.log("");
  console.log(
    "[TEST 6] Permanent verification failure",
  );

  const permanent =
    createSubmittedAttempt(
      "permanent",
    );

  const permanentClaim =
    claimSpecific(
      permanent.attemptPublicId,
    );

  const permanentResult =
    await processUsdtAttempt(
      permanentClaim,

      throwingVerifier(
        "WRONG_CHAIN",
      ),
    );

  if (
    permanentResult.outcome !==
      "REJECTED"
  ) {
    throw new Error(
      "PERMANENT_FAILURE_NOT_REJECTED",
    );
  }

  const permanentRow =
    getAttempt(
      permanent.attemptPublicId,
    );

  if (
    permanentRow.status !==
      "REJECTED" ||
    permanentRow
      .nextVerificationAt !==
        null ||
    permanentRow
      .verificationStartedAt !==
        null ||
    permanentRow
      .lastVerificationError !==
        "WRONG_CHAIN"
  ) {
    throw new Error(
      "PERMANENT_FAILURE_STATE_INVALID",
    );
  }

  console.log(
    "[PASS] Permanent failure is terminal REJECTED",
  );

  console.log("");
  console.log(
    "[TEST 7] Payment guard blocks settlement",
  );

  const guarded =
    createSubmittedAttempt(
      "guard",
    );

  const guardClaim =
    claimSpecific(
      guarded.attemptPublicId,
    );

  const guardResult =
    await processUsdtAttempt(
      guardClaim,

      makeValidVerifier(
        guarded.txHash,
      ),

      {
        testSettlementAuthority:
          false,
      },
    );

  if (
    guardResult.outcome !==
      "BLOCKED_BY_PAYMENT_GUARD"
  ) {
    throw new Error(
      "PAYMENT_GUARD_OUTCOME_FAILED",
    );
  }

  const guardedAttempt =
    getAttempt(
      guarded.attemptPublicId,
    );

  const guardedOrder =
    db.prepare(`
      SELECT status

      FROM founding_orders

      WHERE public_id = ?
    `).get(
      guarded.orderPublicId,
    ) as {
      status: string;
    };

  const guardedSettlements =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM payment_settlements

      WHERE payment_attempt_id = ?
    `).get(
      guarded.attemptId,
    ) as {
      count: number;
    };

  const guardedAllocations =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM inventory_allocations

      WHERE order_id = ?
    `).get(
      guarded.orderId,
    ) as {
      count: number;
    };

  if (
    guardedAttempt.status !==
      "SUBMITTED" ||
    !guardedAttempt
      .nextVerificationAt ||
    guardedOrder.status ===
      "PAID" ||
    Number(
      guardedSettlements.count,
    ) !== 0 ||
    Number(
      guardedAllocations.count,
    ) !== 0
  ) {
    throw new Error(
      "PAYMENT_GUARD_MUTATED_AUTHORITATIVE_STATE",
    );
  }

  console.log(
    "[PASS] Guard prevents settlement, allocation and PAID status",
  );

  console.log("");
  console.log(
    "[TEST 8] Valid verification settles exactly once",
  );

  const valid =
    createSubmittedAttempt(
      "valid",
    );

  const validClaim =
    claimSpecific(
      valid.attemptPublicId,
    );

  const validResult =
    await processUsdtAttempt(
      validClaim,

      makeValidVerifier(
        valid.txHash,
      ),

      {
        testSettlementAuthority:
          true,
      },
    );

  if (
    validResult.outcome !==
      "VERIFIED"
  ) {
    throw new Error(
      "VALID_PAYMENT_NOT_VERIFIED",
    );
  }

  const validAttempt =
    getAttempt(
      valid.attemptPublicId,
    );

  const validOrder =
    db.prepare(`
      SELECT status

      FROM founding_orders

      WHERE public_id = ?
    `).get(
      valid.orderPublicId,
    ) as {
      status: string;
    };

  const validSettlements =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM payment_settlements

      WHERE payment_attempt_id = ?
    `).get(
      valid.attemptId,
    ) as {
      count: number;
    };

  const validAllocations =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM inventory_allocations

      WHERE order_id = ?
        AND status = 'ALLOCATED'
    `).get(
      valid.orderId,
    ) as {
      count: number;
    };

  const validMemberships =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM founding_memberships

      WHERE order_id = ?
    `).get(
      valid.orderId,
    ) as {
      count: number;
    };

  if (
    validAttempt.status !==
      "VERIFIED" ||
    validOrder.status !==
      "PAID" ||
    Number(
      validSettlements.count,
    ) !== 1 ||
    Number(
      validAllocations.count,
    ) !== 1 ||
    Number(
      validMemberships.count,
    ) !== 1
  ) {
    throw new Error(
      "VALID_SETTLEMENT_STATE_INVALID",
    );
  }

  console.log(
    "[PASS] Verified transfer created exactly one settlement/allocation/membership",
  );

  console.log("");
  console.log(
    "[TEST 9] Verified attempt cannot be claimed again",
  );

  const replayClaims =
    claimUsdtAttemptsAwaitingVerification(
      100,
    );

  if (
    replayClaims.some(
      (item) =>
        item.publicId ===
        valid.attemptPublicId,
    )
  ) {
    throw new Error(
      "VERIFIED_ATTEMPT_RECLAIMED",
    );
  }

  const settlementCountAfterReplay =
    db.prepare(`
      SELECT COUNT(*) AS count

      FROM payment_settlements

      WHERE payment_attempt_id = ?
    `).get(
      valid.attemptId,
    ) as {
      count: number;
    };

  if (
    Number(
      settlementCountAfterReplay.count,
    ) !== 1
  ) {
    throw new Error(
      "SETTLEMENT_DUPLICATED",
    );
  }

  console.log(
    "[PASS] Second worker cannot duplicate settlement",
  );

  console.log("");
  console.log(
    "============================================================",
  );

  console.log(
    " S1-D USDT WORKER TEST PASS",
  );

  console.log(
    "============================================================",
  );

  console.log(
    "ATOMIC_USDT_CLAIM=PASS",
  );

  console.log(
    "ACTIVE_LEASE_EXCLUSIVE=PASS",
  );

  console.log(
    "STALE_LEASE_RECOVERY=PASS",
  );

  console.log(
    "CONFIRMATION_RETRY=PASS",
  );

  console.log(
    "TX_NOT_FOUND_RETRY=PASS",
  );

  console.log(
    "INFRASTRUCTURE_BACKOFF=PASS",
  );

  console.log(
    "PERMANENT_FAILURE=REJECTED",
  );

  console.log(
    "PAYMENT_GUARD=PASS",
  );

  console.log(
    "SETTLEMENT_EXACTLY_ONCE=PASS",
  );

  console.log(
    "INVENTORY_EXACTLY_ONCE=PASS",
  );

  console.log(
    "MEMBERSHIP_EXACTLY_ONCE=PASS",
  );

  console.log(
    "REAL_BLOCKCHAIN_CALLS=NO",
  );
} finally {
  db.close();
}
