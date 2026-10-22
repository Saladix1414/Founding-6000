import {
  readFileSync,
} from "node:fs";

const policy =
  readFileSync(
    "server/src/economics/economicIntegrityIncidentPolicy.ts",
    "utf8",
  );

const schema =
  readFileSync(
    "server/src/db/economicIntegrityIncidentSchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicIntegrityIncidentService.ts",
    "utf8",
  );

const migration =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

const requiredPolicy = [
  "ALERT != AUTHORITY",
  "INCIDENT != GOVERNANCE",
  "INCIDENT != AUTO-REPAIR",
  "buildEconomicIncidentFingerprint",
  "decideEconomicIncidentAction",
];

for (
  const value of
    requiredPolicy
) {
  if (
    !policy.includes(
      value,
    )
  ) {
    throw new Error(
      `INCIDENT_POLICY_BOUNDARY_MISSING:${value}`,
    );
  }
}

const requiredSchema = [
  "economic_integrity_incident_events",
  "'OPENED'",
  "'OBSERVED'",
  "'RESOLVED'",
  "trg_economic_integrity_incident_events_no_update",
  "trg_economic_integrity_incident_events_no_delete",
];

for (
  const value of
    requiredSchema
) {
  if (
    !schema.includes(
      value,
    )
  ) {
    throw new Error(
      `INCIDENT_SCHEMA_CONTRACT_MISSING:${value}`,
    );
  }
}

const forbiddenAuthority = [
  ".sendTransaction(",
  "signTransaction",
  "wallet.send",
  "UPDATE reserve_",
  "DELETE FROM reserve_",
];

for (
  const value of
    forbiddenAuthority
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `INCIDENT_SERVICE_GAINED_AUTHORITY:${value}`,
    );
  }
}

if (
  !migration.includes(
    '"013_economic_integrity_incidents"'
  )
) {
  throw new Error(
    "MIGRATION_013_MISSING",
  );
}

console.log(
  "OX_ECONOMIC_INTEGRITY_INCIDENT_CONTRACT=PASS",
);

console.log(
  "APPEND_ONLY_EVENTS=PASS",
);

console.log(
  "MIGRATION_013=PASS",
);

console.log(
  "RESERVE_AUTHORITY=NO",
);

console.log(
  "BLOCKCHAIN_AUTHORITY=NO",
);

console.log(
  "AUTO_REPAIR=NO",
);
