import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEmailOutboxSchema,
} from "../db/emailOutboxSchema.js";

import {
  renderFoundingEmail,
  type EmailTemplate,
} from "../email/templates.js";

ensureEmailOutboxSchema();

export const EMAIL_MAX_ATTEMPTS =
  5;

export const EMAIL_PROCESSING_LEASE_MS =
  10 * 60 * 1000;

const EMAIL_RETRY_BASE_MS =
  60 * 1000;

const EMAIL_RETRY_MAX_MS =
  60 * 60 * 1000;

export type EmailOutboxWorkItem = {
  id: string;
  publicId: string;
  recipientEmail: string;
  template: EmailTemplate;
  subject: string;
  payloadJson: string;
  attempts: number;
};

function boundedLimit(
  limit: number,
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return 1;
  }

  return Math.min(
    limit,
    100,
  );
}

function safeErrorMessage(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return message
    .replace(
      /[\r\n\t]+/g,
      " ",
    )
    .slice(
      0,
      500,
    );
}

/*
 * Previous B5 behavior used FAILED as a retryable
 * state. After S1-D, FAILED is terminal.
 *
 * Existing pre-S1-D rows below the max-attempt
 * threshold are migrated back to PENDING.
 */
function recoverLegacyRetryableFailures(
  now:
    Date =
      new Date(),
) {
  ensureEmailOutboxSchema();

  const nowIso =
    now.toISOString();

  return db.prepare(`
    UPDATE email_outbox

    SET
      status = 'PENDING',
      next_attempt_at =
        COALESCE(
          next_attempt_at,
          updated_at
        ),
      updated_at = ?

    WHERE
      status = 'FAILED'
      AND attempts < ?
  `).run(
    nowIso,
    EMAIL_MAX_ATTEMPTS,
  );
}

/*
 * If a worker dies after claiming an item, its
 * PROCESSING lease eventually expires.
 */
export function recoverStaleProcessingEmails(
  now:
    Date =
      new Date(),
) {
  ensureEmailOutboxSchema();

  const nowIso =
    now.toISOString();

  const staleBefore =
    new Date(
      now.getTime() -
        EMAIL_PROCESSING_LEASE_MS,
    ).toISOString();

  return db.prepare(`
    UPDATE email_outbox

    SET
      status =
        CASE
          WHEN attempts >= ?
            THEN 'FAILED'
          ELSE 'PENDING'
        END,

      processing_started_at =
        NULL,

      next_attempt_at =
        CASE
          WHEN attempts >= ?
            THEN NULL
          ELSE ?
        END,

      last_error =
        COALESCE(
          last_error,
          'EMAIL_PROCESSING_LEASE_EXPIRED'
        ),

      updated_at = ?

    WHERE
      status = 'PROCESSING'

      AND COALESCE(
        processing_started_at,
        updated_at
      ) <= ?
  `).run(
    EMAIL_MAX_ATTEMPTS,
    EMAIL_MAX_ATTEMPTS,
    nowIso,
    nowIso,
    staleBefore,
  );
}

export function queueFoundingEmailWithinTransaction(
  input: {
    recipientEmail: string;
    template: EmailTemplate;
    payload: Record<
      string,
      unknown
    >;
    idempotencyKey: string;
  },
) {
  ensureEmailOutboxSchema();

  const existing =
    db.prepare(`
      SELECT
        public_id AS publicId,
        status

      FROM email_outbox

      WHERE idempotency_key = ?
    `).get(
      input.idempotencyKey,
    ) as
      | {
          publicId: string;
          status: string;
        }
      | undefined;

  if (existing) {
    return {
      publicId:
        existing.publicId,

      status:
        existing.status,

      created:
        false,
    };
  }

  const rendered =
    renderFoundingEmail(
      input.template,
      input.payload,
    );

  const id =
    randomUUID();

  const publicId =
    `mail_${randomUUID()}`;

  const now =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO email_outbox (
      id,
      public_id,
      recipient_email,
      template,
      subject,
      payload_json,
      status,
      idempotency_key,
      attempts,
      processing_started_at,
      next_attempt_at,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?,
      'PENDING',
      ?,
      0,
      NULL,
      NULL,
      ?,
      ?
    )
  `).run(
    id,
    publicId,
    input.recipientEmail,
    input.template,
    rendered.subject,
    JSON.stringify(
      input.payload,
    ),
    input.idempotencyKey,
    now,
    now,
  );

  return {
    publicId,
    status:
      "PENDING" as const,
    created:
      true,
  };
}

export function listPendingEmails(
  limit = 25,
  now:
    Date =
      new Date(),
) {
  ensureEmailOutboxSchema();

  const nowIso =
    now.toISOString();

  return db.prepare(`
    SELECT
      id,
      public_id AS publicId,
      recipient_email AS recipientEmail,
      template,
      subject,
      payload_json AS payloadJson,
      attempts

    FROM email_outbox

    WHERE
      status = 'PENDING'
      AND attempts < ?

      AND (
        next_attempt_at IS NULL
        OR next_attempt_at <= ?
      )

    ORDER BY created_at ASC

    LIMIT ?
  `).all(
    EMAIL_MAX_ATTEMPTS,
    nowIso,
    boundedLimit(
      limit,
    ),
  ) as EmailOutboxWorkItem[];
}

/*
 * Atomic claim.
 *
 * Multiple workers may see the same candidate,
 * but only one conditional UPDATE can move it
 * from PENDING -> PROCESSING.
 */
export function claimPendingEmails(
  limit = 25,
  now:
    Date =
      new Date(),
) {
  ensureEmailOutboxSchema();

  recoverLegacyRetryableFailures(
    now,
  );

  recoverStaleProcessingEmails(
    now,
  );

  const nowIso =
    now.toISOString();

  const candidates =
    listPendingEmails(
      limit,
      now,
    );

  const claimed:
    EmailOutboxWorkItem[] =
    [];

  for (
    const candidate of candidates
  ) {
    const claim =
      db.prepare(`
        UPDATE email_outbox

        SET
          status = 'PROCESSING',
          attempts = attempts + 1,
          processing_started_at = ?,
          next_attempt_at = NULL,
          updated_at = ?

        WHERE
          id = ?
          AND status = 'PENDING'
          AND attempts < ?

          AND (
            next_attempt_at IS NULL
            OR next_attempt_at <= ?
          )
      `).run(
        nowIso,
        nowIso,
        candidate.id,
        EMAIL_MAX_ATTEMPTS,
        nowIso,
      );

    if (
      Number(
        claim.changes,
      ) !== 1
    ) {
      continue;
    }

    const stored =
      db.prepare(`
        SELECT
          id,
          public_id AS publicId,
          recipient_email AS recipientEmail,
          template,
          subject,
          payload_json AS payloadJson,
          attempts

        FROM email_outbox

        WHERE id = ?
      `).get(
        candidate.id,
      ) as
        | EmailOutboxWorkItem
        | undefined;

    if (stored) {
      claimed.push(
        stored,
      );
    }
  }

  return claimed;
}

export function markEmailSent(
  input: {
    id: string;
    sentAt?:
      Date;
  },
) {
  ensureEmailOutboxSchema();

  const sentAt =
    (
      input.sentAt ??
      new Date()
    ).toISOString();

  const result =
    db.prepare(`
      UPDATE email_outbox

      SET
        status = 'SENT',
        sent_at = ?,
        last_error = NULL,
        processing_started_at = NULL,
        next_attempt_at = NULL,
        updated_at = ?

      WHERE
        id = ?
        AND status = 'PROCESSING'
    `).run(
      sentAt,
      sentAt,
      input.id,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "EMAIL_OUTBOX_SEND_STATE_CONFLICT",
    );
  }
}

export function markEmailDeliveryFailure(
  input: {
    id: string;
    error: unknown;
    failedAt?:
      Date;
  },
) {
  ensureEmailOutboxSchema();

  const row =
    db.prepare(`
      SELECT
        attempts,
        status

      FROM email_outbox

      WHERE id = ?
    `).get(
      input.id,
    ) as
      | {
          attempts: number;
          status: string;
        }
      | undefined;

  if (
    !row ||
    row.status !==
      "PROCESSING"
  ) {
    throw new Error(
      "EMAIL_OUTBOX_FAILURE_STATE_CONFLICT",
    );
  }

  const failedAt =
    input.failedAt ??
    new Date();

  const terminal =
    row.attempts >=
    EMAIL_MAX_ATTEMPTS;

  const retryDelayMs =
    Math.min(
      EMAIL_RETRY_BASE_MS *
        2 **
          Math.max(
            row.attempts - 1,
            0,
          ),
      EMAIL_RETRY_MAX_MS,
    );

  const nextAttemptAt =
    terminal
      ? null
      : new Date(
          failedAt.getTime() +
            retryDelayMs,
        ).toISOString();

  const failedIso =
    failedAt.toISOString();

  const nextStatus =
    terminal
      ? "FAILED"
      : "PENDING";

  const result =
    db.prepare(`
      UPDATE email_outbox

      SET
        status = ?,
        last_error = ?,
        processing_started_at = NULL,
        next_attempt_at = ?,
        updated_at = ?

      WHERE
        id = ?
        AND status = 'PROCESSING'
    `).run(
      nextStatus,
      safeErrorMessage(
        input.error,
      ),
      nextAttemptAt,
      failedIso,
      input.id,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "EMAIL_OUTBOX_FAILURE_STATE_CONFLICT",
    );
  }

  return {
    status:
      nextStatus as
        | "PENDING"
        | "FAILED",

    attempts:
      row.attempts,

    nextAttemptAt,
  };
}
