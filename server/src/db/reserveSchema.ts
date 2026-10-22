import {
  db,
} from "./database.js";

export function ensureReserveSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reserve_contributions (
      id TEXT PRIMARY KEY,

      settlement_id TEXT NOT NULL UNIQUE,

      order_id TEXT NOT NULL,

      serial_number INTEGER NOT NULL,

      sale_tier TEXT NOT NULL
        CHECK (
          sale_tier IN (
            'RARE',
            'EPIC',
            'GENESIS'
          )
        ),

      gross_amount_minor INTEGER NOT NULL,

      reserve_bps INTEGER NOT NULL,

      reserve_amount_minor INTEGER NOT NULL,

      external_reference TEXT NOT NULL UNIQUE,

      economic_model_version TEXT NOT NULL,

      waterfall_version TEXT NOT NULL,

      created_at TEXT NOT NULL,

      FOREIGN KEY (
        settlement_id
      )
      REFERENCES payment_settlements(id),

      FOREIGN KEY (
        order_id
      )
      REFERENCES founding_orders(id)
    );

    CREATE INDEX IF NOT EXISTS
      idx_reserve_contributions_tier

    ON reserve_contributions(
      sale_tier,
      serial_number
    );

    CREATE TABLE IF NOT EXISTS reserve_allocations (
      id TEXT PRIMARY KEY,

      contribution_id TEXT NOT NULL,

      beneficiary_tier TEXT NOT NULL
        CHECK (
          beneficiary_tier IN (
            'RARE',
            'EPIC',
            'GENESIS'
          )
        ),

      weight_bps INTEGER NOT NULL,

      amount_minor INTEGER NOT NULL,

      created_at TEXT NOT NULL,

      FOREIGN KEY (
        contribution_id
      )
      REFERENCES reserve_contributions(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_reserve_allocation_unique_tier

    ON reserve_allocations(
      contribution_id,
      beneficiary_tier
    );

    CREATE INDEX IF NOT EXISTS
      idx_reserve_allocations_tier

    ON reserve_allocations(
      beneficiary_tier
    );
  `);
}
