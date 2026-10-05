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
  resolve(
    dbPath,
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

const {
  db,
  initializeDatabase,
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
  countAllocatedForPhase,
  countIssuedForPhase,
  getHighestIssuedSerialForPhase,
} = await import(
  "../repositories/inventoryRepository.js"
);

const {
  getCampaignReadModel,
} = await import(
  "../repositories/campaignRepository.js"
);

try {
  initializeDatabase();

  const firstOrder =
    createOrder({
      email:
        "d1e-first@example.com",

      idempotencyKey:
        "d1e-first-order",
    });

  const first =
    allocateInventoryForSettledOrder({
      orderPublicId:
        firstOrder.order.publicId,

      settlementReference:
        "D1E-SETTLEMENT-0001",
    });

  if (
    first.serialNumber !== 1
  ) {
    throw new Error(
      `EXPECTED_FIRST_SERIAL_1_GOT_${first.serialNumber}`,
    );
  }

  /*
   * Simulate a future refund/release.
   *
   * The historical row remains present.
   */
  db.prepare(`
    UPDATE inventory_allocations

    SET
      status = 'RELEASED',
      released_at = ?

    WHERE id = ?
  `).run(
    new Date()
      .toISOString(),

    first.allocationId,
  );

  const activeAfterRelease =
    countAllocatedForPhase(
      first.phaseId,
    );

  const issuedAfterRelease =
    countIssuedForPhase(
      first.phaseId,
    );

  if (
    activeAfterRelease !== 0
  ) {
    throw new Error(
      `EXPECTED_0_ACTIVE_AFTER_RELEASE_GOT_${activeAfterRelease}`,
    );
  }

  if (
    issuedAfterRelease !== 1
  ) {
    throw new Error(
      `EXPECTED_1_HISTORICAL_ISSUED_GOT_${issuedAfterRelease}`,
    );
  }

  const secondOrder =
    createOrder({
      email:
        "d1e-second@example.com",

      idempotencyKey:
        "d1e-second-order",
    });

  const second =
    allocateInventoryForSettledOrder({
      orderPublicId:
        secondOrder.order.publicId,

      settlementReference:
        "D1E-SETTLEMENT-0002",
    });

  /*
   * Critical assertion:
   *
   * serial #1 was RELEASED but must never be
   * assigned again.
   */
  if (
    second.serialNumber !== 2
  ) {
    throw new Error(
      `HISTORICAL_SERIAL_REUSE_RISK_EXPECTED_2_GOT_${second.serialNumber}`,
    );
  }

  const highest =
    getHighestIssuedSerialForPhase(
      first.phaseId,
    );

  if (
    highest !== 2
  ) {
    throw new Error(
      `EXPECTED_HIGHEST_HISTORICAL_SERIAL_2_GOT_${highest}`,
    );
  }

  const historicalRows =
    db.prepare(`
      SELECT
        serial_number AS serialNumber,
        status

      FROM inventory_allocations

      WHERE phase_id = ?

      ORDER BY serial_number
    `).all(
      first.phaseId,
    ) as Array<{
      serialNumber: number;
      status: string;
    }>;

  if (
    historicalRows.length !== 2
  ) {
    throw new Error(
      "EXPECTED_2_HISTORICAL_ROWS",
    );
  }

  if (
    historicalRows[0]
      ?.serialNumber !== 1 ||
    historicalRows[0]
      ?.status !==
      "RELEASED"
  ) {
    throw new Error(
      "RELEASED_SERIAL_HISTORY_NOT_PRESERVED",
    );
  }

  if (
    historicalRows[1]
      ?.serialNumber !== 2 ||
    historicalRows[1]
      ?.status !==
      "ALLOCATED"
  ) {
    throw new Error(
      "NEW_SERIAL_ALLOCATION_INVALID",
    );
  }

  const duplicates =
    db.prepare(`
      SELECT
        serial_number,
        COUNT(*) AS count

      FROM inventory_allocations

      GROUP BY
        campaign_id,
        serial_number

      HAVING COUNT(*) > 1
    `).all();

  if (
    duplicates.length !== 0
  ) {
    throw new Error(
      "DUPLICATE_HISTORICAL_SERIAL_FOUND",
    );
  }

  /*
   * Replaying the original released order must
   * preserve its historical serial identity.
   */
  const replay =
    allocateInventoryForSettledOrder({
      orderPublicId:
        firstOrder.order.publicId,

      settlementReference:
        "D1E-SETTLEMENT-0001",
    });

  if (
    replay.serialNumber !== 1 ||
    replay.idempotentReplay !==
      true
  ) {
    throw new Error(
      "RELEASED_ORDER_HISTORY_NOT_IDEMPOTENT",
    );
  }

  const campaign =
    getCampaignReadModel();

  if (!campaign) {
    throw new Error(
      "CAMPAIGN_NOT_FOUND",
    );
  }

  const genesis =
    campaign.phases.find(
      (phase) =>
        phase.code ===
        "GENESIS",
    );

  if (!genesis) {
    throw new Error(
      "GENESIS_NOT_FOUND",
    );
  }

  /*
   * Capacity consumption must match the permanent
   * serial ledger: #1 and #2 are both consumed.
   */
  if (
    genesis.sold !== 2
  ) {
    throw new Error(
      `EXPECTED_GENESIS_CONSUMED_2_GOT_${genesis.sold}`,
    );
  }

  if (
    genesis.remaining !== 998
  ) {
    throw new Error(
      `EXPECTED_GENESIS_REMAINING_998_GOT_${genesis.remaining}`,
    );
  }

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D1-E HISTORICAL SERIAL TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "FIRST_SERIAL=1",
  );

  console.log(
    "FIRST_SERIAL_STATUS=RELEASED",
  );

  console.log(
    "SECOND_SERIAL=2",
  );

  console.log(
    "SERIAL_REUSE=BLOCKED",
  );

  console.log(
    "HISTORICAL_ISSUANCE=2",
  );

  console.log(
    "ACTIVE_ALLOCATIONS=1",
  );

  console.log(
    "CAPACITY_CONSUMED=2",
  );

  console.log(
    "GENESIS_REMAINING=998",
  );

  console.log(
    "RELEASED_ORDER_REPLAY=IDEMPOTENT",
  );

  console.log(
    "DUPLICATE_SERIALS=0",
  );
} finally {
  db.close();

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
}
