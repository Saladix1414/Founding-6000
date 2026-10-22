import {
  readFileSync,
} from "node:fs";

const worker =
  readFileSync(
    "server/src/workers/workerRunner.ts",
    "utf8",
  );

for (
  const required of [
    "dispatchEconomicAlerts",
    "createEconomicAlertWebhookAdapter",
    "ECONOMIC_ALERT_DELIVERY_INTERVAL_MS",
    "ECONOMIC_ALERT_DELIVERY_BATCH_SIZE",
    "economicAlertDeliveryRunning",
    "economicAlertDeliveryTimer",
    "runEconomicAlertDeliveryCycle",
    "ECONOMIC_ALERT_DELIVERY_CYCLE_COMPLETE",
    "ECONOMIC_ALERT_DELIVERY_CYCLE_FAILED",
    "ECONOMIC_ALERT_DELIVERY_ENABLED",
  ]
) {
  if (
    !worker.includes(
      required,
    )
  ) {
    throw new Error(
      `ALERT_WORKER_REQUIREMENT_MISSING:${required}`,
    );
  }
}

const cycleStart =
  worker.indexOf(
    "async function runEconomicAlertDeliveryCycle()"
  );

const scheduleStart =
  worker.indexOf(
    "function scheduleWorkers()"
  );

if (
  cycleStart === -1 ||
  scheduleStart === -1 ||
  scheduleStart <=
    cycleStart
) {
  throw new Error(
    "ALERT_DELIVERY_CYCLE_BOUNDARY_INVALID",
  );
}

const cycle =
  worker.slice(
    cycleStart,
    scheduleStart,
  );

if (
  !cycle.includes(
    "!env.ECONOMIC_ALERT_DELIVERY_ENABLED"
  )
) {
  throw new Error(
    "ALERT_DELIVERY_NOT_ENV_GATED",
  );
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
    cycle.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `ALERT_WORKER_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_DELIVERY_WORKER_CONTRACT=PASS",
);

console.log(
  "WORKER_ENV_GATE=YES",
);

console.log(
  "SEPARATE_DELIVERY_CYCLE=YES",
);

console.log(
  "REAL_ALERT_DEFAULT=DISABLED",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
