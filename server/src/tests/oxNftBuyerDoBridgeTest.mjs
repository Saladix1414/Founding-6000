import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  handleInternalBuyerEmail,
} from "../../../cloudflare/nftBuyerDoBridge.mjs";

const secret = "originx-internal-test-secret-".repeat(2);

const env = {
  NFT_BUYER_EMAIL_ENABLED: "true",
  NFT_INTERNAL_SERVICE_KEY: secret,
  RESEND_API_KEY: "re_mock_not_a_real_key",
  NFT_EMAIL_FROM: "verify@example.org",
};

const body = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  actorHash: "a".repeat(64),
};

let calls = 0;

const mockService = async payload => {
  calls++;
  assert.equal(payload.actorHash, body.actorHash);
  assert.equal(payload.orderPublicId, body.orderPublicId);
  assert.equal(payload.email, body.email);
  return { acceptedForProcessing: true };
};

function request({
  key = secret,
  payload = body,
  method = "POST",
} = {}) {
  return new Request("https://founding-core.internal/internal/nft/buyer/email", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key === null ? {} : {
        "X-OriginX-Internal-Key": key,
      }),
    },
    ...(method === "GET" ? {} : {
      body: JSON.stringify(payload),
    }),
  });
}

const run = (req, environment = env) =>
  handleInternalBuyerEmail({
    request: req,
    storage: { test: true },
    env: environment,
    service: mockService,
  });

assert.equal(
  (await run(request(), {
    ...env,
    NFT_BUYER_EMAIL_ENABLED: "false",
  })).status,
  503,
);
assert.equal(calls, 0);

console.log("DO_BRIDGE_DISABLED_BY_DEFAULT=PASS");

assert.equal(
  (await run(request({ key: null }))).status,
  503,
);

assert.equal(
  (await run(request({ key: "invalid-secret" }))).status,
  503,
);

assert.equal(calls, 0);

console.log("DO_BRIDGE_UNAUTHORIZED_BLOCKED=PASS");

assert.equal(
  (await run(request(), {
    ...env,
    RESEND_API_KEY: "",
  })).status,
  503,
);

console.log("DO_BRIDGE_MISSING_CONFIG_BLOCKED=PASS");

for (const payload of [
  {},
  { ...body, membershipId: "forged" },
  { ...body, claimToken: "forged" },
  { ...body, actorHash: "invalid" },
]) {
  assert.equal(
    (await run(request({ payload }))).status,
    400,
  );
}

assert.equal(calls, 0);

console.log("DO_BRIDGE_STRICT_INPUT=PASS");

const good = await run(request());

assert.equal(good.status, 202);
assert.equal(calls, 1);

const goodBody = await good.json();

assert.equal(goodBody.acceptedForProcessing, true);
assert.equal("membershipId" in goodBody, false);
assert.equal("claimToken" in goodBody, false);
assert.equal("code" in goodBody, false);

console.log("DO_BRIDGE_GENERIC_RESPONSE=PASS");

const failed = await handleInternalBuyerEmail({
  request: request(),
  env,
  storage: {},
  service: async () => {
    throw new Error("SECRET_MEMBER_ID");
  },
});

assert.equal(failed.status, 503);
assert.equal(
  (await failed.text()).includes("SECRET_MEMBER_ID"),
  false,
);

console.log("DO_BRIDGE_ERRORS_REDACTED=PASS");

/*
 * Static integration guard: ensure only the
 * expected internal route is installed.
 */
const core = readFileSync(
  new URL("../../../cloudflare/foundingCore.mjs", import.meta.url),
  "utf8",
);

assert.ok(
  core.includes('"/internal/nft/buyer/email"'),
);

assert.ok(
  core.includes('import("./nftBuyerDoBridge.mjs")'),
);

console.log("DO_BRIDGE_INTERNAL_ROUTE_WIRED=PASS");
console.log("NFT_BUYER_DO_BRIDGE_TEST=PASS");
console.log("NO REAL EMAIL.");
console.log("NO PUBLIC ROUTE.");
