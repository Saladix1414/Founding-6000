import {
  db,
} from "./database.js";

export function ensureReserveSweepSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reserve_sweeps (
      id TEXT PRIMARY KEY,

      public_id TEXT NOT NULL UNIQUE,

      sweep_version TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'PENDING',
            'PREPARED',
            'SUBMITTED',
            'CONFIRMED',
            'FAILED'
          )
        ),

      network TEXT NOT NULL,

      chain_id INTEGER NOT NULL,

      token_contract TEXT NOT NULL,

      treasury_address TEXT NOT NULL,

      vault_address TEXT NOT NULL,

      amount_minor INTEGER NOT NULL,

      contribution_count INTEGER NOT NULL,

      transaction_nonce INTEGER,

      transaction_hash TEXT UNIQUE,

      transaction_json TEXT,

      attempts INTEGER NOT NULL
        DEFAULT 0,

      last_error TEXT,

      created_at TEXT NOT NULL,

      updated_at TEXT NOT NULL,

      prepared_at TEXT,

      submitted_at TEXT,

      confirmed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS
      idx_reserve_sweeps_status

    ON reserve_sweeps(
      status,
      created_at
    );

    CREATE TABLE IF NOT EXISTS reserve_sweep_items (
      id TEXT PRIMARY KEY,

      sweep_id TEXT NOT NULL,

      contribution_id TEXT NOT NULL UNIQUE,

      amount_minor INTEGER NOT NULL,

      created_at TEXT NOT NULL,

      FOREIGN KEY (
        sweep_id
      )
      REFERENCES reserve_sweeps(id),

      FOREIGN KEY (
        contribution_id
      )
      REFERENCES reserve_contributions(id)
    );

    CREATE INDEX IF NOT EXISTS
      idx_reserve_sweep_items_sweep

    ON reserve_sweep_items(
      sweep_id
    );
  `);
}
