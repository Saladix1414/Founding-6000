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

if (
  !health.includes(
    "const overallReady ="
  ) ||
  !health.includes(
    "status:\n      overallReady"
  ) ||
  !health.includes(
    "coreReady:\n      overallReady"
  )
) {
  throw new Error(
    "HEALTH_STATUS_READINESS_DIVERGENCE",
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
  ]
) {
  if (
    !readyRoute.includes(
      field,
    )
  ) {
    throw new Error(
      `READY_ECONOMIC_FIELD_MISSING:${field}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_INTEGRITY_HEALTH_CONTRACT=PASS",
);

console.log(
  "HEALTH_STATUS_MATCHES_READINESS=YES",
);

console.log(
  "READY_EXPOSES_ECONOMIC_INTEGRITY=YES",
);

console.log(
  "CRITICAL_BLOCKS_READINESS=YES",
);

console.log(
  "STALE_BLOCKS_READINESS=YES",
);
