import assert from "node:assert/strict";
import {
  forwardBuyerEmailToCore,
} from "../../../cloudflare/nftBuyerWorkerBridge.mjs";

const secret = "originx-internal-service-key-".repeat(2);
const actorHash = "a".repeat(64);

const input = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  actorHash,
};

let internalCalls = 0;
let lastRequest = null;

function environment({
  enabled = "true",
  key = secret,
  status = 202,
  shouldThrow = false,
} = {}) {
  return {
    NFT_BUYER_EMAIL_ENABLED: enabled,
    NFT_INTERNAL_SERVICE_KEY: key,

    FOUNDING_CORE: {
      idFromName(name) {
        assert.equal(
          name,
          "canonical-founding-6000",
        );

        return "mock-durable-object-id";
      },

      get(id) {
        assert.equal(id, "mock-durable-object-id");

        return {
          async fetch(request) {
            internalCalls++;
            lastRequest = request.clone();

            if (shouldThrow) {
              throw new Error(
                "PRIVATE_CLOUDFLARE_CONNECTION_ERROR",
              );
            }

            return Response.json({
              acceptedForProcessing: true,
              membershipId: "PRIVATE_MEMBERSHIP",
              claimToken: "PRIVATE_CLAIM_TOKEN",
            }, { status });
          },
        };
      },
    },
  };
}

async function forward(env, overrides = {}) {
  return forwardBuyerEmailToCore({
    env,
    ...input,
    ...overrides,
  });
}

/* Disabled means no Durable Object access. */
await assert.rejects(
  forward(environment({ enabled: "false" })),
  /NFT_BUYER_BRIDGE_UNAVAILABLE/,
);

assert.equal(internalCalls, 0);
console.log("WORKER_BRIDGE_DISABLED=PASS");

/* Missing credentials must fail closed. */
await assert.rejects(
  forward(environment({ key: "" })),
  /NFT_BUYER_BRIDGE_UNAVAILABLE/,
);

assert.equal(internalCalls, 0);
console.log("WORKER_BRIDGE_SECRET_REQUIRED=PASS");

/* Strict internal payload. */
await assert.rejects(
  forward(environment(), {
    actorHash: "client-forged",
  }),
  /NFT_BUYER_BRIDGE_INVALID_INPUT/,
);

await assert.rejects(
  forward(environment(), {
    orderPublicId: "NOT_AN_ORDER",
  }),
  /NFT_BUYER_BRIDGE_INVALID_INPUT/,
);

assert.equal(internalCalls, 0);
console.log("WORKER_BRIDGE_STRICT_INPUT=PASS");

/* Valid internal dispatch. */
const ack = await forward(environment());

assert.equal(internalCalls, 1);
assert.equal(ack.acceptedForProcessing, true);

assert.equal("membershipId" in ack, false);
assert.equal("claimToken" in ack, false);
assert.equal("actorHash" in ack, false);

assert.equal(
  lastRequest.method,
  "POST",
);

assert.equal(
  new URL(lastRequest.url).pathname,
  "/internal/nft/buyer/email",
);

assert.equal(
  lastRequest.headers.get("X-OriginX-Internal-Key"),
  secret,
);

assert.deepEqual(
  await lastRequest.json(),
  input,
);

console.log("WORKER_BRIDGE_INTERNAL_POST=PASS");
console.log("WORKER_BRIDGE_RESPONSE_REDACTED=PASS");

/* Core rejection cannot reach the browser. */
for (const status of [400, 403, 429, 500, 503]) {
  await assert.rejects(
    forward(environment({ status })),
    /NFT_BUYER_BRIDGE_UNAVAILABLE/,
  );
}

console.log("WORKER_BRIDGE_CORE_FAILURE_BLOCKED=PASS");

/* Network errors remain private. */
await assert.rejects(
  forward(environment({ shouldThrow: true })),
  error => {
    assert.equal(
      error.message,
      "NFT_BUYER_BRIDGE_UNAVAILABLE",
    );
    return true;
  },
);

console.log("WORKER_BRIDGE_NETWORK_ERROR_REDACTED=PASS");

/* No storage binding means no internal dispatch. */
await assert.rejects(
  forward({
    NFT_BUYER_EMAIL_ENABLED: "true",
    NFT_INTERNAL_SERVICE_KEY: secret,
  }),
  /NFT_BUYER_BRIDGE_UNAVAILABLE/,
);

console.log("WORKER_BRIDGE_BINDING_REQUIRED=PASS");

console.log("NFT_BUYER_WORKER_BRIDGE_TEST=PASS");
console.log("NO PUBLIC ENDPOINT.");
console.log("NO REAL EMAIL.");
console.log("NO REAL MINT.");
