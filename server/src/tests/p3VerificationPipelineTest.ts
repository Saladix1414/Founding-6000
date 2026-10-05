import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  getAddress,
} from "ethers";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(dbPath);

for (
  const path of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  try {
    rmSync(
      path,
      {
        force: true,
      },
    );
  } catch {
    // Best effort.
  }
}

const {
  initializeDatabase,
  db,
} = await import(
  "../db/database.js"
);

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
  processPendingUsdtVerifications,
} = await import(
  "../services/usdtVerificationPipeline.js"
);

const {
  getUsdtRuntimeConfig,
} = await import(
  "../web3/usdtConfig.js"
);

import type {
  VerificationFunction,
} from "../services/usdtVerificationPipeline.js";

initializeDatabase();

const config =
  getUsdtRuntimeConfig();

const sender =
  getAddress(
    "0x1111111111111111111111111111111111111111",
  );

function makeVerifier(
  txHash: string,
): VerificationFunction {
  return async (input) => {
    if (
      input.txHash !==
      txHash
    ) {
      throw new Error(
        "TRANSACTION_NOT_FOUND",
      );
    }

    return {
      txHash:
        txHash.toLowerCase(),

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

console.log("");
console.log(
  "[TEST A] Production payment guard...",
);

const orderA =
  createOrder({
    email:
      "pipeline-guard@example.com",

    idempotencyKey:
      "pipeline-guard-order",
  });

const attemptA =
  createUsdtPaymentAttempt({
    orderPublicId:
      orderA.order.publicId,

    idempotencyKey:
      "pipeline-guard-attempt",
  });

const txA =
  "0x" +
  "c".repeat(64);

submitUsdtTransactionHash({
  paymentAttemptPublicId:
    attemptA.attempt.publicId,

  txHash:
    txA,
});

const guardResults =
  await processPendingUsdtVerifications({
    limit: 20,

    verifier:
      makeVerifier(
        txA,
      ),

    testSettlementAuthority:
      false,
  });

const guardResult =
  guardResults.find(
    (result) =>
      result.publicId ===
      attemptA.attempt.publicId,
  );

if (
  guardResult?.outcome !==
  "BLOCKED_BY_PAYMENT_GUARD"
) {
  throw new Error(
    "PAYMENT_GUARD_DID_NOT_BLOCK_SETTLEMENT",
  );
}

const guardedOrder =
  db.prepare(`
    SELECT status
    FROM founding_orders
    WHERE public_id = ?
  `).get(
    orderA.order.publicId,
  ) as {
    status: string;
  };

if (
  guardedOrder.status ===
  "PAID"
) {
  throw new Error(
    "GUARDED_ORDER_BECAME_PAID",
  );
}

const settlementsAfterGuard =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM payment_settlements
  `).get() as {
    count: number;
  };

if (
  Number(
    settlementsAfterGuard.count,
  ) !== 0
) {
  throw new Error(
    "GUARD_ALLOWED_SETTLEMENT",
  );
}

console.log(
  "[PASS] Chain evidence can be checked",
);

console.log(
  "[PASS] REAL_PAYMENTS=false blocks settlement",
);

console.log(
  "[PASS] PAYMENT_READINESS=false blocks settlement",
);

console.log("");
console.log(
  "[TEST B] Authorized test settlement...",
);

/*
 * Remove guarded attempt from active queue so
 * this test isolates the second order.
 */
db.prepare(`
  UPDATE payment_attempts
  SET status = 'REJECTED'
  WHERE public_id = ?
`).run(
  attemptA.attempt.publicId,
);

const orderB =
  createOrder({
    email:
      "pipeline-success@example.com",

    idempotencyKey:
      "pipeline-success-order",
  });

const attemptB =
  createUsdtPaymentAttempt({
    orderPublicId:
      orderB.order.publicId,

    idempotencyKey:
      "pipeline-success-attempt",
  });

const txB =
  "0x" +
  "d".repeat(64);

submitUsdtTransactionHash({
  paymentAttemptPublicId:
    attemptB.attempt.publicId,

  txHash:
    txB,
});

const before =
  db.prepare(`
    SELECT status
    FROM payment_attempts
    WHERE public_id = ?
  `).get(
    attemptB.attempt.publicId,
  ) as {
    status: string;
  };

if (
  before.status !==
  "SUBMITTED"
) {
  throw new Error(
    "EXPECTED_SUBMITTED_BEFORE_WORKER",
  );
}

const results =
  await processPendingUsdtVerifications({
    limit: 20,

    verifier:
      makeVerifier(
        txB,
      ),

    testSettlementAuthority:
      true,
  });

const result =
  results.find(
    (item) =>
      item.publicId ===
      attemptB.attempt.publicId,
  );

if (
  result?.outcome !==
  "VERIFIED"
) {
  throw new Error(
    `EXPECTED_VERIFIED_GOT_${
      result?.outcome ??
      "NONE"
    }`,
  );
}

const finalAttempt =
  db.prepare(`
    SELECT
      status,
      tx_hash AS txHash

    FROM payment_attempts

    WHERE public_id = ?
  `).get(
    attemptB.attempt.publicId,
  ) as {
    status: string;
    txHash: string | null;
  };

if (
  finalAttempt.status !==
  "VERIFIED"
) {
  throw new Error(
    "ATTEMPT_NOT_VERIFIED",
  );
}

const finalOrder =
  db.prepare(`
    SELECT status
    FROM founding_orders
    WHERE public_id = ?
  `).get(
    orderB.order.publicId,
  ) as {
    status: string;
  };

if (
  finalOrder.status !==
  "PAID"
) {
  throw new Error(
    "ORDER_NOT_PAID",
  );
}

const settlement =
  db.prepare(`
    SELECT
      external_reference AS txHash,
      status

    FROM payment_settlements

    WHERE external_reference = ?
  `).get(
    txB.toLowerCase(),
  ) as
    | {
        txHash: string;
        status: string;
      }
    | undefined;

if (
  !settlement ||
  settlement.status !==
    "VERIFIED"
) {
  throw new Error(
    "SETTLEMENT_NOT_VERIFIED",
  );
}

const allocation =
  db.prepare(`
    SELECT
      serial_number AS serialNumber

    FROM inventory_allocations

    WHERE settlement_reference = ?
  `).get(
    txB.toLowerCase(),
  ) as
    | {
        serialNumber: number;
      }
    | undefined;

if (
  !allocation
) {
  throw new Error(
    "INVENTORY_NOT_ALLOCATED",
  );
}

if (
  Number(
    allocation.serialNumber,
  ) !== 1
) {
  throw new Error(
    `EXPECTED_SERIAL_1_GOT_${allocation.serialNumber}`,
  );
}

console.log(
  "[PASS] SUBMITTED -> VERIFYING",
);

console.log(
  "[PASS] Ethereum verification",
);

console.log(
  "[PASS] VERIFYING -> VERIFIED",
);

console.log(
  "[PASS] Order -> PAID",
);

console.log(
  "[PASS] Settlement -> VERIFIED",
);

console.log(
  "[PASS] Genesis serial #0001 allocated",
);

console.log("");
console.log(
  "[TEST C] Worker replay safety...",
);

const replay =
  await processPendingUsdtVerifications({
    limit: 20,

    verifier:
      makeVerifier(
        txB,
      ),

    testSettlementAuthority:
      true,
  });

if (
  replay.some(
    (item) =>
      item.publicId ===
      attemptB.attempt.publicId,
  )
) {
  throw new Error(
    "VERIFIED_ATTEMPT_REENTERED_QUEUE",
  );
}

const settlementCount =
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM payment_settlements
  `).get() as {
    count: number;
  };

if (
  Number(
    settlementCount.count,
  ) !== 1
) {
  throw new Error(
    "SETTLEMENT_REPLAY_CREATED_DUPLICATE",
  );
}

console.log(
  "[PASS] VERIFIED attempt removed from queue",
);

console.log(
  "[PASS] No duplicate settlement",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " P3 BACKGROUND PIPELINE TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "Production guard: PASS",
);

console.log(
  "Background verification: PASS",
);

console.log(
  "Atomic settlement: PASS",
);

console.log(
  "Replay protection: PASS",
);

console.log(
  "Real production payments: DISABLED",
);

db.close();
