import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(
  "cloudflare/worker.mjs",
  "utf8",
);

const config = readFileSync(
  "wrangler.jsonc",
  "utf8",
);

const marker = "OX_NFT_BUYER_PUBLIC_GATE_V1";
const start = worker.indexOf(marker);

assert.ok(start > 0);

const route = worker.slice(
  start,
  worker.indexOf(
    'if (\n      request.method === "GET"',
    start,
  ) > start
    ? worker.indexOf(
        'if (\n      request.method === "GET"',
        start,
      )
    : start + 2500,
);

assert.ok(
  route.includes('"/api/nft/buyer/email"'),
);

console.log("BUYER_ROUTE_REGISTERED=PASS");

assert.ok(
  route.includes(
    'env.NFT_BUYER_EMAIL_ENABLED !== "true"'
  ),
);

assert.ok(
  route.includes(
    '"NFT_BUYER_SERVICE_DISABLED"'
  ),
);

console.log("BUYER_ROUTE_DEFAULT_DISABLED=PASS");

const gateIndex = route.indexOf(
  'env.NFT_BUYER_EMAIL_ENABLED !== "true"'
);

const importIndex = route.indexOf(
  'await import("./nftBuyerWorkerGateway.mjs")'
);

assert.ok(gateIndex >= 0);
assert.ok(importIndex > gateIndex);

console.log("DISABLED_BEFORE_DYNAMIC_IMPORT=PASS");

assert.ok(
  route.includes("NFT_BUYER_ACTOR_SECRET"),
);

assert.ok(
  route.includes("NFT_INTERNAL_SERVICE_KEY"),
);

assert.ok(
  route.includes("FOUNDING_CORE"),
);

console.log("BUYER_ROUTE_REQUIRED_CONFIG=PASS");

for (const forbidden of [
  '"NFT_BUYER_EMAIL_ENABLED": "true"',
  '"NFT_BUYER_ACTOR_SECRET":',
  '"NFT_INTERNAL_SERVICE_KEY":',
  '"RESEND_API_KEY":',
]) {
  assert.equal(
    config.includes(forbidden),
    false,
  );
}

console.log("WRANGLER_BUYER_SECRETS_ABSENT=PASS");

assert.equal(
  worker.includes("sendBuyerVerificationEmail("),
  false,
);

assert.equal(
  worker.includes("issueNftClaimGrant("),
  false,
);

console.log("PUBLIC_WORKER_NO_DIRECT_AUTHORITY=PASS");

console.log("NFT_BUYER_ROUTE_GATE_TEST=PASS");
console.log("ROUTE_RUNTIME_TEST=PENDING");
console.log("REAL_EMAIL_SENT=NO");
