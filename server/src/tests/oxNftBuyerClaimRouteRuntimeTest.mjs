import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let workerSource = readFileSync(
  "cloudflare/worker.mjs",
  "utf8",
);

/*
 * Isolate the production fetch handler while
 * retaining the actual runtime route logic.
 * Dynamic imports must not be reached when
 * claim flags/configuration are missing.
 */
const imports = [
  `import {
  FoundingCore,
} from "./foundingCore.mjs";

`,
  `import {
  verifyUsdtOnEthereum,
} from "./usdtRpcVerifier.mjs";

`,
  `export {
  FoundingCore,
};

`,
];

for (const value of imports) {
  assert.equal(
    workerSource.split(value).length - 1,
    1,
    "WORKER_IMPORT_STRUCTURE_CHANGED",
  );

  workerSource = workerSource.replace(value, "");
}

const { default: worker } = await import(
  "data:text/javascript;base64," +
  Buffer.from(workerSource).toString("base64")
);

let doCalls = 0;
let assetCalls = 0;

const env = {
  FOUNDING_CORE: {
    idFromName() {
      doCalls++;
      return "mock-id";
    },
    get() {
      doCalls++;
      throw new Error("DO_MUST_NOT_RUN");
    },
  },
  ASSETS: {
    async fetch() {
      assetCalls++;
      return new Response("ASSET");
    },
  },
};

const URL =
  "https://founding.test/api/nft/buyer/claim";

function request(method = "POST") {
  return new Request(URL, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://founding.test",
      "Sec-Fetch-Site": "same-origin",
    },
    ...(method === "POST" ? {
      body: JSON.stringify({
        orderPublicId: "F6K-ABCDEF123456",
        email: "buyer@example.org",
        challengeId:
          "11111111-2222-4333-8444-555555555555",
        code: "a".repeat(32),
      }),
    } : {}),
  });
}

for (const method of ["POST", "GET"]) {
  const response = await worker.fetch(
    request(method),
    env,
  );

  assert.equal(response.status, 503);

  assert.deepEqual(
    await response.json(),
    { error: "NFT_BUYER_CLAIM_DISABLED" },
  );

  assert.equal(
    response.headers.get("Cache-Control"),
    "no-store",
  );
}

assert.equal(doCalls, 0);
assert.equal(assetCalls, 0);

console.log("CLAIM_ROUTE_DISABLED_ALL_METHODS=PASS");
console.log("CLAIM_ROUTE_DISABLED_NO_DO_ACCESS=PASS");
console.log("CLAIM_ROUTE_DISABLED_NO_ASSET_FALLBACK=PASS");

/*
 * One enabled flag is never sufficient.
 */
for (const overrides of [
  { NFT_BUYER_CLAIM_ENABLED: "true" },
  { NFT_BUYER_CLAIM_HTTP_ENABLED: "true" },
]) {
  const response = await worker.fetch(
    request(),
    { ...env, ...overrides },
  );

  assert.equal(response.status, 503);
  assert.equal(
    (await response.json()).error,
    "NFT_BUYER_CLAIM_DISABLED",
  );
}

assert.equal(doCalls, 0);

console.log("CLAIM_ROUTE_DOUBLE_FLAG_REQUIRED=PASS");

/*
 * Even with both flags, missing credentials
 * and actor HMAC secret must fail closed.
 */
for (const overrides of [
  {},
  {
    NFT_BUYER_ACTOR_SECRET: "s".repeat(40),
  },
  {
    NFT_INTERNAL_SERVICE_KEY: "k".repeat(40),
  },
]) {
  const response = await worker.fetch(
    request(),
    {
      ...env,
      NFT_BUYER_CLAIM_ENABLED: "true",
      NFT_BUYER_CLAIM_HTTP_ENABLED: "true",
      ...overrides,
    },
  );

  assert.equal(response.status, 503);
  assert.equal(
    (await response.json()).error,
    "NFT_BUYER_CLAIM_UNAVAILABLE",
  );
}

assert.equal(doCalls, 0);

console.log("CLAIM_ROUTE_MISSING_SECRETS_BLOCKED=PASS");

/*
 * Ensure Wrangler configuration does not
 * enable the new claim feature or include
 * its secret material.
 */
const config = readFileSync(
  "wrangler.jsonc",
  "utf8",
);

for (const variable of [
  "NFT_BUYER_CLAIM_ENABLED",
  "NFT_BUYER_CLAIM_HTTP_ENABLED",
  "NFT_BUYER_ACTOR_SECRET",
  "NFT_INTERNAL_SERVICE_KEY",
]) {
  assert.equal(
    new RegExp(`"${variable}"\\s*:`).test(config),
    false,
    "CLAIM_RUNTIME_CONFIGURATION_MUST_STAY_OFF",
  );
}

console.log("CLAIM_ROUTE_WRANGLER_DEFAULT_OFF=PASS");

assert.ok(
  readFileSync("cloudflare/worker.mjs", "utf8")
    .includes("OX_NFT_BUYER_CLAIM_GATE_V1")
);

console.log("NFT_CLOUDFLARE_5I_7_PART_2_TEST=PASS");
console.log("NO_DEPLOYMENT");
console.log("NO_REAL_MINT");
