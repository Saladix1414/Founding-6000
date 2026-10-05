import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const path =
  process.env.DATABASE_PATH;

if (!path) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(
    path,
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
} = await import(
  "../db/database.js"
);

const {
  applyPendingDatabaseMigrations,
  getDatabaseMigrationStatus,
} = await import(
  "../db/migrationRegistry.js"
);

try {
  const first =
    applyPendingDatabaseMigrations();

  if (
    first.newlyApplied.length !==
      4
  ) {
    throw new Error(
      `EXPECTED_4_INITIAL_MIGRATIONS_GOT_${first.newlyApplied.length}`,
    );
  }

  const second =
    applyPendingDatabaseMigrations();

  if (
    second.newlyApplied.length !==
      0
  ) {
    throw new Error(
      "MIGRATIONS_NOT_IDEMPOTENT",
    );
  }

  const status =
    getDatabaseMigrationStatus();

  if (
    status.length !== 4 ||
    status.some(
      (migration) =>
        !migration.applied,
    )
  ) {
    throw new Error(
      "MIGRATION_STATUS_INVALID",
    );
  }

  const migrationRows =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM database_migrations
    `).get() as {
      count:
        number | bigint;
    };

  if (
    Number(
      migrationRows.count,
    ) !== 4
  ) {
    throw new Error(
      "MIGRATION_REGISTRY_ROW_COUNT_INVALID",
    );
  }

  const requiredTables = [
    "campaigns",
    "campaign_phases",
    "founding_orders",
    "inventory_allocations",
    "payment_quotes",
    "payment_attempts",
    "payment_settlements",
    "founding_memberships",
    "email_outbox",
    "database_migrations",
    "worker_health",
  ];

  for (
    const table of
      requiredTables
  ) {
    const exists =
      db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE
          type = 'table'
          AND name = ?
      `).get(
        table,
      );

    if (!exists) {
      throw new Error(
        `REQUIRED_TABLE_MISSING_${table}`,
      );
    }
  }

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D1-D MIGRATION REGISTRY TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "INITIAL_MIGRATIONS=4",
  );

  console.log(
    "IDEMPOTENT_REPLAY=PASS",
  );

  console.log(
    "REGISTRY_PERSISTENCE=PASS",
  );

  console.log(
    "REQUIRED_SCHEMA=PASS",
  );
} finally {
  db.close();
}
