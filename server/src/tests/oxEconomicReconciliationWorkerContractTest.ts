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
  "RECONCILIATION_INTERVAL_MS",
  "async function runReconciliationCycle()",
  "ECONOMIC_RECONCILIATION_CYCLE_COMPLETE",
  "ECONOMIC_RECONCILIATION_CYCLE_FAILED",
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

/*
 * One occurrence belongs to the interval callback.
 * Another must belong to the immediate startup run.
 */
const reconciliationCalls =
  schedule.match(
    /void runReconciliationCycle\(\);/g,
  ) ?? [];

if (
  reconciliationCalls.length <
    2
) {
  throw new Error(
    "INITIAL_RECONCILIATION_CYCLE_MISSING",
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
 * Reconciliation must not depend on the reserve
 * sweep feature flag.
 */
const initialReconciliationPosition =
  schedule.indexOf(
    immediateAnchor,
  );

const reserveConditionalPosition =
  schedule.indexOf(
    `if (
    env.RESERVE_SWEEP_ENABLED
  ) {`,
    initialReconciliationPosition,
  );

if (
  initialReconciliationPosition ===
    -1 ||
  reserveConditionalPosition ===
    -1 ||
  initialReconciliationPosition >
    reserveConditionalPosition
) {
  throw new Error(
    "INITIAL_RECONCILIATION_DEPENDS_ON_RESERVE_SWEEP",
  );
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_WORKER_CONTRACT=PASS",
);

console.log(
  "INTERVAL_RECONCILIATION=YES",
);

console.log(
  "INITIAL_RECONCILIATION=YES",
);

console.log(
  "RESERVE_SWEEP_DEPENDENCY=NO",
);
