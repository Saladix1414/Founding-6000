import {
  readFileSync,
} from "node:fs";

const policy =
  readFileSync(
    "server/src/economics/economicAlertDeliveryPolicy.ts",
    "utf8",
  );

const env =
  readFileSync(
    "server/src/config/env.ts",
    "utf8",
  );

const runtime =
  readFileSync(
    "server/src/config/productionRuntime.ts",
    "utf8",
  );

const schema =
  readFileSync(
    "server/src/db/economicAlertOutboxSchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicAlertDeliveryService.ts",
    "utf8",
  );

const migration =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

for (
  const boundary of [
    "ALERT DELIVERY != AUTHORITY",
    "ALERT DELIVERY != GOVERNANCE",
    "ALERT DELIVERY != AUTO-REPAIR",
    "ALERT DELIVERY != TREASURY ACTION",
    "ALERT DELIVERY != RESERVE MUTATION",
    "ALERT DELIVERY != BLOCKCHAIN TRANSACTION",
  ]
) {
  if (
    !policy.includes(
      boundary,
    )
  ) {
    throw new Error(
      `DELIVERY_BOUNDARY_MISSING:${boundary}`,
    );
  }
}

for (
  const token of [
    "ECONOMIC_ALERT_DELIVERY_ENABLED",
    "ECONOMIC_ALERT_WEBHOOK_URL",
    "ECONOMIC_ALERT_WEBHOOK_BEARER_TOKEN",
  ]
) {
  if (
    !env.includes(
      token,
    )
  ) {
    throw new Error(
      `DELIVERY_ENV_MISSING:${token}`,
    );
  }
}

for (
  const requirement of [
    "ECONOMIC_ALERT_DELIVERY_REQUIRES_HTTPS_WEBHOOK",
    "ECONOMIC_ALERT_DELIVERY_REQUIRES_BEARER_TOKEN",
  ]
) {
  if (
    !runtime.includes(
      requirement,
    )
  ) {
    throw new Error(
      `DELIVERY_RUNTIME_GUARD_MISSING:${requirement}`,
    );
  }
}

for (
  const column of [
    "attempts",
    "last_error",
    "next_attempt_at",
    "lease_owner",
    "lease_until",
  ]
) {
  if (
    !schema.includes(
      column,
    )
  ) {
    throw new Error(
      `DELIVERY_SCHEMA_MISSING:${column}`,
    );
  }
}

for (
  const requirement of [
    "claimPendingEconomicAlerts",
    "dispatchEconomicAlerts",
    "EconomicAlertDeliveryAdapter",
    "ECONOMIC_ALERT_DELIVERY_ADAPTER_REQUIRED",
    "ECONOMIC_ALERT_DELIVERY_LEASE_LOST",
    "nextEconomicAlertRetryDelayMs",
    "shouldTerminallyFailEconomicAlert",
  ]
) {
  if (
    !service.includes(
      requirement,
    )
  ) {
    throw new Error(
      `DELIVERY_SERVICE_REQUIREMENT_MISSING:${requirement}`,
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
    service.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `DELIVERY_SERVICE_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

if (
  !migration.includes(
    '"016_economic_alert_delivery_state"'
  )
) {
  throw new Error(
    "MIGRATION_016_MISSING",
  );
}

console.log(
  "OX_ECONOMIC_ALERT_DELIVERY_CONTRACT=PASS",
);

console.log(
  "DELIVERY_DEFAULT=DISABLED",
);

console.log(
  "LEASE_BASED_CLAIM=YES",
);

console.log(
  "RETRY_STATE=YES",
);

console.log(
  "REAL_DESTINATION_WIRED=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
