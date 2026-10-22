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
      "ox-economic-alert-delivery-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "delivery.sqlite",
  );

process.env.ECONOMIC_ALERT_DELIVERY_ENABLED =
  "true";

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
    dispatchEconomicAlerts,
  } =
    await import(
      "../services/economicAlertDeliveryService.js"
    );

  const {
    ECONOMIC_ALERT_MAX_ATTEMPTS,
    nextEconomicAlertRetryDelayMs,
  } =
    await import(
      "../economics/economicAlertDeliveryPolicy.js"
    );

  ensureEconomicAlertOutboxSchema();

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

  function insertAlert(
    id:
      string,

    key:
      string,
  ) {
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
        created_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?
      )
    `).run(
      id,
      "OX-ECONOMIC-ALERT-1",
      key,
      `incident-${id}`,
      `event-${id}`,
      "INCIDENT_OPENED",
      "CRITICAL",
      JSON.stringify({
        integrityState:
          "CRITICAL",

        authority: {
          governance:
            false,

          reserveMutation:
            false,

          blockchainTransaction:
            false,

          autoRepair:
            false,
        },
      }),
      "2026-10-22T00:00:00.000Z",
    );
  }

  /*
   * --------------------------------------------------
   * CASE A
   *
   * First delivery fails.
   * Retry later succeeds.
   * --------------------------------------------------
   */

  insertAlert(
    "alert-retry-success",
    "key-retry-success",
  );

  let adapterCalls =
    0;

  const retryThenSuccessAdapter = {
    async deliver() {
      adapterCalls +=
        1;

      if (
        adapterCalls ===
        1
      ) {
        throw new Error(
          "TEST_DELIVERY_FAILURE",
        );
      }
    },
  };

  const start =
    Date.parse(
      "2026-10-22T12:00:00.000Z",
    );

  const first =
    await dispatchEconomicAlerts({
      limit:
        10,

      adapter:
        retryThenSuccessAdapter,

      nowMs:
        start,
    });

  expect(
    first.processed ===
      1,
    "FIRST_DELIVERY_NOT_PROCESSED",
  );

  expect(
    first.retrying ===
      1,
    "FIRST_FAILURE_NOT_SCHEDULED_FOR_RETRY",
  );

  let row =
    db.prepare(`
      SELECT
        status,
        attempts,
        next_attempt_at AS nextAttemptAt,
        delivered_at AS deliveredAt,
        failed_at AS failedAt,
        lease_owner AS leaseOwner,
        lease_until AS leaseUntil

      FROM economic_alert_outbox

      WHERE id = ?
    `).get(
      "alert-retry-success",
    ) as {
      status:
        string;

      attempts:
        number;

      nextAttemptAt:
        string |
        null;

      deliveredAt:
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
    row.status ===
      "PENDING",
    "RETRY_STATUS_NOT_PENDING",
  );

  expect(
    Number(
      row.attempts,
    ) ===
      1,
    "RETRY_ATTEMPT_COUNT_INVALID",
  );

  expect(
    row.nextAttemptAt !==
      null,
    "RETRY_TIME_MISSING",
  );

  expect(
    row.leaseOwner ===
      null &&
    row.leaseUntil ===
      null,
    "LEASE_NOT_RELEASED_AFTER_FAILURE",
  );

  const tooEarly =
    await dispatchEconomicAlerts({
      limit:
        10,

      adapter:
        retryThenSuccessAdapter,

      nowMs:
        start +
        1_000,
    });

  expect(
    tooEarly.processed ===
      0,
    "RETRY_EXECUTED_TOO_EARLY",
  );

  const retryAt =
    start +
    nextEconomicAlertRetryDelayMs(
      1,
    ) +
    1;

  const successful =
    await dispatchEconomicAlerts({
      limit:
        10,

      adapter:
        retryThenSuccessAdapter,

      nowMs:
        retryAt,
    });

  expect(
    successful.delivered ===
      1,
    "RETRY_SUCCESS_NOT_DELIVERED",
  );

  row =
    db.prepare(`
      SELECT
        status,
        attempts,
        next_attempt_at AS nextAttemptAt,
        delivered_at AS deliveredAt,
        failed_at AS failedAt,
        lease_owner AS leaseOwner,
        lease_until AS leaseUntil

      FROM economic_alert_outbox

      WHERE id = ?
    `).get(
      "alert-retry-success",
    ) as typeof row;

  expect(
    row.status ===
      "DELIVERED",
    "SUCCESS_STATUS_NOT_DELIVERED",
  );

  expect(
    Number(
      row.attempts,
    ) ===
      1,
    "SUCCESS_CHANGED_FAILURE_ATTEMPTS",
  );

  expect(
    row.deliveredAt !==
      null,
    "DELIVERED_AT_MISSING",
  );

  expect(
    row.nextAttemptAt ===
      null,
    "DELIVERED_ALERT_STILL_HAS_RETRY",
  );

  expect(
    row.leaseOwner ===
      null &&
    row.leaseUntil ===
      null,
    "LEASE_NOT_RELEASED_AFTER_SUCCESS",
  );

  /*
   * --------------------------------------------------
   * CASE B
   *
   * Five delivery failures reach terminal FAILED.
   * --------------------------------------------------
   */

  insertAlert(
    "alert-terminal-failure",
    "key-terminal-failure",
  );

  const alwaysFailAdapter = {
    async deliver() {
      throw new Error(
        "TEST_TERMINAL_FAILURE",
      );
    },
  };

  let currentTime =
    Date.parse(
      "2026-10-23T12:00:00.000Z",
    );

  for (
    let attempt =
      1;
    attempt <=
      ECONOMIC_ALERT_MAX_ATTEMPTS;
    attempt +=
      1
  ) {
    const result =
      await dispatchEconomicAlerts({
        limit:
          10,

        adapter:
          alwaysFailAdapter,

        nowMs:
          currentTime,
      });

    expect(
      result.processed ===
        1,
      `TERMINAL_ATTEMPT_NOT_PROCESSED:${attempt}`,
    );

    const state =
      db.prepare(`
        SELECT
          status,
          attempts,
          next_attempt_at AS nextAttemptAt,
          failed_at AS failedAt,
          lease_owner AS leaseOwner,
          lease_until AS leaseUntil

        FROM economic_alert_outbox

        WHERE id = ?
      `).get(
        "alert-terminal-failure",
      ) as {
        status:
          string;

        attempts:
          number;

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
      Number(
        state.attempts,
      ) ===
        attempt,
      `ATTEMPT_COUNTER_INVALID:${attempt}`,
    );

    expect(
      state.leaseOwner ===
        null &&
      state.leaseUntil ===
        null,
      `LEASE_NOT_RELEASED:${attempt}`,
    );

    if (
      attempt <
      ECONOMIC_ALERT_MAX_ATTEMPTS
    ) {
      expect(
        state.status ===
          "PENDING",
        `PRETERMINAL_STATUS_INVALID:${attempt}`,
      );

      expect(
        state.nextAttemptAt !==
          null,
        `PRETERMINAL_RETRY_MISSING:${attempt}`,
      );

      currentTime +=
        nextEconomicAlertRetryDelayMs(
          attempt,
        ) +
        1;
    } else {
      expect(
        state.status ===
          "FAILED",
        "TERMINAL_STATUS_NOT_FAILED",
      );

      expect(
        state.failedAt !==
          null,
        "FAILED_AT_MISSING",
      );

      expect(
        state.nextAttemptAt ===
          null,
        "TERMINAL_FAILURE_HAS_RETRY",
      );
    }
  }

  console.log(
    "OX_ECONOMIC_ALERT_DELIVERY_SQLITE=PASS",
  );

  console.log(
    "PENDING_TO_RETRY=PASS",
  );

  console.log(
    "RETRY_TO_DELIVERED=PASS",
  );

  console.log(
    "EARLY_RETRY_BLOCKED=PASS",
  );

  console.log(
    "MAX_ATTEMPTS=" +
      ECONOMIC_ALERT_MAX_ATTEMPTS,
  );

  console.log(
    "TERMINAL_FAILED=PASS",
  );

  console.log(
    "LEASE_RELEASE=PASS",
  );

  console.log(
    "REAL_ALERT_SENT=NO",
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
