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

try {
  rmSync(
    resolve(dbPath),
    {
      force: true,
    },
  );

  rmSync(
    `${resolve(dbPath)}-wal`,
    {
      force: true,
    },
  );

  rmSync(
    `${resolve(dbPath)}-shm`,
    {
      force: true,
    },
  );
} catch {
  // Clean test database best effort.
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
  allocateInventoryForSettledOrder,
} = await import(
  "../services/inventoryService.js"
);

const {
  getCampaignReadModel,
} = await import(
  "../repositories/campaignRepository.js"
);

initializeDatabase();

console.log("");
console.log(
  "[B2 TEST] Initial campaign",
);

const initial =
  getCampaignReadModel();

if (!initial) {
  throw new Error(
    "CAMPAIGN_NOT_FOUND",
  );
}

if (
  initial.sold !== 0
) {
  throw new Error(
    `EXPECTED_0_SOLD_GOT_${initial.sold}`,
  );
}

if (
  initial.activePhase?.code !==
  "GENESIS"
) {
  throw new Error(
    "GENESIS_NOT_ACTIVE",
  );
}

console.log(
  "[PASS] Genesis active",
);

const genesisOrders:
  Array<{
    publicId: string;
  }> = [];

console.log(
  "[B2 TEST] Creating 1005 Genesis orders...",
);

for (
  let index = 0;
  index < 1005;
  index += 1
) {
  const result =
    createOrder({
      email:
        `b2-${index}@example.com`,

      idempotencyKey:
        `b2-order-${index}`,
    });

  genesisOrders.push({
    publicId:
      result.order.publicId,
  });
}

console.log(
  `[PASS] Created ${genesisOrders.length} pending orders`,
);

let allocated = 0;
let soldOut = 0;
let transitioned = 0;

const serials =
  new Set<number>();

console.log(
  "[B2 TEST] Allocating Genesis capacity...",
);

for (
  let index = 0;
  index < genesisOrders.length;
  index += 1
) {
  const order =
    genesisOrders[index];

  if (!order) {
    throw new Error(
      "ORDER_ARRAY_ERROR",
    );
  }

  try {
    const allocation =
      allocateInventoryForSettledOrder({
        orderPublicId:
          order.publicId,

        settlementReference:
          `B2-SETTLEMENT-${String(
            index,
          ).padStart(
            5,
            "0",
          )}`,
      });

    allocated += 1;

    serials.add(
      allocation.serialNumber,
    );

    if (
      allocation.phaseTransitioned
    ) {
      transitioned += 1;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "PHASE_SOLD_OUT"
    ) {
      soldOut += 1;
      continue;
    }

    throw error;
  }
}

console.log(
  `Allocated: ${allocated}`,
);

console.log(
  `Sold out rejected: ${soldOut}`,
);

if (
  allocated !== 1000
) {
  throw new Error(
    `EXPECTED_1000_ALLOCATED_GOT_${allocated}`,
  );
}

if (
  soldOut !== 5
) {
  throw new Error(
    `EXPECTED_5_SOLD_OUT_GOT_${soldOut}`,
  );
}

if (
  serials.size !== 1000
) {
  throw new Error(
    `EXPECTED_1000_UNIQUE_SERIALS_GOT_${serials.size}`,
  );
}

const sortedSerials =
  [...serials].sort(
    (a, b) => a - b,
  );

if (
  sortedSerials[0] !== 1
) {
  throw new Error(
    "FIRST_SERIAL_NOT_1",
  );
}

if (
  sortedSerials[
    sortedSerials.length - 1
  ] !== 1000
) {
  throw new Error(
    "LAST_GENESIS_SERIAL_NOT_1000",
  );
}

console.log(
  "[PASS] Exactly 1000 Genesis allocations",
);

console.log(
  "[PASS] Exactly 1000 unique serials",
);

console.log(
  "[PASS] Genesis range #0001–#1000",
);

if (
  transitioned !== 1
) {
  throw new Error(
    `EXPECTED_ONE_PHASE_TRANSITION_GOT_${transitioned}`,
  );
}

const afterGenesis =
  getCampaignReadModel();

if (!afterGenesis) {
  throw new Error(
    "CAMPAIGN_MISSING_AFTER_ALLOCATION",
  );
}

if (
  afterGenesis.sold !== 1000
) {
  throw new Error(
    `EXPECTED_CAMPAIGN_SOLD_1000_GOT_${afterGenesis.sold}`,
  );
}

const genesis =
  afterGenesis.phases.find(
    (phase) =>
      phase.code ===
      "GENESIS",
  );

if (!genesis) {
  throw new Error(
    "GENESIS_PHASE_MISSING",
  );
}

if (
  genesis.sold !== 1000
) {
  throw new Error(
    "GENESIS_SOLD_NOT_1000",
  );
}

if (
  genesis.remaining !== 0
) {
  throw new Error(
    "GENESIS_REMAINING_NOT_ZERO",
  );
}

if (
  afterGenesis.activePhase?.code !==
  "EARLY_ACCESS"
) {
  throw new Error(
    `EXPECTED_EARLY_ACCESS_ACTIVE_GOT_${
      afterGenesis.activePhase?.code ??
      "NONE"
    }`,
  );
}

console.log(
  "[PASS] Genesis automatically closed",
);

console.log(
  "[PASS] Early Access automatically activated",
);

console.log("");
console.log(
  "[B2 TEST] New order after transition...",
);

const earlyOrder =
  createOrder({
    email:
      "early-access@example.com",

    idempotencyKey:
      "b2-early-access-order",
  });

if (
  earlyOrder.order.phase.code !==
  "EARLY_ACCESS"
) {
  throw new Error(
    "NEW_ORDER_NOT_EARLY_ACCESS",
  );
}

if (
  earlyOrder.order.referencePriceUsd !==
  70
) {
  throw new Error(
    "EARLY_ACCESS_PRICE_NOT_70",
  );
}

console.log(
  "[PASS] New orders use Early Access",
);

console.log(
  "[PASS] Early Access reference price = US$70",
);

console.log("");
console.log(
  "[B2 TEST] Allocation idempotency...",
);

const firstEarlyAllocation =
  allocateInventoryForSettledOrder({
    orderPublicId:
      earlyOrder.order.publicId,

    settlementReference:
      "B2-EARLY-SETTLEMENT-001",
  });

const replayEarlyAllocation =
  allocateInventoryForSettledOrder({
    orderPublicId:
      earlyOrder.order.publicId,

    settlementReference:
      "B2-EARLY-SETTLEMENT-001",
  });

if (
  replayEarlyAllocation.idempotentReplay !==
  true
) {
  throw new Error(
    "ALLOCATION_REPLAY_NOT_IDEMPOTENT",
  );
}

if (
  firstEarlyAllocation.serialNumber !==
  replayEarlyAllocation.serialNumber
) {
  throw new Error(
    "REPLAY_SERIAL_CHANGED",
  );
}

if (
  firstEarlyAllocation.serialNumber !==
  1001
) {
  throw new Error(
    `EXPECTED_SERIAL_1001_GOT_${firstEarlyAllocation.serialNumber}`,
  );
}

console.log(
  "[PASS] Allocation replay is idempotent",
);

console.log(
  "[PASS] First Early Access serial = #1001",
);

console.log("");
console.log(
  "[B2 TEST] Settlement replay protection...",
);

const secondEarlyOrder =
  createOrder({
    email:
      "early-access-2@example.com",

    idempotencyKey:
      "b2-early-access-order-2",
  });

let settlementReplayBlocked =
  false;

try {
  allocateInventoryForSettledOrder({
    orderPublicId:
      secondEarlyOrder.order.publicId,

    settlementReference:
      "B2-EARLY-SETTLEMENT-001",
  });
} catch (error) {
  if (
    error instanceof Error &&
    error.message ===
      "SETTLEMENT_REFERENCE_ALREADY_USED"
  ) {
    settlementReplayBlocked =
      true;
  } else {
    throw error;
  }
}

if (
  !settlementReplayBlocked
) {
  throw new Error(
    "SETTLEMENT_REPLAY_NOT_BLOCKED",
  );
}

console.log(
  "[PASS] Settlement reference replay blocked",
);

const duplicateSerialRows =
  db.prepare(`
    SELECT
      serial_number,
      COUNT(*) AS count
    FROM inventory_allocations
    WHERE status = 'ALLOCATED'
    GROUP BY serial_number
    HAVING COUNT(*) > 1
  `).all();

if (
  duplicateSerialRows.length !== 0
) {
  throw new Error(
    "DUPLICATE_SERIAL_DETECTED",
  );
}

console.log(
  "[PASS] Database contains no duplicate serials",
);

const finalCampaign =
  getCampaignReadModel();

if (!finalCampaign) {
  throw new Error(
    "FINAL_CAMPAIGN_NOT_FOUND",
  );
}

console.log("");
console.log(
  "============================================",
);

console.log(
  " B2 INVENTORY TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  `Campaign sold: ${finalCampaign.sold}`,
);

console.log(
  `Genesis sold: ${
    finalCampaign.phases.find(
      (phase) =>
        phase.code === "GENESIS",
    )?.sold ?? "?"
  }`,
);

console.log(
  `Active phase: ${
    finalCampaign.activePhase?.code ??
    "NONE"
  }`,
);

console.log(
  `Unique serials: ${serials.size}`,
);

console.log(
  "Oversell attempts rejected: 5",
);

console.log(
  "Settlement replay: BLOCKED",
);

console.log(
  "Real payments: NOT INVOLVED",
);

db.close();
