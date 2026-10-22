import {
  db,
} from "./database.js";

export function ensureEconomicReconciliationEvidenceSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economic_reconciliation_runs (
      id TEXT PRIMARY KEY,

      reconciliation_version TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'OK',
            'WARNING',
            'CRITICAL'
          )
        ),

      critical_failures INTEGER NOT NULL,
      warnings INTEGER NOT NULL,

      report_hash TEXT NOT NULL UNIQUE,

      report_json TEXT NOT NULL,

      reconciled_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_reconciliation_runs_latest

    ON economic_reconciliation_runs(
      reconciled_at DESC,
      created_at DESC
    );

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_reconciliation_runs_no_update

    BEFORE UPDATE
    ON economic_reconciliation_runs

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_RECONCILIATION_RUNS_APPEND_ONLY'
        );
    END;

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_reconciliation_runs_no_delete

    BEFORE DELETE
    ON economic_reconciliation_runs

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_RECONCILIATION_RUNS_APPEND_ONLY'
        );
    END;
  `);
}
