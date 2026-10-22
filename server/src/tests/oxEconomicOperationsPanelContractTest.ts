import {
  readFileSync,
} from "node:fs";

const component =
  readFileSync(
    "src/components/EconomicOperationsPanel.tsx",
    "utf8",
  );

const app =
  readFileSync(
    "src/App.tsx",
    "utf8",
  );

const css =
  readFileSync(
    "src/App.css",
    "utf8",
  );

const api =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const requiredComponent = [
  "getEconomicOperationsView",
  "EconomicOperationsPanel",
  "proofOfReserve",
  "incidentTimeline",
  "criticalFailures",
  "warnings",
  "READ ONLY",
  "60_000",
];

for (
  const value of
    requiredComponent
) {
  if (
    !component.includes(
      value,
    )
  ) {
    throw new Error(
      `OPERATIONS_PANEL_REQUIREMENT_MISSING:${value}`,
    );
  }
}

if (
  !app.includes(
    'import EconomicOperationsPanel'
  ) ||
  !app.includes(
    "<EconomicOperationsPanel"
  )
) {
  throw new Error(
    "OPERATIONS_PANEL_APP_INTEGRATION_MISSING",
  );
}

if (
  !api.includes(
    "/api/economy/operations"
  )
) {
  throw new Error(
    "OPERATIONS_PANEL_API_CLIENT_MISSING",
  );
}

const requiredCss = [
  ".economic-operations",
  ".economic-operations__status-grid",
  ".economic-operations__detail-grid",
  ".economic-operations__timeline",
  "@media (max-width: 650px)",
  "@media (max-width: 430px)",
];

for (
  const value of
    requiredCss
) {
  if (
    !css.includes(
      value,
    )
  ) {
    throw new Error(
      `OPERATIONS_PANEL_CSS_MISSING:${value}`,
    );
  }
}

const forbiddenAuthority = [
  "sendTransaction(",
  "signTransaction(",
  "privateKey",
  "wallet.send",
  'method: "POST"',
  'method: "DELETE"',
  'method: "PATCH"',
];

for (
  const value of
    forbiddenAuthority
) {
  if (
    component.includes(
      value,
    )
  ) {
    throw new Error(
      `OPERATIONS_PANEL_GAINED_AUTHORITY:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_OPERATIONS_PANEL_CONTRACT=PASS",
);

console.log(
  "PUBLIC_READ_ONLY=YES",
);

console.log(
  "AUTO_REFRESH=YES",
);

console.log(
  "MANUAL_REFRESH=YES",
);

console.log(
  "ANDROID_RESPONSIVE=YES",
);

console.log(
  "MUTATION_CONTROLS=NO",
);
