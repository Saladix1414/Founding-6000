import {
  db,
} from "./database.js";

export function ensureWorkerHealthSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worker_health (
      worker_name TEXT PRIMARY KEY
        CHECK (
          worker_name IN (
            'email',
            'usdt'
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

    CREATE INDEX IF NOT EXISTS
      idx_worker_health_updated
    ON worker_health(
      updated_at
    );
  `);
}
