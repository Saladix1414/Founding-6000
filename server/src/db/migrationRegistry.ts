import {
  db,
  initializeDatabase,
} from "./database.js";

import {
  ensureMembershipSchema,
} from "./membershipSchema.js";

import {
  ensureEmailOutboxSchema,
} from "./emailOutboxSchema.js";

import {
  ensureWorkerHealthSchema,
} from "./workerHealthSchema.js";

type DatabaseMigration = {
  id: string;
  description: string;
  apply: () => void;
};

const migrations:
  DatabaseMigration[] = [
    {
      id:
        "001_core_commerce_payment_schema",

      description:
        "Core campaign, orders, inventory, quotes and USDT payment schema",

      apply() {
        initializeDatabase();
      },
    },

    {
      id:
        "002_membership_schema",

      description:
        "Founding membership schema",

      apply() {
        ensureMembershipSchema();
      },
    },

    {
      id:
        "003_email_outbox_schema",

      description:
        "Transactional email outbox and worker metadata",

      apply() {
        ensureEmailOutboxSchema();
      },
    },

    {
      id:
        "004_worker_health_schema",

      description:
        "Operational worker heartbeat state",

      apply() {
        ensureWorkerHealthSchema();
      },
    },
  ];

export function ensureMigrationRegistry() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS database_migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function getDatabaseMigrationStatus() {
  ensureMigrationRegistry();

  const appliedRows =
    db.prepare(`
      SELECT
        id,
        description,
        applied_at AS appliedAt
      FROM database_migrations
      ORDER BY id
    `).all() as Array<{
      id: string;
      description: string;
      appliedAt: string;
    }>;

  const appliedIds =
    new Set(
      appliedRows.map(
        (row) =>
          row.id,
      ),
    );

  return migrations.map(
    (migration) => ({
      id:
        migration.id,

      description:
        migration.description,

      applied:
        appliedIds.has(
          migration.id,
        ),

      appliedAt:
        appliedRows.find(
          (row) =>
            row.id ===
            migration.id,
        )?.appliedAt ??
        null,
    }),
  );
}

export function applyPendingDatabaseMigrations() {
  ensureMigrationRegistry();

  const applied =
    new Set(
      (
        db.prepare(`
          SELECT id
          FROM database_migrations
        `).all() as Array<{
          id: string;
        }>
      ).map(
        (row) =>
          row.id,
      ),
    );

  const newlyApplied:
    string[] =
    [];

  for (
    const migration of
      migrations
  ) {
    if (
      applied.has(
        migration.id,
      )
    ) {
      continue;
    }

    db.exec(
      "BEGIN IMMEDIATE;",
    );

    try {
      migration.apply();

      db.prepare(`
        INSERT INTO database_migrations (
          id,
          description,
          applied_at
        )
        VALUES (?, ?, ?)
      `).run(
        migration.id,
        migration.description,
        new Date()
          .toISOString(),
      );

      db.exec(
        "COMMIT;",
      );

      newlyApplied.push(
        migration.id,
      );
    } catch (error) {
      try {
        db.exec(
          "ROLLBACK;",
        );
      } catch {
        // Best effort rollback.
      }

      throw error;
    }
  }

  return {
    newlyApplied,

    status:
      getDatabaseMigrationStatus(),
  };
}
