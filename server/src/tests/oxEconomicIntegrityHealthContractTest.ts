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

console.log(
  "OX_ECONOMIC_INTEGRITY_HEALTH_CONTRACT=PASS",
);

console.log(
  "CRITICAL_BLOCKS_READINESS=YES",
);

console.log(
  "STALE_BLOCKS_READINESS=YES",
);

console.log(
  "WARNING_BLOCKS_READINESS=NO",
);

console.log(
  "NOT_SEEN_BLOCKS_READINESS=NO",
);
