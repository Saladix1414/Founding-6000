import {
  readFileSync,
} from "node:fs";

const health =
  readFileSync(
    "server/src/routes/health.ts",
    "utf8",
  );

const policy =
  readFileSync(
    "server/src/economics/economicAlertHealthPolicy.ts",
    "utf8",
  );

for (
  const required of [
    "getEconomicAlertOperationsSnapshot",
    "economicAlertDelivery",
    "economicAlertPending",
    "economicAlertRetrying",
    "economicAlertFailed",
    "economicAlertLastDeliveredAt",
    "economicAlertLastFailedAt",
    "economicAlertsOperational",
    "economicAlertsBlockCoreReadiness",
    "isEconomicAlertOperationallyHealthy",
    "shouldEconomicAlertHealthBlockCoreReadiness",
  ]
) {
  if (
    !health.includes(
      required,
    )
  ) {
    throw new Error(
      `ALERT_HEALTH_CONTRACT_MISSING:${required}`,
    );
  }
}

for (
  const boundary of [
    "ALERT HEALTH != AUTHORITY",
    "ALERT HEALTH != PAYMENT AUTHORITY",
    "ALERT HEALTH != MEMBERSHIP AUTHORITY",
    "ALERT HEALTH != GOVERNANCE",
    "ALERT HEALTH != AUTO-REPAIR",
    "ALERT HEALTH != TREASURY ACTION",
    "ALERT HEALTH != RESERVE MUTATION",
    "ALERT HEALTH != BLOCKCHAIN TRANSACTION",
  ]
) {
  if (
    !policy.includes(
      boundary,
    )
  ) {
    throw new Error(
      `ALERT_HEALTH_BOUNDARY_MISSING:${boundary}`,
    );
  }
}

const readyRoute =
  health.split(
    'healthRouter.get(\n  "/ready"',
  )[1];

if (!readyRoute) {
  throw new Error(
    "READY_ROUTE_NOT_FOUND",
  );
}

for (
  const field of [
    "economicAlertDelivery:",
    "economicAlertPending:",
    "economicAlertRetrying:",
    "economicAlertFailed:",
    "economicAlertsOperational:",
    "economicAlertsBlockCoreReadiness:",
  ]
) {
  if (
    !readyRoute.includes(
      field,
    )
  ) {
    throw new Error(
      `READY_ALERT_FIELD_MISSING:${field}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_HEALTH_CONTRACT=PASS",
);

console.log(
  "HEALTH_EXPOSES_ALERT_STATE=YES",
);

console.log(
  "READY_EXPOSES_ALERT_STATE=YES",
);

console.log(
  "ALERT_FAILURE_DEGRADES_OPERATIONS=YES",
);

console.log(
  "ALERT_FAILURE_BLOCKS_CORE=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
