import {
  db,
} from "./database.js";

function ensureColumn(
  name: string,
  definition: string,
) {
  const columns =
    db.prepare(`
      PRAGMA table_info(email_outbox)
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
      ALTER TABLE email_outbox
      ADD COLUMN ${definition};
    `);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    /*
     * Another process could have completed the
     * same additive migration between PRAGMA
     * and ALTER TABLE.
     */
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

export function ensureEmailOutboxSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,

      recipient_email TEXT NOT NULL,

      template TEXT NOT NULL
        CHECK (
          template IN (
            'REGISTRATION_RECEIVED',
            'PAYMENT_VERIFIED',
            'MEMBERSHIP_CREATED',
            'MEMBERSHIP_ACTIVATED'
          )
        ),

      subject TEXT NOT NULL,
      payload_json TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (
          status IN (
            'PENDING',
            'PROCESSING',
            'SENT',
            'FAILED'
          )
        ),

      idempotency_key TEXT NOT NULL UNIQUE,

      attempts INTEGER NOT NULL DEFAULT 0,

      last_error TEXT,

      processing_started_at TEXT,
      next_attempt_at TEXT,

      created_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  /*
   * Additive migration for databases created
   * before S1-D.
   */
  ensureColumn(
    "processing_started_at",
    "processing_started_at TEXT",
  );

  ensureColumn(
    "next_attempt_at",
    "next_attempt_at TEXT",
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_email_outbox_status
    ON email_outbox(
      status,
      created_at
    );

    CREATE INDEX IF NOT EXISTS
      idx_email_outbox_dispatch
    ON email_outbox(
      status,
      next_attempt_at,
      created_at
    );
  `);
}
