import {
  readFileSync,
} from "node:fs";

const app =
  readFileSync(
    "server/src/app.ts",
    "utf8",
  );

const route =
  readFileSync(
    "server/src/routes/economy.ts",
    "utf8",
  );

if (
  !app.includes(
    '"/api/economy"',
  )
) {
  throw new Error(
    "ECONOMY_ROUTE_NOT_MOUNTED",
  );
}

if (
  !route.includes(
    '"/tokens/:tokenId"',
  )
) {
  throw new Error(
    "TOKEN_ECONOMY_ROUTE_MISSING",
  );
}

if (
  !route.includes(
    ".min(1)",
  ) ||
  !route.includes(
    ".max(6000)",
  )
) {
  throw new Error(
    "TOKEN_ID_BOUNDARY_MISSING",
  );
}

if (
  !route.includes(
    "TOKEN_ECONOMY_NOT_FOUND",
  )
) {
  throw new Error(
    "TOKEN_ECONOMY_404_MISSING",
  );
}

console.log(
  "OX_ECONOMY_API_CONTRACT=PASS",
);

console.log(
  "ROUTE_MOUNT=PASS",
);

console.log(
  "TOKEN_ID_RANGE_1_6000=PASS",
);

console.log(
  "NOT_FOUND_BOUNDARY=PASS",
);
