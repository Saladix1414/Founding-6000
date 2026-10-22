import {
  db,
} from "./database.js";

export function ensureEconomicAlertRecoverySchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economic_alert_recovery_events (
      id TEXT PRIMARY KEY,

      alert_id TEXT NOT NULL,

      idempotency_key TEXT NOT NULL UNIQUE,

      previous_attempts INTEGER NOT NULL
        CHECK (
          previous_attempts >= 0
        ),

      reason TEXT NOT NULL,

      recovered_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_alert_recovery_alert

    ON economic_alert_recovery_events(
      alert_id,
      recovered_at
    );

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_alert_recovery_no_update

    BEFORE UPDATE
    ON economic_alert_recovery_events

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_ALERT_RECOVERY_APPEND_ONLY_UPDATE'
        );
    END;

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_alert_recovery_no_delete

    BEFORE DELETE
    ON economic_alert_recovery_events

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_ALERT_RECOVERY_APPEND_ONLY_DELETE'
        );
    END;
  `);
}
