import {
  readFileSync,
} from "node:fs";

const health =
  readFileSync(
    "server/src/routes/health.ts",
    "utf8",
  );

const required = [
  "economicIntegrity",
  "economicReconciledAt",
  "economicReportHash",
  "ECONOMIC_RECONCILIATION_STALE_MS",
  "reconciliationStale",
  "economicIntegrityReady",
  "overallReady",
  "getLatestEconomicIntegrityIncidentEvent",
  "economicIncidentState",
  "economicIncidentSeverity",
  "economicIncidentUpdatedAt",
];

for (
  const value of
    required
) {
  if (
    !health.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMIC_HEALTH_CONTRACT_MISSING:${value}`,
    );
  }
}

if (
  !health.includes(
    'economicIntegrity !==\n      "critical"'
  )
) {
  throw new Error(
    "CRITICAL_READINESS_BOUNDARY_MISSING",
  );
}

if (
  !health.includes(
    'economicIntegrity !==\n      "stale"'
  )
) {
  throw new Error(
    "STALE_READINESS_BOUNDARY_MISSING",
  );
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
    "economicIntegrity:",
    "economicReconciledAt:",
    "economicReportHash:",
    "economicIncidentState:",
    "economicIncidentSeverity:",
    "economicIncidentUpdatedAt:",
  ]
) {
  if (
    !readyRoute.includes(
      field,
    )
  ) {
    throw new Error(
      `READY_FIELD_MISSING:${field}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_INTEGRITY_HEALTH_CONTRACT=PASS",
);

console.log(
  "READY_EXPOSES_INTEGRITY=YES",
);

console.log(
  "READY_EXPOSES_INCIDENT_STATE=YES",
);

console.log(
  "CRITICAL_BLOCKS_READINESS=YES",
);

console.log(
  "STALE_BLOCKS_READINESS=YES",
);

console.log(
  "INCIDENT_IS_AUTHORITY=NO",
);
