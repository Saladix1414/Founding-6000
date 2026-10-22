import {
  readFileSync,
} from "node:fs";

const adapter =
  readFileSync(
    "server/src/services/economicAlertWebhookAdapter.ts",
    "utf8",
  );

for (
  const required of [
    "createEconomicAlertWebhookAdapter",
    "ECONOMIC_ALERT_WEBHOOK_URL",
    "ECONOMIC_ALERT_WEBHOOK_BEARER_TOKEN",
    '"https:"',
    'method:\n                "POST"',
    '"Authorization"',
    "X-OriginX-Alert-Policy",
    "X-OriginX-Alert-Key",
    "AbortController",
  ]
) {
  if (
    !adapter.includes(
      required,
    )
  ) {
    throw new Error(
      `WEBHOOK_ADAPTER_REQUIREMENT_MISSING:${required}`,
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
    adapter.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `WEBHOOK_ADAPTER_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_WEBHOOK_CONTRACT=PASS",
);

console.log(
  "HTTPS_REQUIRED=YES",
);

console.log(
  "BEARER_AUTH=YES",
);

console.log(
  "TIMEOUT=YES",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
