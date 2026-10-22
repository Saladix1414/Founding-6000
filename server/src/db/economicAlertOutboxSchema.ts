import {
  db,
} from "./database.js";

function ensureEconomicAlertOutboxColumn(
  name:
    string,

  definition:
    string,
) {
  const columns =
    db.prepare(`
      PRAGMA table_info(economic_alert_outbox)
    `).all() as Array<{
      name:
        string;
    }>;

  if (
    columns.some(
      (column) =>
        column.name ===
          name,
    )
  ) {
    return;
  }

  try {
    db.exec(`
      ALTER TABLE economic_alert_outbox
      ADD COLUMN ${definition};
    `);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      message
        .toLowerCase()
        .includes(
          "duplicate column name",
        )
    ) {
      return;
    }

    throw error;
  }
}

export function ensureEconomicAlertOutboxSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economic_alert_outbox (
      id TEXT PRIMARY KEY,

      alert_policy_version TEXT NOT NULL,

      alert_key TEXT NOT NULL UNIQUE,

      incident_id TEXT NOT NULL,

      incident_event_id TEXT NOT NULL,

      trigger_type TEXT NOT NULL
        CHECK (
          trigger_type IN (
            'INCIDENT_OPENED',
            'INCIDENT_OBSERVED',
            'INCIDENT_RESOLVED'
          )
        ),

      severity TEXT
        CHECK (
          severity IS NULL
          OR severity IN (
            'WARNING',
            'CRITICAL'
          )
        ),

      status TEXT NOT NULL
        CHECK (
          status IN (
            'PENDING',
            'DELIVERED',
            'FAILED'
          )
        ),

      payload_json TEXT NOT NULL,

      created_at TEXT NOT NULL,
      delivered_at TEXT,
      failed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS economic_alert_sync_state (
      stream TEXT PRIMARY KEY,

      last_incident_rowid INTEGER NOT NULL
        CHECK (
          last_incident_rowid >= 0
        ),

      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO economic_alert_sync_state (
      stream,
      last_incident_rowid,
      updated_at
    )
    VALUES (
      'economic_integrity_incident_events',
      0,
      CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_alert_outbox_pending

    ON economic_alert_outbox(
      status,
      created_at ASC
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_alert_outbox_incident

    ON economic_alert_outbox(
      incident_id,
      created_at ASC
    );

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_alert_outbox_no_delete

    BEFORE DELETE
    ON economic_alert_outbox

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_ALERT_OUTBOX_APPEND_ONLY_DELETE'
        );
    END;
  `);

  ensureEconomicAlertOutboxColumn(
    "attempts",
    "attempts INTEGER NOT NULL DEFAULT 0",
  );

  ensureEconomicAlertOutboxColumn(
    "last_error",
    "last_error TEXT",
  );

  ensureEconomicAlertOutboxColumn(
    "next_attempt_at",
    "next_attempt_at TEXT",
  );

  ensureEconomicAlertOutboxColumn(
    "lease_owner",
    "lease_owner TEXT",
  );

  ensureEconomicAlertOutboxColumn(
    "lease_until",
    "lease_until TEXT",
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_economic_alert_outbox_delivery

    ON economic_alert_outbox(
      status,
      next_attempt_at,
      lease_until,
      created_at
    );
  `);
}
