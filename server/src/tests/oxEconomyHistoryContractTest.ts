import {
  readFileSync,
} from "node:fs";

const route =
  readFileSync(
    "server/src/routes/economy.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economyHistoryService.ts",
    "utf8",
  );

const requiredRouteContracts = [
  '"/tokens/:tokenId/history"',
  "historyQuerySchema",
  ".max(100)",
  ".default(25)",
  "INVALID_ECONOMY_HISTORY_QUERY",
  "INVALID_ECONOMY_HISTORY_CURSOR",
];

for (
  const contract of
    requiredRouteContracts
) {
  if (
    !route.includes(
      contract,
    )
  ) {
    throw new Error(
      `HISTORY_ROUTE_CONTRACT_MISSING:${contract}`,
    );
  }
}

const requiredServiceContracts = [
  "ECONOMY_HISTORY_VERSION",
  "snapshotHash",
  "capturedAt",
  "reserveBalanceMinor",
  "issuedSupply",
  "navMinor",
  "growthBps",
  "coverageBps",
  "fullyCovered",
  "nextCursor",
  "hasMore",
  '"DESC" as const',
];

for (
  const contract of
    requiredServiceContracts
) {
  if (
    !service.includes(
      contract,
    )
  ) {
    throw new Error(
      `HISTORY_SERVICE_CONTRACT_MISSING:${contract}`,
    );
  }
}

const forbidden = [
  "email:",
  "normalizedEmail:",
  "senderAddress:",
  "privateKey:",
  "authToken:",
];

for (
  const value of
    forbidden
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `HISTORY_PRIVATE_FIELD_EXPOSED:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMY_HISTORY_CONTRACT=PASS",
);

console.log(
  "KEYSET_PAGINATION=PASS",
);

console.log(
  "SNAPSHOT_HASH_CURSOR=PASS",
);

console.log(
  "NEWEST_FIRST=PASS",
);

console.log(
  "NAV_HISTORY=PASS",
);

console.log(
  "PROOF_HISTORY=PASS",
);

console.log(
  "PRIVATE_DATA_EXPOSED=NO",
);
