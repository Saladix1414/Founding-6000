import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const databasePath =
  process.env.DATABASE_PATH;

if (!databasePath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(
    databasePath,
  );

for (
  const file of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

const {
  db,
} = await import(
  "../db/database.js"
);

const {
  ensureEmailOutboxSchema,
} = await import(
  "../db/emailOutboxSchema.js"
);

const {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_PROCESSING_LEASE_MS,
  claimPendingEmails,
  markEmailDeliveryFailure,
  markEmailSent,
  queueFoundingEmailWithinTransaction,
  recoverStaleProcessingEmails,
} = await import(
  "../services/emailOutboxService.js"
);

const {
  dispatchEmailOutbox,
} = await import(
  "../services/emailDispatcher.js"
);

const {
  env,
} = await import(
  "../config/env.js"
);

ensureEmailOutboxSchema();

function queue(
  suffix: string,
) {
  return queueFoundingEmailWithinTransaction({
    recipientEmail:
      `s1d-${suffix}@example.com`,

    template:
      "REGISTRATION_RECEIVED",

    payload: {
      orderPublicId:
        `F6K-${suffix
          .padEnd(
            12,
            "0",
          )
          .slice(
            0,
            12,
          )
          .toUpperCase()}`,
    },

    idempotencyKey:
      `s1d-email-${suffix}`,
  });
}

function getRow(
  publicId: string,
) {
  return db.prepare(`
    SELECT
      public_id AS publicId,
      status,
      attempts,
      last_error AS lastError,
      processing_started_at AS processingStartedAt,
      next_attempt_at AS nextAttemptAt,
      sent_at AS sentAt

    FROM email_outbox

    WHERE public_id = ?
  `).get(
    publicId,
  ) as
    | {
        publicId: string;
        status: string;
        attempts: number;
        lastError:
          string | null;
        processingStartedAt:
          string | null;
        nextAttemptAt:
          string | null;
        sentAt:
          string | null;
      }
    | undefined;
}

try {
  console.log("");
  console.log(
    "[TEST 1] Atomic claim",
  );

  const atomic =
    queue(
      "atomic",
    );

  const firstClaim =
    claimPendingEmails(
      25,
    );

  const secondClaim =
    claimPendingEmails(
      25,
    );

  if (
    firstClaim.length !== 1 ||
    firstClaim[0]
      ?.publicId !==
        atomic.publicId ||
    secondClaim.length !== 0
  ) {
    throw new Error(
      "EMAIL_ATOMIC_CLAIM_FAILED",
    );
  }

  console.log(
    "[PASS] Only one worker can claim item",
  );

  markEmailSent({
    id:
      firstClaim[0].id,
  });

  console.log("");
  console.log(
    "[TEST 2] SENT is terminal",
  );

  let successfulSends =
    0;

  const sent =
    queue(
      "sent",
    );

  const successTransport = {
    async send() {
      successfulSends +=
        1;
    },
  };

  await dispatchEmailOutbox({
    limit:
      25,

    transport:
      successTransport,
  });

  await dispatchEmailOutbox({
    limit:
      25,

    transport:
      successTransport,
  });

  const sentRow =
    getRow(
      sent.publicId,
    );

  if (
    successfulSends !== 1 ||
    sentRow?.status !==
      "SENT" ||
    sentRow.attempts !== 1 ||
    !sentRow.sentAt
  ) {
    throw new Error(
      "EMAIL_SENT_NOT_TERMINAL",
    );
  }

  console.log(
    "[PASS] SENT email is never claimed again",
  );

  console.log("");
  console.log(
    "[TEST 3] Failure enters retry backoff",
  );

  const retry =
    queue(
      "retry",
    );

  let failingCalls =
    0;

  const failingTransport = {
    async send() {
      failingCalls +=
        1;

      throw new Error(
        "TEMPORARY_PROVIDER_FAILURE",
      );
    },
  };

  await dispatchEmailOutbox({
    limit:
      25,

    transport:
      failingTransport,
  });

  const retryAfterFailure =
    getRow(
      retry.publicId,
    );

  if (
    retryAfterFailure
      ?.status !==
        "PENDING" ||
    retryAfterFailure
      .attempts !== 1 ||
    !retryAfterFailure
      .nextAttemptAt
  ) {
    throw new Error(
      "EMAIL_RETRY_STATE_FAILED",
    );
  }

  /*
   * Immediate re-run must NOT bypass next_attempt_at.
   */
  await dispatchEmailOutbox({
    limit:
      25,

    transport:
      failingTransport,
  });

  if (
    failingCalls !== 1
  ) {
    throw new Error(
      "EMAIL_BACKOFF_BYPASSED",
    );
  }

  console.log(
    "[PASS] Immediate retry blocked by backoff",
  );

  console.log("");
  console.log(
    "[TEST 4] Max five attempts",
  );

  /*
   * First failure already happened.
   * Force next_attempt_at into the past before
   * each subsequent test attempt.
   */
  for (
    let attempt = 2;
    attempt <=
      EMAIL_MAX_ATTEMPTS;
    attempt += 1
  ) {
    db.prepare(`
      UPDATE email_outbox

      SET next_attempt_at = ?

      WHERE public_id = ?
    `).run(
      "2000-01-01T00:00:00.000Z",
      retry.publicId,
    );

    await dispatchEmailOutbox({
      limit:
        25,

      transport:
        failingTransport,
    });
  }

  const terminalFailure =
    getRow(
      retry.publicId,
    );

  if (
    terminalFailure
      ?.status !==
        "FAILED" ||
    terminalFailure
      .attempts !==
        EMAIL_MAX_ATTEMPTS ||
    terminalFailure
      .nextAttemptAt !== null
  ) {
    throw new Error(
      "EMAIL_MAX_ATTEMPTS_FAILED",
    );
  }

  const callsAtTerminal =
    failingCalls;

  await dispatchEmailOutbox({
    limit:
      25,

    transport:
      failingTransport,
  });

  if (
    failingCalls !==
      callsAtTerminal
  ) {
    throw new Error(
      "TERMINAL_FAILED_EMAIL_RETRIED",
    );
  }

  console.log(
    "[PASS] FAILED becomes terminal after five attempts",
  );

  console.log("");
  console.log(
    "[TEST 5] Error storage is sanitized/bounded",
  );

  const errorRow =
    getRow(
      retry.publicId,
    );

  if (
    !errorRow?.lastError ||
    errorRow.lastError
      .includes("\n") ||
    errorRow.lastError
      .length > 500
  ) {
    throw new Error(
      "EMAIL_ERROR_SANITIZATION_FAILED",
    );
  }

  console.log(
    "[PASS] Stored error is bounded",
  );

  console.log("");
  console.log(
    "[TEST 6] Stale PROCESSING recovery",
  );

  const stale =
    queue(
      "stale",
    );

  const staleClaim =
    claimPendingEmails(
      25,
    ).find(
      (item) =>
        item.publicId ===
        stale.publicId,
    );

  if (!staleClaim) {
    throw new Error(
      "STALE_TEST_CLAIM_FAILED",
    );
  }

  const now =
    new Date();

  const staleTime =
    new Date(
      now.getTime() -
        EMAIL_PROCESSING_LEASE_MS -
        60_000,
    ).toISOString();

  db.prepare(`
    UPDATE email_outbox

    SET
      processing_started_at = ?,
      updated_at = ?

    WHERE public_id = ?
  `).run(
    staleTime,
    staleTime,
    stale.publicId,
  );

  recoverStaleProcessingEmails(
    now,
  );

  const recovered =
    getRow(
      stale.publicId,
    );

  if (
    recovered?.status !==
      "PENDING" ||
    recovered
      .processingStartedAt !==
        null ||
    !recovered
      .nextAttemptAt
  ) {
    throw new Error(
      "STALE_EMAIL_NOT_RECOVERED",
    );
  }

  console.log(
    "[PASS] Expired PROCESSING lease recovered",
  );

  console.log("");
  console.log(
    "[TEST 7] Exhausted stale job becomes terminal",
  );

  const exhausted =
    queue(
      "exhausted",
    );

  const exhaustedClaim =
    claimPendingEmails(
      25,
    ).find(
      (item) =>
        item.publicId ===
        exhausted.publicId,
    );

  if (!exhaustedClaim) {
    throw new Error(
      "EXHAUSTED_TEST_CLAIM_FAILED",
    );
  }

  db.prepare(`
    UPDATE email_outbox

    SET
      attempts = ?,
      processing_started_at = ?,
      updated_at = ?

    WHERE public_id = ?
  `).run(
    EMAIL_MAX_ATTEMPTS,
    staleTime,
    staleTime,
    exhausted.publicId,
  );

  recoverStaleProcessingEmails(
    now,
  );

  const exhaustedRow =
    getRow(
      exhausted.publicId,
    );

  if (
    exhaustedRow
      ?.status !==
        "FAILED" ||
    exhaustedRow
      .nextAttemptAt !==
        null
  ) {
    throw new Error(
      "EXHAUSTED_STALE_EMAIL_NOT_TERMINAL",
    );
  }

  console.log(
    "[PASS] Exhausted stale work becomes FAILED",
  );

  console.log("");
  console.log(
    "[TEST 8] Legacy FAILED migration",
  );

  const legacy =
    queue(
      "legacy",
    );

  db.prepare(`
    UPDATE email_outbox

    SET
      status = 'FAILED',
      attempts = 2,
      next_attempt_at = NULL

    WHERE public_id = ?
  `).run(
    legacy.publicId,
  );

  const legacyClaim =
    claimPendingEmails(
      25,
      new Date(
        "2030-01-01T00:00:00.000Z",
      ),
    ).find(
      (item) =>
        item.publicId ===
        legacy.publicId,
    );

  if (
    !legacyClaim ||
    legacyClaim.attempts !== 3
  ) {
    throw new Error(
      "LEGACY_FAILED_RECOVERY_FAILED",
    );
  }

  markEmailSent({
    id:
      legacyClaim.id,

    sentAt:
      new Date(
        "2030-01-01T00:00:01.000Z",
      ),
  });

  console.log(
    "[PASS] Pre-S1-D retryable FAILED row migrated",
  );

  console.log("");
  console.log(
    "[TEST 9] Production default transport fails closed",
  );

  const originalNodeEnv =
    env.NODE_ENV;

  env.NODE_ENV =
    "production";

  let productionBlocked =
    false;

  try {
    await dispatchEmailOutbox({
      limit:
        25,
    });
  } catch (error) {
    productionBlocked =
      error instanceof Error &&
      error.message ===
        "EMAIL_TRANSPORT_NOT_CONFIGURED_FOR_PRODUCTION";
  } finally {
    env.NODE_ENV =
      originalNodeEnv;
  }

  if (
    !productionBlocked
  ) {
    throw new Error(
      "PRODUCTION_LOG_TRANSPORT_NOT_BLOCKED",
    );
  }

  console.log(
    "[PASS] Production cannot silently use LOG_ONLY",
  );

  console.log("");
  console.log(
    "============================================================",
  );

  console.log(
    " S1-D EMAIL WORKER TEST PASS",
  );

  console.log(
    "============================================================",
  );

  console.log(
    "ATOMIC_CLAIM=PASS",
  );

  console.log(
    "SENT_TERMINAL=PASS",
  );

  console.log(
    "RETRY_BACKOFF=PASS",
  );

  console.log(
    "MAX_ATTEMPTS=PASS",
  );

  console.log(
    "FAILED_TERMINAL=PASS",
  );

  console.log(
    "STALE_PROCESSING_RECOVERY=PASS",
  );

  console.log(
    "LEGACY_FAILURE_MIGRATION=PASS",
  );

  console.log(
    "PRODUCTION_LOG_TRANSPORT=BLOCKED",
  );

  console.log(
    "EXTERNAL_EMAIL_SENT=NO",
  );
} finally {
  db.close();
}
