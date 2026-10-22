import {
  db,
} from "./database.js";

export function ensureAkashicEconomicOutboxSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS akashic_economic_outbox (
      id TEXT PRIMARY KEY,

      event_type TEXT NOT NULL,

      lifecycle_reference TEXT NOT NULL UNIQUE,

      source_entity_type TEXT NOT NULL,

      source_entity_id TEXT NOT NULL,

      payload_json TEXT NOT NULL,

      payload_hash TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'PENDING',
            'PUBLISHED',
            'FAILED'
          )
        ),

      created_at TEXT NOT NULL,

      published_at TEXT,

      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS
      idx_akashic_economic_outbox_status

    ON akashic_economic_outbox(
      status,
      created_at
    );
  `);
}
