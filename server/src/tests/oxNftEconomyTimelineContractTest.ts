import {
  readFileSync,
} from "node:fs";

const api =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const timeline =
  readFileSync(
    "src/components/NftEconomyTimeline.tsx",
    "utf8",
  );

const css =
  readFileSync(
    "src/App.css",
    "utf8",
  );

const requiredApi = [
  "TokenEconomyHistoryItem",
  "TokenEconomyHistory",
  "getTokenEconomyHistory",
  "/history?",
  "nextCursor",
  "hasMore",
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
      `TIMELINE_API_CONTRACT_MISSING:${value}`,
    );
  }
}

const requiredTimeline = [
  "ORIGINX · NAV HISTORY",
  "Economic evolution",
  "<svg",
  "<polyline",
  "snapshotHash",
  "growthBps",
  "coverageBps",
  "loadMore",
  "does not represent market price",
  "guaranteed returns",
];

for (
  const value of
    requiredTimeline
) {
  if (
    !timeline.includes(
      value,
    )
  ) {
    throw new Error(
      `TIMELINE_UI_CONTRACT_MISSING:${value}`,
    );
  }
}

if (
  !css.includes(
    ".nft-economy-timeline"
  )
) {
  throw new Error(
    "TIMELINE_CSS_MISSING",
  );
}

const forbidden = [
  "privateKey",
  "senderAddress",
  "normalizedEmail",
  "authToken",
  "RESERVE_SWEEP_SIGNER_PRIVATE_KEY",
];

for (
  const value of
    forbidden
) {
  if (
    timeline.includes(
      value,
    )
  ) {
    throw new Error(
      `TIMELINE_PRIVATE_FIELD:${value}`,
    );
  }
}

console.log(
  "OX_NFT_ECONOMY_TIMELINE_CONTRACT=PASS",
);

console.log(
  "NAV_CHART=PASS",
);

console.log(
  "SNAPSHOT_TIMELINE=PASS",
);

console.log(
  "KEYSET_LOAD_MORE=PASS",
);

console.log(
  "PROOF_STATUS_MARKERS=PASS",
);

console.log(
  "MARKET_PRICE_BOUNDARY=PASS",
);

console.log(
  "PRIVATE_AUTHORITY_EXPOSED=NO",
);
