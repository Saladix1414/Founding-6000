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

const css =
  readFileSync(
    "src/App.css",
    "utf8",
  );

const requiredApi = [
  "TokenEconomy",
  "getTokenEconomy",
  "/api/economy/tokens/",
];

for (
  const value of
    requiredApi
) {
  if (
    !api.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMY_CLIENT_CONTRACT_MISSING:${value}`,
    );
  }
}

const requiredPanel = [
  "Original acquisition",
  "Reserve contribution",
  "Current NAV",
  "NAV evolution",
  "Proof of Reserve",
  "Tier reserve",
  "Issued supply",
  "snapshotHash",
  "vaultAddress",
];

for (
  const value of
    requiredPanel
) {
  if (
    !panel.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMY_PANEL_FIELD_MISSING:${value}`,
    );
  }
}

const forbiddenAuthority = [
  "privateKey",
  "RESERVE_SWEEP_SIGNER_PRIVATE_KEY",
  "senderAddress",
  "normalizedEmail",
];

for (
  const value of
    forbiddenAuthority
) {
  if (
    panel.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMY_PANEL_PRIVATE_FIELD:${value}`,
    );
  }
}

if (
  !panel.includes(
    "does not represent market price",
  )
) {
  throw new Error(
    "MARKET_PRICE_DISTINCTION_MISSING",
  );
}

if (
  !css.includes(
    ".nft-economy-panel"
  )
) {
  throw new Error(
    "ECONOMY_PANEL_CSS_MISSING",
  );
}

console.log(
  "OX_NFT_ECONOMY_PANEL_CONTRACT=PASS",
);

console.log(
  "ECONOMY_API_CLIENT=PASS",
);

console.log(
  "PROOF_OF_RESERVE_UI=PASS",
);

console.log(
  "NAV_UI=PASS",
);

console.log(
  "MARKET_PRICE_DISTINCTION=PASS",
);

console.log(
  "PRIVATE_AUTHORITY_EXPOSED=NO",
);
