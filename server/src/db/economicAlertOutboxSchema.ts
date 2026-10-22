import {
  db,
} from "./database.js";

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
}
