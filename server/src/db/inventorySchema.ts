import { db } from "./database.js";

export function ensureInventorySchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_allocations (
      id TEXT PRIMARY KEY,

      campaign_id TEXT NOT NULL,
      phase_id TEXT NOT NULL,
      order_id TEXT NOT NULL,

      serial_number INTEGER NOT NULL,
      settlement_reference TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'ALLOCATED',
            'RELEASED'
          )
        ),

      allocated_at TEXT NOT NULL,
      released_at TEXT,

      FOREIGN KEY (
        campaign_id
      )
      REFERENCES campaigns(id),

      FOREIGN KEY (
        phase_id
      )
      REFERENCES campaign_phases(id),

      FOREIGN KEY (
        order_id
      )
      REFERENCES founding_orders(id),

      UNIQUE (
        order_id
      ),

      UNIQUE (
        campaign_id,
        serial_number
      ),

      UNIQUE (
        settlement_reference
      )
    );

    CREATE INDEX IF NOT EXISTS
      idx_inventory_allocations_phase
      ON inventory_allocations(
        phase_id,
        status
      );

    CREATE INDEX IF NOT EXISTS
      idx_inventory_allocations_campaign
      ON inventory_allocations(
        campaign_id,
        status
      );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_single_active_campaign_phase
      ON campaign_phases(active)
      WHERE active = 1;
  `);
}
