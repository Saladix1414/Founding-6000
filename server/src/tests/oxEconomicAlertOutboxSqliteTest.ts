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
      "ox-economic-alert-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    temporaryDirectory,
    "alerts.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    recordEconomicIntegrityObservation,
  } =
    await import(
      "../services/economicIntegrityIncidentService.js"
    );

  const {
    syncEconomicIncidentAlerts,
    getPendingEconomicAlerts,
  } =
    await import(
      "../services/economicAlertOutboxService.js"
    );

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

  /*
   * No incident / no alert.
   */
  recordEconomicIntegrityObservation({
    state:
      "OK",

    reportHash:
      "report-ok-initial",
  });

  let sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      0,
    "HEALTHY_STATE_CREATED_ALERT",
  );

  /*
   * Incident #1 OPENED.
   */
  const warning =
    recordEconomicIntegrityObservation({
      state:
        "WARNING",

      reportHash:
        "report-warning-1",

      failingCodes: [
        "LATEST_RESERVE_SNAPSHOT_AVAILABLE",
      ],
    });

  expect(
    warning.event
      ?.eventType ===
      "OPENED",
    "WARNING_INCIDENT_NOT_OPENED",
  );

  sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      1,
    "WARNING_OPEN_ALERT_NOT_CREATED",
  );

  /*
   * Same incident OBSERVED twice.
   *
   * Only ONE INCIDENT_OBSERVED alert may exist.
   */
  recordEconomicIntegrityObservation({
    state:
      "WARNING",

    reportHash:
      "report-warning-2",

    failingCodes: [
      "LATEST_RESERVE_SNAPSHOT_AVAILABLE",
    ],
  });

  recordEconomicIntegrityObservation({
    state:
      "WARNING",

    reportHash:
      "report-warning-3",

    failingCodes: [
      "LATEST_RESERVE_SNAPSHOT_AVAILABLE",
    ],
  });

  sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      1,
    "OBSERVED_ALERT_DEDUPE_INVALID",
  );

  /*
   * New CRITICAL fingerprint:
   *
   * - old incident RESOLVED
   * - new incident OPENED
   *
   * Synchronizer must detect BOTH durable events.
   */
  recordEconomicIntegrityObservation({
    state:
      "CRITICAL",

    reportHash:
      "report-critical-1",

    failingCodes: [
      "RESERVE_WATERFALL_RECONCILES",
    ],
  });

  sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      2,
    "SUPERSEDE_TRANSITION_ALERTS_INVALID",
  );

  /*
   * New incident recovers.
   */
  recordEconomicIntegrityObservation({
    state:
      "OK",

    reportHash:
      "report-ok-recovered",
  });

  sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      1,
    "RECOVERY_ALERT_NOT_CREATED",
  );

  const pending =
    getPendingEconomicAlerts(
      50,
    ) as Array<{
      triggerType:
        string;

      severity:
        string |
        null;

      status:
        string;
    }>;

  /*
   * Expected:
   *
   * Incident #1:
   * OPENED
   * OBSERVED
   * RESOLVED
   *
   * Incident #2:
   * OPENED
   * RESOLVED
   *
   * Total = 5
   */
  expect(
    pending.length ===
      5,
    `ALERT_COUNT_INVALID:${pending.length}`,
  );

  const observedCount =
    pending.filter(
      (row) =>
        row.triggerType ===
        "INCIDENT_OBSERVED",
    ).length;

  expect(
    observedCount ===
      1,
    "OBSERVED_ALERT_STORM_NOT_PREVENTED",
  );

  const resolvedRows =
    pending.filter(
      (row) =>
        row.triggerType ===
        "INCIDENT_RESOLVED",
    );

  expect(
    resolvedRows.length ===
      2,
    "RESOLUTION_ALERT_COUNT_INVALID",
  );

  expect(
    resolvedRows.every(
      (row) =>
        row.severity ===
        null,
    ),
    "RESOLVED_ALERT_HAS_SEVERITY",
  );

  expect(
    pending.every(
      (row) =>
        row.status ===
        "PENDING",
    ),
    "ALERT_DELIVERY_OCCURRED_DURING_SYNC",
  );

  /*
   * Re-sync must create nothing.
   */
  sync =
    syncEconomicIncidentAlerts();

  expect(
    sync.created ===
      0,
    "ALERT_RESYNC_NOT_IDEMPOTENT",
  );

  const countRow =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_alert_outbox
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      countRow.count,
    ) ===
      5,
    "ALERT_OUTBOX_FINAL_COUNT_INVALID",
  );

  console.log(
    "OX_ECONOMIC_ALERT_OUTBOX_SQLITE=PASS",
  );

  console.log(
    "INCIDENT_OPEN_ALERT=PASS",
  );

  console.log(
    "OBSERVED_DEDUPE=PASS",
  );

  console.log(
    "SUPERSEDED_RESOLUTION_ALERT=PASS",
  );

  console.log(
    "RECOVERY_ALERT=PASS",
  );

  console.log(
    "RESYNC_IDEMPOTENT=PASS",
  );

  console.log(
    "DELIVERY_EXECUTION=NO",
  );

  console.log(
    "AUTO_REPAIR=NO",
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
