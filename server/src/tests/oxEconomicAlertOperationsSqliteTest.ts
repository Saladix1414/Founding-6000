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
      "ox-alert-ops-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "ops.sqlite",
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
    getEconomicAlertOperationsSnapshot,
  } =
    await import(
      "../services/economicAlertOperationsService.js"
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

  function insert(
    input: {
      id:
        string;

      key:
        string;

      status:
        "PENDING" |
        "DELIVERED" |
        "FAILED";

      nextAttemptAt?:
        string |
        null;

      leaseUntil?:
        string |
        null;

      deliveredAt?:
        string |
        null;

      failedAt?:
        string |
        null;
    },
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
        created_at,
        delivered_at,
        failed_at,
        next_attempt_at,
        lease_until
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      input.id,
      "OX-ECONOMIC-ALERT-1",
      input.key,
      `incident-${input.id}`,
      `event-${input.id}`,
      "INCIDENT_OPENED",
      "CRITICAL",
      input.status,
      "{}",
      "2026-10-22T00:00:00.000Z",
      input.deliveredAt ??
        null,
      input.failedAt ??
        null,
      input.nextAttemptAt ??
        null,
      input.leaseUntil ??
        null,
    );
  }

  insert({
    id:
      "pending-1",

    key:
      "pending-key",

    status:
      "PENDING",
  });

  insert({
    id:
      "retry-1",

    key:
      "retry-key",

    status:
      "PENDING",

    nextAttemptAt:
      "2026-10-22T12:10:00.000Z",
  });

  insert({
    id:
      "leased-1",

    key:
      "leased-key",

    status:
      "PENDING",

    leaseUntil:
      "2026-10-22T12:30:00.000Z",
  });

  insert({
    id:
      "delivered-1",

    key:
      "delivered-key",

    status:
      "DELIVERED",

    deliveredAt:
      "2026-10-22T11:00:00.000Z",
  });

  insert({
    id:
      "failed-1",

    key:
      "failed-key",

    status:
      "FAILED",

    failedAt:
      "2026-10-22T11:30:00.000Z",
  });

  const snapshot =
    getEconomicAlertOperationsSnapshot({
      nowMs:
        Date.parse(
          "2026-10-22T12:00:00.000Z",
        ),
    });

  expect(
    snapshot.enabled ===
      true,
    "DELIVERY_ENABLED_INVALID",
  );

  expect(
    snapshot.health ===
      "FAILED",
    `HEALTH_INVALID:${snapshot.health}`,
  );

  expect(
    snapshot.counts.total ===
      5,
    "TOTAL_COUNT_INVALID",
  );

  expect(
    snapshot.counts.pending ===
      3,
    "PENDING_COUNT_INVALID",
  );

  expect(
    snapshot.counts.retrying ===
      1,
    "RETRY_COUNT_INVALID",
  );

  expect(
    snapshot.counts.leased ===
      1,
    "LEASED_COUNT_INVALID",
  );

  expect(
    snapshot.counts.delivered ===
      1,
    "DELIVERED_COUNT_INVALID",
  );

  expect(
    snapshot.counts.failed ===
      1,
    "FAILED_COUNT_INVALID",
  );

  expect(
    snapshot.timestamps.lastDeliveredAt ===
      "2026-10-22T11:00:00.000Z",
    "LAST_DELIVERED_AT_INVALID",
  );

  expect(
    snapshot.timestamps.lastFailedAt ===
      "2026-10-22T11:30:00.000Z",
    "LAST_FAILED_AT_INVALID",
  );

  expect(
    snapshot.timestamps.nextRetryAt ===
      "2026-10-22T12:10:00.000Z",
    "NEXT_RETRY_AT_INVALID",
  );

  expect(
    snapshot
      .authority
      .governance ===
      false &&
    snapshot
      .authority
      .reserveMutation ===
      false &&
    snapshot
      .authority
      .blockchainTransaction ===
      false &&
    snapshot
      .authority
      .treasuryAction ===
      false &&
    snapshot
      .authority
      .autoRepair ===
      false,
    "OBSERVABILITY_GAINED_AUTHORITY",
  );

  console.log(
    "OX_ECONOMIC_ALERT_OPERATIONS_SQLITE=PASS",
  );

  console.log(
    "TOTAL=5",
  );

  console.log(
    "PENDING=3",
  );

  console.log(
    "RETRYING=1",
  );

  console.log(
    "LEASED=1",
  );

  console.log(
    "DELIVERED=1",
  );

  console.log(
    "FAILED=1",
  );

  console.log(
    "HEALTH=FAILED",
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
