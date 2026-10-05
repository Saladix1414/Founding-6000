import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(dbPath);

for (const path of [
  resolved,
  `${resolved}-wal`,
  `${resolved}-shm`,
]) {
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

initializeDatabase();

console.log("");
console.log(
  "[P3 PART 4] Creating order...",
);

const order =
  createOrder({
    email:
      "checkout-simulation@example.com",

    idempotencyKey:
      "checkout-simulation-order",
  });

if (
  order.order.status !==
  "CREATED"
) {
  throw new Error(
    "ORDER_NOT_CREATED",
  );
}

console.log(
  "[PASS] Order CREATED",
);

const attempt =
  createUsdtPaymentAttempt({
    orderPublicId:
      order.order.publicId,

    idempotencyKey:
      "checkout-simulation-attempt",
  });

if (
  attempt.attempt.expectedAmountMinor !==
  50_000_000
) {
  throw new Error(
    "EXPECTED_AMOUNT_NOT_50_USDT",
  );
}

console.log(
  "[PASS] Expected amount = 50 USDT",
);

if (
  attempt.attempt.network !==
  "ethereum-mainnet"
) {
  throw new Error(
    "NETWORK_NOT_ETHEREUM_MAINNET",
  );
}

console.log(
  "[PASS] Ethereum Mainnet",
);

const fakeTxHash =
  "0x" +
  "b".repeat(64);

const submitted =
  submitUsdtTransactionHash({
    paymentAttemptPublicId:
      attempt.attempt.publicId,

    txHash:
      fakeTxHash,
  });

if (
  submitted.attempt.status !==
  "SUBMITTED"
) {
  throw new Error(
    "ATTEMPT_NOT_SUBMITTED",
  );
}

console.log(
  "[PASS] txHash accepted as evidence",
);

const storedOrder =
  db.prepare(`
    SELECT
      status
    FROM founding_orders
    WHERE public_id = ?
  `).get(
    order.order.publicId,
  ) as {
    status: string;
  };

if (
  storedOrder.status ===
  "PAID"
) {
  throw new Error(
    "UNVERIFIED_HASH_MARKED_ORDER_PAID",
  );
}

console.log(
  "[PASS] Order NOT marked PAID",
);

const settlements =
  db.prepare(`
    SELECT
      COUNT(*) AS count
    FROM payment_settlements
  `).get() as {
    count: number;
  };

if (
  Number(
    settlements.count,
  ) !== 0
) {
  throw new Error(
    "UNVERIFIED_HASH_CREATED_SETTLEMENT",
  );
}

console.log(
  "[PASS] No settlement created",
);

const allocations =
  db.prepare(`
    SELECT
      COUNT(*) AS count
    FROM inventory_allocations
    WHERE status = 'ALLOCATED'
  `).get() as {
    count: number;
  };

if (
  Number(
    allocations.count,
  ) !== 0
) {
  throw new Error(
    "UNVERIFIED_HASH_ALLOCATED_INVENTORY",
  );
}

console.log(
  "[PASS] No inventory allocated",
);

const audit =
  db.prepare(`
    SELECT
      COUNT(*) AS count
    FROM audit_events
    WHERE event_type =
      'USDT_TX_HASH_SUBMITTED'
  `).get() as {
    count: number;
  };

if (
  Number(
    audit.count,
  ) !== 1
) {
  throw new Error(
    "TX_SUBMISSION_AUDIT_MISSING",
  );
}

console.log(
  "[PASS] Submission audited",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " P3 CHECKOUT SIMULATION PASS",
);

console.log(
  "============================================",
);

console.log(
  "Order created: PASS",
);

console.log(
  "50 USDT attempt: PASS",
);

console.log(
  "Ethereum Mainnet: PASS",
);

console.log(
  "txHash submission: PASS",
);

console.log(
  "Payment verification: NOT PERFORMED",
);

console.log(
  "Order PAID: NO",
);

console.log(
  "Settlement created: NO",
);

console.log(
  "Inventory allocated: NO",
);

console.log(
  "Real payment: DISABLED",
);

db.close();
