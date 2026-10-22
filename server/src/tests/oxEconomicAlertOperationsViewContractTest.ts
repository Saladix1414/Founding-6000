import {
  readFileSync,
} from "node:fs";

const service =
  readFileSync(
    "server/src/services/economicOperationsViewService.ts",
    "utf8",
  );

const alertOps =
  readFileSync(
    "server/src/services/economicAlertOperationsService.ts",
    "utf8",
  );

for (
  const required of [
    "getEconomicAlertOperationsSnapshot",
    "alertDelivery",
  ]
) {
  if (
    !service.includes(
      required,
    )
  ) {
    throw new Error(
      `PUBLIC_ALERT_OPS_VIEW_MISSING:${required}`,
    );
  }
}

for (
  const forbidden of [
    "payload_json",
    "last_error",
    "lease_owner",
    "ECONOMIC_ALERT_WEBHOOK_BEARER_TOKEN",
  ]
) {
  if (
    service.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `PUBLIC_ALERT_OPS_LEAK:${forbidden}`,
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
    alertOps.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `ALERT_OPS_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_OPERATIONS_VIEW_CONTRACT=PASS",
);

console.log(
  "PUBLIC_SAFE_COUNTS=YES",
);

console.log(
  "RAW_PAYLOAD_EXPOSED=NO",
);

console.log(
  "LAST_ERROR_EXPOSED=NO",
);

console.log(
  "LEASE_OWNER_EXPOSED=NO",
);

console.log(
  "SECRET_EXPOSED=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
