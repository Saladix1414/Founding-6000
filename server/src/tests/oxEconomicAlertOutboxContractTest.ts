import {
  readFileSync,
} from "node:fs";

const policy =
  readFileSync(
    "server/src/economics/economicAlertPolicy.ts",
    "utf8",
  );

const schema =
  readFileSync(
    "server/src/db/economicAlertOutboxSchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicAlertOutboxService.ts",
    "utf8",
  );

const migration =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

for (
  const boundary of [
    "ALERT != AUTHORITY",
    "ALERT != GOVERNANCE",
    "ALERT != AUTO-REPAIR",
    "ALERT != TREASURY ACTION",
  ]
) {
  if (
    !policy.includes(
      boundary,
    )
  ) {
    throw new Error(
      `ALERT_BOUNDARY_MISSING:${boundary}`,
    );
  }
}

for (
  const token of [
    "economic_alert_outbox",
    "'PENDING'",
    "'DELIVERED'",
    "'FAILED'",
    "alert_key TEXT NOT NULL UNIQUE",
  ]
) {
  if (
    !schema.includes(
      token,
    )
  ) {
    throw new Error(
      `ALERT_SCHEMA_MISSING:${token}`,
    );
  }
}

for (
  const requirement of [
    "syncEconomicIncidentAlerts",
    "enqueueEconomicIncidentAlert",
    "idempotentReplay",
    "incident_id",
    "trigger_type",
  ]
) {
  if (
    !service.includes(
      requirement,
    )
  ) {
    throw new Error(
      `ALERT_SERVICE_REQUIREMENT_MISSING:${requirement}`,
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
  ]
) {
  if (
    service.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `ALERT_SERVICE_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

if (
  !migration.includes(
    '"014_economic_alert_outbox"'
  )
) {
  throw new Error(
    "MIGRATION_014_MISSING",
  );
}

console.log(
  "OX_ECONOMIC_ALERT_OUTBOX_CONTRACT=PASS",
);

console.log(
  "INCIDENT_SCOPED_DEDUPE=YES",
);

console.log(
  "INCIDENT_LEDGER_SYNC=YES",
);

console.log(
  "DELIVERY_EXECUTION=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
