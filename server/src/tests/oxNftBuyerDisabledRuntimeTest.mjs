import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let source = readFileSync(
  "cloudflare/worker.mjs",
  "utf8",
);

const coreImport = `import {
  FoundingCore,
} from "./foundingCore.mjs";

`;

const coreExport = `export {
  FoundingCore,
};

`;

const verifierImport = `import {
  verifyUsdtOnEthereum,
} from "./usdtRpcVerifier.mjs";

`;

for (const anchor of [
  coreImport,
  coreExport,
  verifierImport,
]) {
  assert.equal(
    source.split(anchor).length - 1,
    1,
    "WORKER_IMPORT_ANCHOR_CHANGED",
  );
}

source = source
  .replace(coreImport, "")
  .replace(coreExport, "")
  .replace(verifierImport, "");

const encoded = Buffer.from(source).toString("base64");

const { default: worker } = await import(
  `data:text/javascript;base64,${encoded}`
);

let durableCalls = 0;
let assetCalls = 0;

const env = {
  FOUNDING_CORE: {
    idFromName() {
      durableCalls++;
      return "mock";
    },
    get() {
      durableCalls++;
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

const path =
  "https://founding.test/api/nft/buyer/email";

const payload = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
};

const makeRequest = (method = "POST") =>
  new Request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.40",
    },
    ...(method === "POST"
      ? { body: JSON.stringify(payload) }
      : {}),
  });

const disabled = await worker.fetch(
  makeRequest(),
  env,
);

assert.equal(disabled.status, 503);

const disabledBody = await disabled.json();

assert.equal(
  disabledBody.error,
  "NFT_BUYER_SERVICE_DISABLED",
);

assert.equal(
  disabled.headers.get("Cache-Control"),
  "no-store",
);

assert.equal(durableCalls, 0);
assert.equal(assetCalls, 0);

console.log("RUNTIME_DISABLED_RETURNS_503=PASS");
console.log("RUNTIME_DISABLED_NO_DURABLE_OBJECT=PASS");
console.log("RUNTIME_DISABLED_NO_ASSET_FALLBACK=PASS");

/*
 * A disabled feature remains closed regardless
 * of HTTP method.
 */
const disabledGet = await worker.fetch(
  makeRequest("GET"),
  env,
);

assert.equal(disabledGet.status, 503);
assert.equal(durableCalls, 0);

console.log("RUNTIME_DISABLED_ALL_METHODS=PASS");

/*
 * Even with the feature flag enabled,
 * missing required configuration must
 * prevent internal dispatch.
 */
const missingConfig = await worker.fetch(
  makeRequest(),
  {
    ...env,
    NFT_BUYER_EMAIL_ENABLED: "true",
  },
);

assert.equal(missingConfig.status, 503);
assert.equal(durableCalls, 0);

console.log("RUNTIME_MISSING_CONFIG_FAIL_CLOSED=PASS");

/*
 * No service or credential is available to the
 * actual runtime test. No email/mint can happen.
 */
const serialized = JSON.stringify(disabledBody);

for (const forbidden of [
  "membershipId",
  "claimToken",
  "RESEND_API_KEY",
  "NFT_INTERNAL_SERVICE_KEY",
]) {
  assert.equal(serialized.includes(forbidden), false);
}

console.log("RUNTIME_NO_SECRET_EXPOSURE=PASS");
console.log("NFT_BUYER_DISABLED_RUNTIME_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
console.log("BLOCKCHAIN_MINT=NO");
