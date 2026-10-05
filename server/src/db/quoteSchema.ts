import { db } from "./database.js";

export function ensureQuoteSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_quotes (
      id TEXT PRIMARY KEY,

      public_id TEXT NOT NULL UNIQUE,

      order_id TEXT NOT NULL,

      currency TEXT NOT NULL
        CHECK (
          currency = 'ARS'
        ),

      reference_price_usd INTEGER NOT NULL,

      fx_source TEXT NOT NULL,

      fx_rate_ars_per_usd TEXT NOT NULL,

      quoted_amount_ars_minor INTEGER NOT NULL,

      provider_snapshot_json TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'ACTIVE',
            'EXPIRED',
            'USED',
            'VOID'
          )
        ),

      idempotency_key TEXT,

      quote_created_at TEXT NOT NULL,

      quote_expires_at TEXT NOT NULL,

      updated_at TEXT NOT NULL,

      FOREIGN KEY (
        order_id
      )
      REFERENCES founding_orders(id)
    );

    CREATE INDEX IF NOT EXISTS
      idx_payment_quotes_order
      ON payment_quotes(
        order_id,
        status
      );

    CREATE INDEX IF NOT EXISTS
      idx_payment_quotes_expiration
      ON payment_quotes(
        quote_expires_at,
        status
      );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_payment_quotes_idempotency
      ON payment_quotes(
        idempotency_key
      )
      WHERE idempotency_key IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_payment_quotes_one_active_per_order
      ON payment_quotes(
        order_id
      )
      WHERE status = 'ACTIVE';
  `);
}
