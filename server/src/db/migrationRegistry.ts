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

import {
  ensureReserveSchema,
} from "./reserveSchema.js";

import {
  ensureReserveProofSchema,
} from "./reserveProofSchema.js";

import {
  ensureReserveSweepSchema,
} from "./reserveSweepSchema.js";

import {
  ensureAkashicEconomicOutboxSchema,
} from "./akashicEconomicOutboxSchema.js";

import {
  ensureEconomicExitDecisionSchema,
} from "./economicExitDecisionSchema.js";

import {
  ensureEconomicReconciliationEvidenceSchema,
} from "./economicReconciliationEvidenceSchema.js";

import {
  ensureEconomicIntegrityIncidentSchema,
} from "./economicIntegrityIncidentSchema.js";

import {
  ensureEconomicAlertOutboxSchema,
} from "./economicAlertOutboxSchema.js";

import {
  ensureEconomicAlertRecoverySchema,
} from "./economicAlertRecoverySchema.js";


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

    {
      id:
        "005_collection_tier_authority",

      description:
        "Canonical RARE EPIC GENESIS collection tier ordering",

      apply() {
        /*
         * Preserve historical internal phase IDs while
         * correcting the commercial tier authority.
         */
        db.prepare(`
          UPDATE campaign_phases
          SET
            code = ?,
            name = ?,
            reference_price_usd = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          "RARE",
          "Rare",
          50,
          new Date().toISOString(),
          "phase_genesis",
        );

        db.prepare(`
          UPDATE campaign_phases
          SET
            code = ?,
            name = ?,
            reference_price_usd = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          "EPIC",
          "Epic",
          70,
          new Date().toISOString(),
          "phase_early_access",
        );

        db.prepare(`
          UPDATE campaign_phases
          SET
            code = ?,
            name = ?,
            reference_price_usd = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          "GENESIS",
          "Genesis",
          90,
          new Date().toISOString(),
          "phase_founding_access",
        );

        db.exec(`
          UPDATE founding_memberships

          SET
            genesis_member =
              CASE
                WHEN serial_number
                  BETWEEN 3001 AND 6000
                THEN 1
                ELSE 0
              END,

            updated_at =
              CURRENT_TIMESTAMP;
        `);
      },
    },

    {
      id:
        "006_reserve_economics_schema",

      description:
        "OriginX Founding reserve contribution and waterfall ledger",

      apply() {
        ensureReserveSchema();
      },
    },

    {
      id:
        "007_reserve_proof_snapshots",

      description:
        "On-chain Proof of Reserve and NAV snapshot history",

      apply() {
        ensureReserveProofSchema();
      },
    },

    {
      id:
        "008_reserve_sweep_engine",

      description:
        "Idempotent OriginX reserve sweep queue and transaction state",

      apply() {
        ensureReserveSweepSchema();
      },
    },

    {
      id:
        "009_reserve_worker_health",

      description:
        "Extend worker health state with reserve automation worker",

      apply() {
        /*
         * SQLite cannot alter an existing CHECK constraint.
         *
         * Rebuild the small worker_health table while
         * preserving all existing heartbeat rows.
         */
        db.exec(`
          CREATE TABLE IF NOT EXISTS worker_health_v2 (
            worker_name TEXT PRIMARY KEY
              CHECK (
                worker_name IN (
                  'email',
                  'usdt',
                  'reserve'
                )
              ),

            last_started_at TEXT,
            last_completed_at TEXT,
            last_failed_at TEXT,

            last_status TEXT NOT NULL
              CHECK (
                last_status IN (
                  'RUNNING',
                  'OK',
                  'FAILED'
                )
              ),

            updated_at TEXT NOT NULL
          );

          INSERT OR REPLACE INTO worker_health_v2 (
            worker_name,
            last_started_at,
            last_completed_at,
            last_failed_at,
            last_status,
            updated_at
          )
          SELECT
            worker_name,
            last_started_at,
            last_completed_at,
            last_failed_at,
            last_status,
            updated_at
          FROM worker_health;

          DROP TABLE worker_health;

          ALTER TABLE worker_health_v2
            RENAME TO worker_health;

          CREATE INDEX IF NOT EXISTS
            idx_worker_health_updated
          ON worker_health(
            updated_at
          );
        `);
      },
    },

    {
      id:
        "010_akashic_economic_outbox",

      description:
        "Append-only bridge for verified economic events into Akashic history",

      apply() {
        ensureAkashicEconomicOutboxSchema();
      },
    },

    {
      id:
        "011_economic_exit_decisions",

      description:
        "Append-only idempotent economic exit policy decisions",

      apply() {
        ensureEconomicExitDecisionSchema();
      },
    },

    {
      id:
        "012_economic_reconciliation_evidence",

      description:
        "Append-only economic reconciliation evidence",

      apply() {
        ensureEconomicReconciliationEvidenceSchema();
      },
    },

    {
      id:
        "013_economic_integrity_incidents",

      description:
        "Append-only economic integrity incident event history",

      apply() {
        ensureEconomicIntegrityIncidentSchema();
      },
    },

    {
      id:
        "014_economic_alert_outbox",

      description:
        "Economic integrity alert outbox",

      apply() {
        ensureEconomicAlertOutboxSchema();
      },
    },

    {
      id:
        "015_economic_alert_sync_cursor",

      description:
        "Persistent economic alert incident sync cursor",

      apply() {
        ensureEconomicAlertOutboxSchema();
      },
    },

    {
      id:
        "016_economic_alert_delivery_state",

      description:
        "Economic alert delivery lease and retry state",

      apply() {
        ensureEconomicAlertOutboxSchema();
      },
    },

    {
      id:
        "017_economic_alert_recovery_audit",

      description:
        "Append-only audit ledger for manual failed alert recovery",

      apply() {
        ensureEconomicAlertRecoverySchema();
      },
    },

    {
      id:
        "018_economic_alert_delivery_worker_health",

      description:
        "Extend worker health state with economic alert delivery worker",

      apply() {
        db.exec(`
          CREATE TABLE worker_health_v3 (
            worker_name TEXT PRIMARY KEY
              CHECK (
                worker_name IN (
                  'email',
                  'usdt',
                  'reserve',
                  'economic_alert_delivery'
                )
              ),

            last_started_at TEXT,
            last_completed_at TEXT,
            last_failed_at TEXT,

            last_status TEXT NOT NULL
              CHECK (
                last_status IN (
                  'RUNNING',
                  'OK',
                  'FAILED'
                )
              ),

            updated_at TEXT NOT NULL
          );

          INSERT OR REPLACE INTO worker_health_v3 (
            worker_name,
            last_started_at,
            last_completed_at,
            last_failed_at,
            last_status,
            updated_at
          )
          SELECT
            worker_name,
            last_started_at,
            last_completed_at,
            last_failed_at,
            last_status,
            updated_at
          FROM worker_health;

          DROP TABLE worker_health;

          ALTER TABLE worker_health_v3
            RENAME TO worker_health;

          CREATE INDEX IF NOT EXISTS
            idx_worker_health_updated
          ON worker_health(
            updated_at
          );
        `);
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
