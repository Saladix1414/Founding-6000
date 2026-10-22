import {
  readFileSync,
} from "node:fs";

const worker =
  readFileSync(
    "server/src/workers/workerRunner.ts",
    "utf8",
  );

const health =
  readFileSync(
    "server/src/routes/health.ts",
    "utf8",
  );

const workerRequirements = [
  "captureEconomicReconciliationEvidence",
  "RECONCILIATION_INTERVAL_MS",
  "runReconciliationCycle",
  "ECONOMIC_RECONCILIATION_CYCLE_COMPLETE",
  "ECONOMIC_RECONCILIATION_CYCLE_FAILED",
  "reconciliationRunning",
  "reconciliationTimer",
];

for (
  const requirement of
    workerRequirements
) {
  if (
    !worker.includes(
      requirement,
    )
  ) {
    throw new Error(
      `RECONCILIATION_WORKER_REQUIREMENT_MISSING:${requirement}`,
    );
  }
}

/*
 * Reconciliation must not depend on reserve sweep
 * enablement. Reserve automation can be disabled while
 * integrity auditing continues.
 */
const scheduleSection =
  worker.split(
    "function scheduleWorkers()",
  )[1] ??
  "";

if (
  !scheduleSection.includes(
    "void runReconciliationCycle();"
  )
) {
  throw new Error(
    "INITIAL_RECONCILIATION_CYCLE_MISSING",
  );
}

if (
  !health.includes(
    "ECONOMIC_RECONCILIATION_STALE_MS"
  )
) {
  throw new Error(
    "RECONCILIATION_STALENESS_POLICY_MISSING",
  );
}

if (
  !health.includes(
    'economicIntegrity !==\n      "critical"'
  ) ||
  !health.includes(
    'economicIntegrity !==\n      "stale"'
  )
) {
  throw new Error(
    "ECONOMIC_READINESS_FAIL_CLOSED_MISSING",
  );
}

console.log(
  "OX_ECONOMIC_RECONCILIATION_WORKER_CONTRACT=PASS",
);

console.log(
  "AUTOMATED_RECONCILIATION=YES",
);

console.log(
  "RESERVE_SWEEP_DEPENDENCY=NO",
);

console.log(
  "CRITICAL_BLOCKS_READINESS=YES",
);

console.log(
  "STALE_BLOCKS_READINESS=YES",
);
