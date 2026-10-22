import {
  db,
} from "./database.js";

export function ensureReserveProofSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reserve_snapshots (
      id TEXT PRIMARY KEY,

      snapshot_version TEXT NOT NULL,

      snapshot_hash TEXT NOT NULL UNIQUE,

      captured_at TEXT NOT NULL,

      network TEXT NOT NULL,

      chain_id INTEGER NOT NULL,

      token_contract TEXT NOT NULL,

      vault_address TEXT NOT NULL,

      total_liability_minor INTEGER NOT NULL,

      onchain_balance_minor INTEGER NOT NULL,

      surplus_deficit_minor INTEGER NOT NULL,

      coverage_bps TEXT,

      fully_covered INTEGER NOT NULL,

      rare_balance_minor INTEGER NOT NULL,
      epic_balance_minor INTEGER NOT NULL,
      genesis_balance_minor INTEGER NOT NULL,

      rare_issued_supply INTEGER NOT NULL,
      epic_issued_supply INTEGER NOT NULL,
      genesis_issued_supply INTEGER NOT NULL,

      rare_nav_minor TEXT,
      epic_nav_minor TEXT,
      genesis_nav_minor TEXT,

      snapshot_json TEXT NOT NULL,

      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_reserve_snapshots_captured_at

    ON reserve_snapshots(
      captured_at DESC
    );
  `);
}
