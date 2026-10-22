import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEconomicAlertOutboxSchema,
} from "../db/economicAlertOutboxSchema.js";

import {
  ensureEconomicAlertRecoverySchema,
} from "../db/economicAlertRecoverySchema.js";

ensureEconomicAlertOutboxSchema();
ensureEconomicAlertRecoverySchema();

type FailedAlertRow = {
  id:
    string;

  status:
    string;

  attempts:
    number;
};

type RecoveryEventRow = {
  id:
    string;

  alertId:
    string;

  idempotencyKey:
    string;

  previousAttempts:
    number;

  reason:
    string;

  recoveredAt:
    string;
};

function getRecoveryByIdempotencyKey(
  idempotencyKey:
    string,
) {
  return db.prepare(`
    SELECT
      id,

      alert_id
        AS alertId,

      idempotency_key
        AS idempotencyKey,

      previous_attempts
        AS previousAttempts,

      reason,

      recovered_at
        AS recoveredAt

    FROM economic_alert_recovery_events

    WHERE
      idempotency_key = ?

    LIMIT 1
  `).get(
    idempotencyKey,
  ) as
    | RecoveryEventRow
    | undefined;
}

/*
 * Manual recovery is intentionally narrow:
 *
 * FAILED -> PENDING
 *
 * It does NOT:
 * - deliver the alert
 * - create or resolve incidents
 * - mutate reserve state
 * - move treasury funds
 * - execute blockchain transactions
 * - perform auto-repair
 */
export function requeueFailedEconomicAlert(
  input: {
    alertId:
      string;

    idempotencyKey:
      string;

    reason:
      string;

    nowMs?:
      number;
  },
) {
  const alertId =
    input.alertId.trim();

  const idempotencyKey =
    input.idempotencyKey.trim();

  const reason =
    input.reason.trim();

  if (
    alertId.length <
      1 ||
    alertId.length >
      256
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_ID",
    );
  }

  if (
    idempotencyKey.length <
      8 ||
    idempotencyKey.length >
      256
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_RECOVERY_IDEMPOTENCY_KEY",
    );
  }

  if (
    reason.length <
      3 ||
    reason.length >
      500
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_RECOVERY_REASON",
    );
  }

  ensureEconomicAlertOutboxSchema();
  ensureEconomicAlertRecoverySchema();

  const existing =
    getRecoveryByIdempotencyKey(
      idempotencyKey,
    );

  if (existing) {
    if (
      existing.alertId !==
      alertId
    ) {
      throw new Error(
        "ECONOMIC_ALERT_RECOVERY_IDEMPOTENCY_CONFLICT",
      );
    }

    return {
      recovered:
        false,

      idempotentReplay:
        true,

      event:
        existing,
    };
  }

  const recoveredAt =
    new Date(
      input.nowMs ??
      Date.now(),
    ).toISOString();

  const recoveryId =
    `ear_${randomUUID()}`;

  db.exec(
    "BEGIN IMMEDIATE;",
  );

  try {
    /*
     * Re-check inside transaction to protect against
     * concurrent recovery attempts.
     */
    const replay =
      getRecoveryByIdempotencyKey(
        idempotencyKey,
      );

    if (replay) {
      if (
        replay.alertId !==
        alertId
      ) {
        throw new Error(
          "ECONOMIC_ALERT_RECOVERY_IDEMPOTENCY_CONFLICT",
        );
      }

      db.exec(
        "COMMIT;",
      );

      return {
        recovered:
          false,

        idempotentReplay:
          true,

        event:
          replay,
      };
    }

    const alert =
      db.prepare(`
        SELECT
          id,
          status,
          attempts

        FROM economic_alert_outbox

        WHERE
          id = ?

        LIMIT 1
      `).get(
        alertId,
      ) as
        | FailedAlertRow
        | undefined;

    if (!alert) {
      throw new Error(
        "ECONOMIC_ALERT_NOT_FOUND",
      );
    }

    if (
      alert.status !==
      "FAILED"
    ) {
      throw new Error(
        "ECONOMIC_ALERT_NOT_FAILED",
      );
    }

    db.prepare(`
      INSERT INTO economic_alert_recovery_events (
        id,
        alert_id,
        idempotency_key,
        previous_attempts,
        reason,
        recovered_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      recoveryId,
      alert.id,
      idempotencyKey,
      Number(
        alert.attempts,
      ),
      reason,
      recoveredAt,
    );

    const updated =
      db.prepare(`
        UPDATE economic_alert_outbox

        SET
          status = 'PENDING',
          attempts = 0,
          last_error = NULL,
          next_attempt_at = NULL,
          failed_at = NULL,
          lease_owner = NULL,
          lease_until = NULL

        WHERE
          id = ?
          AND status = 'FAILED'
      `).run(
        alert.id,
      );

    if (
      Number(
        updated.changes,
      ) !==
      1
    ) {
      throw new Error(
        "ECONOMIC_ALERT_RECOVERY_STATE_CHANGED",
      );
    }

    db.exec(
      "COMMIT;",
    );

    const event =
      getRecoveryByIdempotencyKey(
        idempotencyKey,
      );

    if (!event) {
      throw new Error(
        "ECONOMIC_ALERT_RECOVERY_EVENT_MISSING",
      );
    }

    return {
      recovered:
        true,

      idempotentReplay:
        false,

      event,
    };
  } catch (error) {
    try {
      db.exec(
        "ROLLBACK;",
      );
    } catch {
      // Best effort rollback.
    }

    throw error;
  }
}
