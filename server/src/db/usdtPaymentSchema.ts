import {
  db,
} from "./database.js";

function ensureColumn(
  name: string,
  definition: string,
) {
  const columns =
    db.prepare(`
      PRAGMA table_info(payment_attempts)
    `).all() as Array<{
      name: string;
    }>;

  if (
    columns.some(
      (column) =>
        column.name === name,
    )
  ) {
    return;
  }

  try {
    db.exec(`
      ALTER TABLE payment_attempts
      ADD COLUMN ${definition};
    `);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      message
        .toLowerCase()
        .includes(
          "duplicate column name",
        )
    ) {
      return;
    }

    throw error;
  }
}

export function ensureUsdtPaymentSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_attempts (
      id TEXT PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,

      order_id TEXT NOT NULL,

      payment_method TEXT NOT NULL
        CHECK (
          payment_method = 'USDT'
        ),

      network TEXT NOT NULL,
      chain_id INTEGER NOT NULL,

      token_contract TEXT NOT NULL,
      token_decimals INTEGER NOT NULL,

      receiver_address TEXT NOT NULL,

      expected_amount_minor INTEGER NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'AWAITING_TRANSFER',
            'SUBMITTED',
            'VERIFYING',
            'VERIFIED',
            'REJECTED',
            'EXPIRED'
          )
        ),

      tx_hash TEXT,

      idempotency_key TEXT,

      verification_attempts INTEGER
        NOT NULL
        DEFAULT 0,

      verification_started_at TEXT,

      next_verification_at TEXT,

      last_verification_error TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (
        order_id
      )
      REFERENCES founding_orders(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_payment_attempt_tx_hash
      ON payment_attempts(tx_hash)
      WHERE tx_hash IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_payment_attempt_idempotency
      ON payment_attempts(idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE INDEX IF NOT EXISTS
      idx_payment_attempt_order
      ON payment_attempts(
        order_id,
        status
      );

    CREATE TABLE IF NOT EXISTS payment_settlements (
      id TEXT PRIMARY KEY,

      payment_attempt_id TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL,

      payment_method TEXT NOT NULL
        CHECK (
          payment_method = 'USDT'
        ),

      external_reference TEXT NOT NULL UNIQUE,

      network TEXT NOT NULL,
      chain_id INTEGER NOT NULL,

      token_contract TEXT NOT NULL,

      receiver_address TEXT NOT NULL,
      sender_address TEXT NOT NULL,

      amount_minor INTEGER NOT NULL,

      block_number INTEGER NOT NULL,
      transaction_index INTEGER,

      confirmations INTEGER NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status = 'VERIFIED'
        ),

      evidence_json TEXT NOT NULL,

      verified_at TEXT NOT NULL,

      FOREIGN KEY (
        payment_attempt_id
      )
      REFERENCES payment_attempts(id),

      FOREIGN KEY (
        order_id
      )
      REFERENCES founding_orders(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_payment_settlement_tx
      ON payment_settlements(
        external_reference
      );
  `);

  /*
   * Additive migration for pre-S1-D databases.
   */
  ensureColumn(
    "verification_attempts",
    "verification_attempts INTEGER NOT NULL DEFAULT 0",
  );

  ensureColumn(
    "verification_started_at",
    "verification_started_at TEXT",
  );

  ensureColumn(
    "next_verification_at",
    "next_verification_at TEXT",
  );

  ensureColumn(
    "last_verification_error",
    "last_verification_error TEXT",
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_payment_attempt_verification_queue

    ON payment_attempts(
      status,
      next_verification_at,
      updated_at
    );
  `);
}
