import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  forwardBuyerClaimToCore,
} from "../../../cloudflare/nftBuyerClaimWorkerBridge.mjs";

const secret = "originx-internal-test-".repeat(3);
const now = Date.parse("2026-10-25T12:00:00Z");

const token = "0x" + "a".repeat(64);
const expires = new Date(now + 15 * 60 * 1000)
  .toISOString();

const input = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  challengeId: "11111111-2222-4333-8444-555555555555",
  code: "b".repeat(32),
  actorHash: "c".repeat(64),
};

let calls = 0;
let lastRequest;

function environment({
  enabled = "true",
  key = secret,
  status = 200,
  response = {
    claimToken: token,
    claimExpiresAt: expires,
  },
  networkFailure = false,
} = {}) {
  return {
    NFT_BUYER_CLAIM_ENABLED: enabled,
    NFT_INTERNAL_SERVICE_KEY: key,
    FOUNDING_CORE: {
      idFromName(name) {
        assert.equal(
          name,
          "canonical-founding-6000",
        );
        return "mock-do-id";
      },
      get(id) {
        assert.equal(id, "mock-do-id");

        return {
          async fetch(request) {
            calls++;
            lastRequest = request.clone();

            if (networkFailure) {
              throw new Error(
                "SECRET_INTERNAL_NETWORK_DETAILS"
              );
            }

            return Response.json(response, { status });
          },
        };
      },
    },
  };
}

function forward(env, overrides = {}) {
  return forwardBuyerClaimToCore({
    env,
    ...input,
    now,
    ...overrides,
  });
}

for (const env of [
  environment({ enabled: "false" }),
  environment({ key: "" }),
  {
    NFT_BUYER_CLAIM_ENABLED: "true",
    NFT_INTERNAL_SERVICE_KEY: secret,
  },
]) {
  await assert.rejects(
    forward(env),
    /NFT_BUYER_CLAIM_BRIDGE_UNAVAILABLE/,
  );
}

assert.equal(calls, 0);

console.log("CLAIM_BRIDGE_FAIL_CLOSED=PASS");

for (const override of [
  { orderPublicId: "INVALID" },
  { email: "not-an-email" },
  { challengeId: "forged" },
  { code: "not-a-code" },
  { actorHash: "browser-supplied" },
]) {
  await assert.rejects(
    forward(environment(), override),
    /NFT_BUYER_CLAIM_BRIDGE_INVALID/,
  );
}

assert.equal(calls, 0);

console.log("CLAIM_BRIDGE_STRICT_INPUT=PASS");

const result = await forward(environment());

assert.deepEqual(result, {
  claimToken: token,
  claimExpiresAt: expires,
});

assert.equal(calls, 1);
assert.equal(lastRequest.method, "POST");
assert.equal(
  new URL(lastRequest.url).pathname,
  "/internal/nft/buyer/claim",
);
assert.equal(
  lastRequest.headers.get("X-OriginX-Internal-Key"),
  secret,
);

assert.deepEqual(await lastRequest.json(), input);

console.log("CLAIM_BRIDGE_AUTHENTICATED_DO_POST=PASS");
console.log("CLAIM_BRIDGE_CREDENTIAL_VALIDATED=PASS");

for (const status of [400, 403, 429, 500, 503]) {
  await assert.rejects(
    forward(environment({ status })),
    /NFT_BUYER_CLAIM_BRIDGE_UNAVAILABLE/,
  );
}

console.log("CLAIM_BRIDGE_DO_ERRORS_REDACTED=PASS");

for (const response of [
  {},
  { claimToken: "invalid", claimExpiresAt: expires },
  { claimToken: token },
  { claimToken: token, claimExpiresAt: "bad-date" },
  {
    claimToken: token,
    claimExpiresAt: new Date(now - 1000).toISOString(),
  },
  {
    claimToken: token,
    claimExpiresAt:
      new Date(now + 60 * 60 * 1000).toISOString(),
  },
  {
    claimToken: token,
    claimExpiresAt: expires,
    membershipId: "SECRET_INTERNAL_MEMBER",
  },
]) {
  await assert.rejects(
    forward(environment({ response })),
    /NFT_BUYER_CLAIM_BRIDGE_UNAVAILABLE/,
  );
}

console.log("CLAIM_BRIDGE_INVALID_RESPONSE_BLOCKED=PASS");

await assert.rejects(
  forward(environment({
    networkFailure: true,
  })),
  error => {
    assert.equal(
      error.message,
      "NFT_BUYER_CLAIM_BRIDGE_UNAVAILABLE",
    );
    return true;
  },
);

console.log("CLAIM_BRIDGE_NETWORK_ERRORS_REDACTED=PASS");

const worker = readFileSync(
  new URL("../../../cloudflare/worker.mjs", import.meta.url),
  "utf8",
);

/*
 * PHASE 5I.7:
 * Public URL registered, disabled by default.
 * Both feature flags must precede dynamic import.
 */
const claimGateStart = worker.indexOf(
  "OX_NFT_BUYER_CLAIM_GATE_V1",
);

const claimGateEnd = worker.indexOf(
  "OX_NFT_BUYER_PUBLIC_GATE_V1",
  claimGateStart,
);

assert.ok(claimGateStart >= 0);
assert.ok(claimGateEnd > claimGateStart);

const claimGate = worker.slice(
  claimGateStart,
  claimGateEnd,
);

assert.ok(
  claimGate.includes('"/api/nft/buyer/claim"'),
);

const enabledGate = claimGate.indexOf(
  'env?.NFT_BUYER_CLAIM_ENABLED !== "true"',
);

const httpGate = claimGate.indexOf(
  'env?.NFT_BUYER_CLAIM_HTTP_ENABLED !== "true"',
);

const gatewayImport = claimGate.indexOf(
  'import("./nftBuyerClaimHttpGateway.mjs")',
);

assert.ok(enabledGate >= 0);
assert.ok(httpGate >= 0);
assert.ok(gatewayImport > enabledGate);
assert.ok(gatewayImport > httpGate);

console.log("CLAIM_PUBLIC_ROUTE_DOUBLE_GATE=PASS");

const core = readFileSync(
  new URL("../../../cloudflare/foundingCore.mjs", import.meta.url),
  "utf8",
);

assert.ok(
  core.includes('"/internal/nft/buyer/claim"'),
);

console.log("CLAIM_BRIDGE_PUBLIC_ROUTE=DISABLED_BY_DEFAULT");
console.log("NFT_BUYER_CLAIM_WORKER_BRIDGE_TEST=PASS");
console.log("REAL_MINT=NO");
