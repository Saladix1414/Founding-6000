import {
  readFileSync,
} from "node:fs";

const worker =
  readFileSync(
    "server/src/workers/workerRunner.ts",
    "utf8",
  );

const required = [
  "captureEconomicReconciliationEvidence",
  "recordEconomicIntegrityObservation",
  "syncEconomicIncidentAlerts",
  "RECONCILIATION_INTERVAL_MS",
  "async function runReconciliationCycle()",
  "ECONOMIC_RECONCILIATION_CYCLE_COMPLETE",
  "ECONOMIC_RECONCILIATION_CYCLE_FAILED",
  "failingCodes",
  "incidentAction",
  "alertSyncScanned",
  "alertSyncCreated",
  "alertSyncReplayed",
  "reconciliationRunning",
  "reconciliationTimer",
];

for (
  const value of
    required
) {
  if (
    !worker.includes(
      value,
    )
  ) {
    throw new Error(
      `RECONCILIATION_WORKER_CONTRACT_MISSING:${value}`,
    );
  }
}

const scheduleStart =
  worker.indexOf(
    "function scheduleWorkers()"
  );

const shutdownStart =
  worker.indexOf(
    "async function shutdown("
  );

if (
  scheduleStart === -1 ||
  shutdownStart === -1 ||
  shutdownStart <=
    scheduleStart
) {
  throw new Error(
    "WORKER_SCHEDULE_BOUNDARY_NOT_FOUND",
  );
}

const schedule =
  worker.slice(
    scheduleStart,
    shutdownStart,
  );

const reconciliationCalls =
  schedule.match(
    /void runReconciliationCycle\(\);/g,
  ) ?? [];

if (
  reconciliationCalls.length <
    2
) {
  throw new Error(
    "INITIAL_OR_PERIODIC_RECONCILIATION_MISSING",
  );
}

const immediateAnchor =
  `void runEmailCycle();
  void runUsdtCycle();
  void runReconciliationCycle();`;

if (
  !schedule.includes(
    immediateAnchor,
  )
) {
  throw new Error(
    "RECONCILIATION_NOT_RUN_AT_WORKER_START",
  );
}

/*
 * Alert sync may populate the outbox only.
 *
 * It must not become delivery, treasury,
 * governance or repair authority.
 */
const forbidden = [
  "sendTransaction(",
  "signTransaction(",
  "wallet.send",
  "AUTO_REPAIR",
  "dispatchEconomicAlert",
  "sendEconomicAlert",
  "deliverEconomicAlert",
];

for (
  const value of
    forbidden
) {
  if (
    worker.includes(
      value,
    )
  ) {
    throw new Error(
      `WORKER_GAINED_FORBIDDEN_ALERT_AUTHORITY:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_WORKER_CONTRACT=PASS",
);

console.log(
  "INITIAL_RECONCILIATION=YES",
);

console.log(
  "PERIODIC_RECONCILIATION=YES",
);

console.log(
  "INCIDENT_OBSERVATION=YES",
);

console.log(
  "ALERT_OUTBOX_SYNC=YES",
);

console.log(
  "ALERT_DELIVERY=NO",
);

console.log(
  "AUTO_REPAIR=NO",
);
