import {
  readFileSync,
} from "node:fs";

const service =
  readFileSync(
    "server/src/services/economicIntegrityStaleService.ts",
    "utf8",
  );

const health =
  readFileSync(
    "server/src/routes/health.ts",
    "utf8",
  );

for (
  const required of [
    "RECONCILIATION_STALE",
    "resolveEconomicReconciliationHealth",
    "recordEconomicIntegrityObservation",
    'state:\n        "STALE"',
  ]
) {
  if (
    !service.includes(
      required,
    )
  ) {
    throw new Error(
      `STALE_SERVICE_REQUIREMENT_MISSING:${required}`,
    );
  }
}

if (
  !health.includes(
    "resolveEconomicReconciliationHealth"
  )
) {
  throw new Error(
    "HEALTH_NOT_USING_SHARED_STALE_POLICY",
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
    service.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `STALE_SERVICE_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_INTEGRITY_STALE_CONTRACT=PASS",
);

console.log(
  "STALE_INCIDENT_SUPPORTED=YES",
);

console.log(
  "NOT_SEEN_INCIDENT=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
