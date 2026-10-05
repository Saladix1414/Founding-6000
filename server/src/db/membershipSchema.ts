import {
  db,
} from "./database.js";

export function ensureMembershipSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS founding_memberships (
      id TEXT PRIMARY KEY,

      public_id TEXT NOT NULL UNIQUE,

      order_id TEXT NOT NULL UNIQUE,

      serial_number INTEGER NOT NULL UNIQUE,

      founding_member INTEGER NOT NULL DEFAULT 1,

      genesis_member INTEGER NOT NULL DEFAULT 0,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'RESERVED',
            'PAID',
            'ACTIVATION_PENDING',
            'ACTIVE',
            'EXPIRED',
            'REFUNDED',
            'REVOKED'
          )
        ),

      activation_started_at TEXT,

      activation_expires_at TEXT,

      created_at TEXT NOT NULL,

      updated_at TEXT NOT NULL,

      FOREIGN KEY(order_id)
        REFERENCES founding_orders(id)
    );

    CREATE INDEX IF NOT EXISTS
      idx_founding_memberships_status
    ON founding_memberships(status);

    CREATE INDEX IF NOT EXISTS
      idx_founding_memberships_serial
    ON founding_memberships(serial_number);
  `);
}
