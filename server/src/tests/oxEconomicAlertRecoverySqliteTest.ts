import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

const temporaryDirectory =
  mkdtempSync(
    join(
      tmpdir(),
      "ox-alert-recovery-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "recovery.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    ensureEconomicAlertOutboxSchema,
  } =
    await import(
      "../db/economicAlertOutboxSchema.js"
    );

  const {
    ensureEconomicAlertRecoverySchema,
  } =
    await import(
      "../db/economicAlertRecoverySchema.js"
    );

  const {
    requeueFailedEconomicAlert,
  } =
    await import(
      "../services/economicAlertRecoveryService.js"
    );

  ensureEconomicAlertOutboxSchema();
  ensureEconomicAlertRecoverySchema();

  function expect(
    condition:
      boolean,

    message:
      string,
  ) {
    if (!condition) {
      throw new Error(
        message,
      );
    }
  }

  db.prepare(`
    INSERT INTO economic_alert_outbox (
      id,
      alert_policy_version,
      alert_key,
      incident_id,
      incident_event_id,
      trigger_type,
      severity,
      status,
      payload_json,
      created_at,
      failed_at,
      attempts,
      last_error
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, ?, ?, ?, ?
    )
  `).run(
    "failed-alert-1",
    "OX-ECONOMIC-ALERT-1",
    "failed-key-1",
    "incident-1",
    "event-1",
    "INCIDENT_OPENED",
    "CRITICAL",
    "{}",
    "2026-10-22T00:00:00.000Z",
    "2026-10-22T01:00:00.000Z",
    5,
    "TEST_FAILURE",
  );

  const result =
    requeueFailedEconomicAlert({
      alertId:
        "failed-alert-1",

      idempotencyKey:
        "manual-recovery-001",

      reason:
        "Operator verified destination availability",

      nowMs:
        Date.parse(
          "2026-10-22T13:00:00.000Z",
        ),
    });

  expect(
    result.recovered ===
      true,
    "RECOVERY_NOT_APPLIED",
  );

  expect(
    result.idempotentReplay ===
      false,
    "FIRST_RECOVERY_MARKED_REPLAY",
  );

  const alert =
    db.prepare(`
      SELECT
        status,
        attempts,
        last_error AS lastError,
        next_attempt_at AS nextAttemptAt,
        failed_at AS failedAt,
        lease_owner AS leaseOwner,
        lease_until AS leaseUntil

      FROM economic_alert_outbox

      WHERE id = ?
    `).get(
      "failed-alert-1",
    ) as {
      status:
        string;

      attempts:
        number;

      lastError:
        string |
        null;

      nextAttemptAt:
        string |
        null;

      failedAt:
        string |
        null;

      leaseOwner:
        string |
        null;

      leaseUntil:
        string |
        null;
    };

  expect(
    alert.status ===
      "PENDING",
    "RECOVERED_ALERT_NOT_PENDING",
  );

  expect(
    Number(
      alert.attempts,
    ) ===
      0,
    "RECOVERY_ATTEMPTS_NOT_RESET",
  );

  expect(
    alert.lastError ===
      null &&
    alert.nextAttemptAt ===
      null &&
    alert.failedAt ===
      null &&
    alert.leaseOwner ===
      null &&
    alert.leaseUntil ===
      null,
    "RECOVERY_STATE_NOT_CLEARED",
  );

  const auditCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_alert_recovery_events
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      auditCount.count,
    ) ===
      1,
    "RECOVERY_AUDIT_COUNT_INVALID",
  );

  /*
   * Same idempotency key must not perform
   * the recovery twice.
   */
  const replay =
    requeueFailedEconomicAlert({
      alertId:
        "failed-alert-1",

      idempotencyKey:
        "manual-recovery-001",

      reason:
        "Operator verified destination availability",

      nowMs:
        Date.parse(
          "2026-10-22T13:01:00.000Z",
        ),
    });

  expect(
    replay.recovered ===
      false &&
    replay.idempotentReplay ===
      true,
    "RECOVERY_REPLAY_NOT_IDEMPOTENT",
  );

  const auditCountAfterReplay =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_alert_recovery_events
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      auditCountAfterReplay.count,
    ) ===
      1,
    "RECOVERY_REPLAY_CREATED_DUPLICATE_AUDIT",
  );

  /*
   * A non-failed alert cannot be manually requeued.
   */
  let nonFailedRejected =
    false;

  try {
    requeueFailedEconomicAlert({
      alertId:
        "failed-alert-1",

      idempotencyKey:
        "manual-recovery-002",

      reason:
        "Should fail because state is already pending",
    });
  } catch (error) {
    nonFailedRejected =
      error instanceof Error &&
      error.message ===
        "ECONOMIC_ALERT_NOT_FAILED";
  }

  expect(
    nonFailedRejected,
    "NON_FAILED_ALERT_RECOVERY_NOT_REJECTED",
  );

  /*
   * Recovery ledger is append-only.
   */
  let updateGuard =
    false;

  try {
    db.prepare(`
      UPDATE economic_alert_recovery_events
      SET reason = 'tampered'
    `).run();
  } catch {
    updateGuard =
      true;
  }

  expect(
    updateGuard,
    "RECOVERY_AUDIT_UPDATE_GUARD_FAILED",
  );

  let deleteGuard =
    false;

  try {
    db.prepare(`
      DELETE FROM economic_alert_recovery_events
    `).run();
  } catch {
    deleteGuard =
      true;
  }

  expect(
    deleteGuard,
    "RECOVERY_AUDIT_DELETE_GUARD_FAILED",
  );

  console.log(
    "OX_ECONOMIC_ALERT_RECOVERY_SQLITE=PASS",
  );

  console.log(
    "FAILED_TO_PENDING=PASS",
  );

  console.log(
    "ATTEMPTS_RESET=PASS",
  );

  console.log(
    "AUDIT_EVENT=PASS",
  );

  console.log(
    "IDEMPOTENT_REPLAY=PASS",
  );

  console.log(
    "NON_FAILED_REJECTED=PASS",
  );

  console.log(
    "APPEND_ONLY_UPDATE_GUARD=PASS",
  );

  console.log(
    "APPEND_ONLY_DELETE_GUARD=PASS",
  );

  console.log(
    "ALERT_DELIVERY_EXECUTED=NO",
  );

  console.log(
    "ECONOMIC_AUTHORITY=NO",
  );
} finally {
  rmSync(
    temporaryDirectory,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
