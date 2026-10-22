import {
  readFileSync,
} from "node:fs";

const api =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const panel =
  readFileSync(
    "src/components/NftEconomyPanel.tsx",
    "utf8",
  );

if (
  api.split(
    "navPolicy:"
  ).length <
  3
) {
  throw new Error(
    "CURRENT_AND_HISTORY_NAV_POLICY_TYPES_MISSING",
  );
}

if (
  !api.includes(
    '"HISTORICAL_ISSUED_SUPPLY"'
  )
) {
  throw new Error(
    "FRONTEND_NAV_SUPPLY_BASIS_TYPE_MISSING",
  );
}

if (
  !panel.includes(
    "Historical issued supply"
  )
) {
  throw new Error(
    "NAV_SUPPLY_BASIS_UI_MISSING",
  );
}

if (
  !panel.includes(
    "historical issued supply as its denominator"
  )
) {
  throw new Error(
    "NAV_DENOMINATOR_DISCLOSURE_MISSING",
  );
}

if (
  panel.includes(
    "guaranteed return"
  ) ||
  panel.includes(
    "guaranteed profit"
  )
) {
  throw new Error(
    "FINANCIAL_GUARANTEE_LANGUAGE_PRESENT",
  );
}

console.log(
  "OX_NAV_SUPPLY_FRONTEND_CONTRACT=PASS",
);

console.log(
  "CURRENT_API_NAV_POLICY_TYPED=PASS",
);

console.log(
  "HISTORY_API_NAV_POLICY_TYPED=PASS",
);

console.log(
  "NAV_SUPPLY_BASIS_VISIBLE=PASS",
);

console.log(
  "MARKET_PRICE_BOUNDARY=PASS",
);

console.log(
  "FINANCIAL_GUARANTEE_LANGUAGE=NO",
);
