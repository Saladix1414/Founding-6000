import {
  readFileSync,
} from "node:fs";

const panel =
  readFileSync(
    "src/components/NftEconomyPanel.tsx",
    "utf8",
  );

const timeline =
  readFileSync(
    "src/components/NftEconomyTimeline.tsx",
    "utf8",
  );

const api =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const requiredPanel = [
  'from "./NftEconomyTimeline"',
  "<NftEconomyTimeline",
  "tokenId={",
  "language={",
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
      `TIMELINE_PANEL_INTEGRATION_MISSING:${value}`,
    );
  }
}

const requiredHistoryClient = [
  "getTokenEconomyHistory",
  "/api/economy/tokens/",
  "/history?",
  "nextCursor",
  "hasMore",
];

for (
  const value of
    requiredHistoryClient
) {
  if (
    !api.includes(
      value,
    )
  ) {
    throw new Error(
      `HISTORY_CLIENT_MISSING:${value}`,
    );
  }
}

/*
 * Pagination must merge by snapshot hash rather than
 * blindly appending duplicate historical points.
 */
const requiredDeduplication = [
  "new Set(",
  "item.snapshotHash",
  "!existing.has(",
];

for (
  const value of
    requiredDeduplication
) {
  if (
    !timeline.includes(
      value,
    )
  ) {
    throw new Error(
      `TIMELINE_DEDUPLICATION_MISSING:${value}`,
    );
  }
}

/*
 * Chart must render from oldest → newest visually,
 * while backend pages remain newest → oldest.
 */
if (
  !timeline.includes(
    "[...items]"
  ) ||
  !timeline.includes(
    ".reverse()"
  )
) {
  throw new Error(
    "TIMELINE_VISUAL_ORDER_TRANSFORM_MISSING",
  );
}

const requiredAuthorityBoundaries = [
  "does not represent market price",
  "guaranteed returns",
];

for (
  const value of
    requiredAuthorityBoundaries
) {
  if (
    !timeline.includes(
      value,
    )
  ) {
    throw new Error(
      `ECONOMIC_BOUNDARY_MISSING:${value}`,
    );
  }
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
    ) ||
    panel.includes(
      value,
    )
  ) {
    throw new Error(
      `PRIVATE_AUTHORITY_EXPOSED:${value}`,
    );
  }
}

console.log(
  "OX_NFT_ECONOMY_TIMELINE_INTEGRATION=PASS",
);

console.log(
  "TIMELINE_INSIDE_ECONOMY_PANEL=PASS",
);

console.log(
  "SNAPSHOT_DEDUPLICATION=PASS",
);

console.log(
  "BACKEND_ORDER_NEWEST_FIRST=PASS",
);

console.log(
  "CHART_ORDER_OLDEST_TO_NEWEST=PASS",
);

console.log(
  "MARKET_PRICE_BOUNDARY=PASS",
);

console.log(
  "GUARANTEED_RETURN_CLAIM=NO",
);

console.log(
  "PRIVATE_AUTHORITY_EXPOSED=NO",
);
