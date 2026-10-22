import {
  db,
} from "./database.js";

export function ensureEconomicIntegrityIncidentSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economic_integrity_incident_events (
      id TEXT PRIMARY KEY,

      incident_id TEXT NOT NULL,

      incident_version TEXT NOT NULL,

      event_type TEXT NOT NULL
        CHECK (
          event_type IN (
            'OPENED',
            'OBSERVED',
            'RESOLVED'
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

      integrity_state TEXT NOT NULL
        CHECK (
          integrity_state IN (
            'OK',
            'WARNING',
            'CRITICAL',
            'STALE'
          )
        ),

      fingerprint TEXT,

      report_hash TEXT,

      evidence_json TEXT NOT NULL,

      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_integrity_incident_events_incident

    ON economic_integrity_incident_events(
      incident_id,
      created_at ASC
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_integrity_incident_events_latest

    ON economic_integrity_incident_events(
      created_at DESC
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_integrity_incident_events_fingerprint

    ON economic_integrity_incident_events(
      fingerprint,
      created_at DESC
    );

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_integrity_incident_events_no_update

    BEFORE UPDATE
    ON economic_integrity_incident_events

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_INTEGRITY_INCIDENT_EVENTS_APPEND_ONLY'
        );
    END;

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_integrity_incident_events_no_delete

    BEFORE DELETE
    ON economic_integrity_incident_events

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_INTEGRITY_INCIDENT_EVENTS_APPEND_ONLY'
        );
    END;
  `);
}
