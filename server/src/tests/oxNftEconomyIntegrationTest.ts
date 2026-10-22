import {
  readFileSync,
} from "node:fs";

const app =
  readFileSync(
    "src/App.tsx",
    "utf8",
  );

const panel =
  readFileSync(
    "src/components/NftEconomyPanel.tsx",
    "utf8",
  );

const api =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const requiredAppContracts = [
  'from "./components/NftEconomyPanel"',
  "<NftEconomyPanel",
  "verifiedPurchase",
  ".allocation",
  ".serialNumber",
  'name: "RARE"',
  'name: "EPIC"',
  'name: "GENESIS"',
  'range: "#0001–#1000"',
  'range: "#1001–#3000"',
  'range: "#3001–#6000"',
];

for (
  const contract of
    requiredAppContracts
) {
  if (
    !app.includes(
      contract,
    )
  ) {
    throw new Error(
      `NFT_ECONOMY_APP_CONTRACT_MISSING:${contract}`,
    );
  }
}

const forbiddenLegacyPhaseDefinitions = [
  'name: "Genesis"',
  'name: "Early Access"',
  'name: "Founding Access"',
];

for (
  const legacy of
    forbiddenLegacyPhaseDefinitions
) {
  if (
    app.includes(
      legacy,
    )
  ) {
    throw new Error(
      `LEGACY_COMMERCIAL_PHASE_REMAINS:${legacy}`,
    );
  }
}

if (
  !panel.includes(
    "does not represent market price",
  )
) {
  throw new Error(
    "NAV_MARKET_PRICE_BOUNDARY_MISSING",
  );
}

if (
  !api.includes(
    "/api/economy/tokens/"
  )
) {
  throw new Error(
    "ECONOMY_API_CLIENT_MISSING",
  );
}

if (
  app.includes(
    "RESERVE_SWEEP_SIGNER_PRIVATE_KEY"
  ) ||
  panel.includes(
    "RESERVE_SWEEP_SIGNER_PRIVATE_KEY"
  )
) {
  throw new Error(
    "PRIVATE_SIGNER_AUTHORITY_EXPOSED",
  );
}

console.log(
  "OX_NFT_ECONOMY_INTEGRATION=PASS",
);

console.log(
  "VERIFIED_SERIAL_TO_ECONOMY_PANEL=PASS",
);

console.log(
  "RARE_0001_1000=PASS",
);

console.log(
  "EPIC_1001_3000=PASS",
);

console.log(
  "GENESIS_3001_6000=PASS",
);

console.log(
  "LEGACY_COMMERCIAL_TIER_UI=REMOVED",
);

console.log(
  "PRIVATE_SIGNER_AUTHORITY_EXPOSED=NO",
);
