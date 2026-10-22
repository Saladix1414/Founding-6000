import {
  readFileSync,
} from "node:fs";

const schema =
  readFileSync(
    "server/src/db/workerHealthSchema.ts",
    "utf8",
  );

const repository =
  readFileSync(
    "server/src/repositories/workerHealthRepository.ts",
    "utf8",
  );

const migration =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

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

for (
  const source of [
    schema,
    repository,
    migration,
    worker,
    health,
  ]
) {
  if (
    !source.includes(
      "economic_alert_delivery"
    )
  ) {
    throw new Error(
      "ALERT_WORKER_HEALTH_IDENTIFIER_MISSING",
    );
  }
}

for (
  const required of [
    'recordWorkerCycleStarted(\n    "economic_alert_delivery"',
    'recordWorkerCycleCompleted(\n      "economic_alert_delivery"',
    'recordWorkerCycleFailed(\n      "economic_alert_delivery"',
  ]
) {
  if (
    !worker.includes(
      required,
    )
  ) {
    throw new Error(
      `ALERT_WORKER_HEARTBEAT_MISSING:${required}`,
    );
  }
}

if (
  !migration.includes(
    '"018_economic_alert_delivery_worker_health"'
  )
) {
  throw new Error(
    "MIGRATION_018_MISSING",
  );
}

for (
  const required of [
    "economicAlertDeliveryWorker",
    "economicAlertWorkerOperational",
    "economicAlertsOperational",
  ]
) {
  if (
    !health.includes(
      required,
    )
  ) {
    throw new Error(
      `ALERT_HEALTH_WORKER_FIELD_MISSING:${required}`,
    );
  }
}

for (
  const forbidden of [
    "sendTransaction(",
    "signTransaction(",
    "wallet.send",
    "UPDATE reserve_",
    "DELETE FROM reserve_",
    "INSERT INTO reserve_",
  ]
) {
  if (
    worker.includes(
      forbidden,
    ) &&
    worker
      .split(
        "async function runEconomicAlertDeliveryCycle()"
      )[1]
      ?.split(
        "function scheduleWorkers()"
      )[0]
      ?.includes(
        forbidden,
      )
  ) {
    throw new Error(
      `ALERT_WORKER_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_WORKER_HEALTH_CONTRACT=PASS",
);

console.log(
  "WORKER_HEARTBEAT=YES",
);

console.log(
  "MIGRATION_018=YES",
);

console.log(
  "HEALTH_INTEGRATION=YES",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
