import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  env,
} from "../config/env.js";

import {
  ensureEconomicAlertOutboxSchema,
} from "../db/economicAlertOutboxSchema.js";

import {
  ECONOMIC_ALERT_DELIVERY_POLICY_VERSION,
  ECONOMIC_ALERT_LEASE_MS,
  nextEconomicAlertRetryDelayMs,
  shouldTerminallyFailEconomicAlert,
} from "../economics/economicAlertDeliveryPolicy.js";

export type EconomicAlertDeliveryPayload = {
  policyVersion:
    string;

  alertId:
    string;

  alertKey:
    string;

  incidentId:
    string;

  triggerType:
    string;

  severity:
    "WARNING" |
    "CRITICAL" |
    null;

  payload:
    Record<
      string,
      unknown
    >;
};

export type EconomicAlertDeliveryAdapter = {
  deliver(
    payload:
      EconomicAlertDeliveryPayload,
  ): Promise<void>;
};

type ClaimedAlertRow = {
  id:
    string;

  alertKey:
    string;

  incidentId:
    string;

  triggerType:
    string;

  severity:
    "WARNING" |
    "CRITICAL" |
    null;

  payloadJson:
    string;

  attempts:
    number;
};

ensureEconomicAlertOutboxSchema();

function sanitizeDeliveryError(
  error:
    unknown,
) {
  const raw =
    error instanceof Error
      ? error.message
      : String(error);

  return raw
    .replace(
      /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
      "Bearer [REDACTED]",
    )
    .slice(
      0,
      500,
    );
}

export function claimPendingEconomicAlerts(
  input?: {
    limit?:
      number;

    nowMs?:
      number;

    leaseOwner?:
      string;
  },
) {
  ensureEconomicAlertOutboxSchema();

  const limit =
    input?.limit ??
    25;

  if (
    !Number.isInteger(
      limit,
    ) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "INVALID_ECONOMIC_ALERT_DELIVERY_LIMIT",
    );
  }

  const now =
    input?.nowMs ??
    Date.now();

  const nowIso =
    new Date(
      now,
    ).toISOString();

  const leaseUntil =
    new Date(
      now +
        ECONOMIC_ALERT_LEASE_MS,
    ).toISOString();

  const leaseOwner =
    input?.leaseOwner ??
    `ead_${randomUUID()}`;

  const candidates =
    db.prepare(`
      SELECT
        id

      FROM economic_alert_outbox

      WHERE
        status = 'PENDING'

        AND (
          next_attempt_at IS NULL
          OR next_attempt_at <= ?
        )

        AND (
          lease_until IS NULL
          OR lease_until <= ?
        )

      ORDER BY
        created_at ASC,
        rowid ASC

      LIMIT ?
    `).all(
      nowIso,
      nowIso,
      limit,
    ) as Array<{
      id:
        string;
    }>;

  const claimed:
    ClaimedAlertRow[] =
    [];

  for (
    const candidate of
      candidates
  ) {
    const update =
      db.prepare(`
        UPDATE economic_alert_outbox

        SET
          lease_owner = ?,
          lease_until = ?

        WHERE
          id = ?
          AND status = 'PENDING'
          AND (
            lease_until IS NULL
            OR lease_until <= ?
          )
      `).run(
        leaseOwner,
        leaseUntil,
        candidate.id,
        nowIso,
      );

    if (
      Number(
        update.changes,
      ) !==
      1
    ) {
      continue;
    }

    const row =
      db.prepare(`
        SELECT
          id,

          alert_key
            AS alertKey,

          incident_id
            AS incidentId,

          trigger_type
            AS triggerType,

          severity,

          payload_json
            AS payloadJson,

          attempts

        FROM economic_alert_outbox

        WHERE
          id = ?
          AND lease_owner = ?

        LIMIT 1
      `).get(
        candidate.id,
        leaseOwner,
      ) as
        | ClaimedAlertRow
        | undefined;

    if (row) {
      claimed.push(
        row,
      );
    }
  }

  return {
    leaseOwner,

    leaseUntil,

    alerts:
      claimed,
  };
}

function markEconomicAlertDelivered(
  input: {
    id:
      string;

    leaseOwner:
      string;

    deliveredAt:
      string;
  },
) {
  const result =
    db.prepare(`
      UPDATE economic_alert_outbox

      SET
        status = 'DELIVERED',
        delivered_at = ?,
        failed_at = NULL,
        last_error = NULL,
        next_attempt_at = NULL,
        lease_owner = NULL,
        lease_until = NULL

      WHERE
        id = ?
        AND status = 'PENDING'
        AND lease_owner = ?
    `).run(
      input.deliveredAt,
      input.id,
      input.leaseOwner,
    );

  if (
    Number(
      result.changes,
    ) !==
    1
  ) {
    throw new Error(
      "ECONOMIC_ALERT_DELIVERY_LEASE_LOST",
    );
  }
}

function markEconomicAlertDeliveryFailure(
  input: {
    id:
      string;

    leaseOwner:
      string;

    currentAttempts:
      number;

    nowMs:
      number;

    error:
      unknown;
  },
) {
  const nextAttemptNumber =
    input.currentAttempts +
    1;

  const terminal =
    shouldTerminallyFailEconomicAlert(
      nextAttemptNumber,
    );

  const nowIso =
    new Date(
      input.nowMs,
    ).toISOString();

  const nextAttemptAt =
    terminal
      ? null
      : new Date(
          input.nowMs +
            nextEconomicAlertRetryDelayMs(
              nextAttemptNumber,
            ),
        ).toISOString();

  const result =
    db.prepare(`
      UPDATE economic_alert_outbox

      SET
        status = ?,
        attempts = ?,
        last_error = ?,
        next_attempt_at = ?,
        failed_at = ?,
        lease_owner = NULL,
        lease_until = NULL

      WHERE
        id = ?
        AND status = 'PENDING'
        AND lease_owner = ?
    `).run(
      terminal
        ? "FAILED"
        : "PENDING",

      nextAttemptNumber,

      sanitizeDeliveryError(
        input.error,
      ),

      nextAttemptAt,

      terminal
        ? nowIso
        : null,

      input.id,
      input.leaseOwner,
    );

  if (
    Number(
      result.changes,
    ) !==
    1
  ) {
    throw new Error(
      "ECONOMIC_ALERT_DELIVERY_LEASE_LOST",
    );
  }

  return {
    terminal,

    attempts:
      nextAttemptNumber,

    nextAttemptAt,
  };
}

export async function dispatchEconomicAlerts(
  input?: {
    limit?:
      number;

    adapter?:
      EconomicAlertDeliveryAdapter;

    nowMs?:
      number;
  },
) {
  /*
   * Fail closed.
   *
   * Disabled delivery does not claim alerts,
   * consume attempts or change outbox state.
   */
  if (
    !env
      .ECONOMIC_ALERT_DELIVERY_ENABLED
  ) {
    return {
      disabled:
        true,

      processed:
        0,

      delivered:
        0,

      retrying:
        0,

      failed:
        0,
    };
  }

  if (!input?.adapter) {
    throw new Error(
      "ECONOMIC_ALERT_DELIVERY_ADAPTER_REQUIRED",
    );
  }

  const now =
    input.nowMs ??
    Date.now();

  const claim =
    claimPendingEconomicAlerts({
      limit:
        input.limit,

      nowMs:
        now,
    });

  let delivered =
    0;

  let retrying =
    0;

  let failed =
    0;

  for (
    const alert of
      claim.alerts
  ) {
    try {
      const parsedPayload =
        JSON.parse(
          alert.payloadJson,
        ) as Record<
          string,
          unknown
        >;

      await input.adapter.deliver({
        policyVersion:
          ECONOMIC_ALERT_DELIVERY_POLICY_VERSION,

        alertId:
          alert.id,

        alertKey:
          alert.alertKey,

        incidentId:
          alert.incidentId,

        triggerType:
          alert.triggerType,

        severity:
          alert.severity,

        payload:
          parsedPayload,
      });

      markEconomicAlertDelivered({
        id:
          alert.id,

        leaseOwner:
          claim.leaseOwner,

        deliveredAt:
          new Date(
            now,
          ).toISOString(),
      });

      delivered +=
        1;
    } catch (error) {
      const failure =
        markEconomicAlertDeliveryFailure({
          id:
            alert.id,

          leaseOwner:
            claim.leaseOwner,

          currentAttempts:
            Number(
              alert.attempts,
            ),

          nowMs:
            now,

          error,
        });

      if (
        failure.terminal
      ) {
        failed +=
          1;
      } else {
        retrying +=
          1;
      }
    }
  }

  return {
    disabled:
      false,

    processed:
      claim.alerts.length,

    delivered,

    retrying,

    failed,
  };
}
