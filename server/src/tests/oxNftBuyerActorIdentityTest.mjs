import assert from "node:assert/strict";
import {
  deriveBuyerActorHash,
  requestBuyerEmailFromWorker,
} from "../../../cloudflare/nftBuyerActorIdentity.mjs";

const secretA = "originx-test-key-A-".repeat(4);
const secretB = "originx-test-key-B-".repeat(4);

function makeRequest(ip, extra = {}) {
  return new Request(
    "https://example.org/api/nft/buyer/email",
    {
      method: "POST",
      headers: {
        ...(ip === null ? {} : {
          "CF-Connecting-IP": ip,
        }),
        "User-Agent": "OriginX-Test/1.0",
        ...extra,
      },
    },
  );
}

const original = makeRequest("203.0.113.40");

const hashA = await deriveBuyerActorHash({
  request: original,
  secret: secretA,
});

assert.match(hashA, /^[0-9a-f]{64}$/);
assert.equal(hashA.includes("203.0.113.40"), false);

console.log("ACTOR_HMAC_SHA256=PASS");

const repeat = await deriveBuyerActorHash({
  request: makeRequest("203.0.113.40"),
  secret: secretA,
});

assert.equal(repeat, hashA);
console.log("ACTOR_STABLE_IDENTITY=PASS");

const changedAgent = await deriveBuyerActorHash({
  request: makeRequest("203.0.113.40", {
    "User-Agent": "Attacker-Rotating-Agent",
  }),
  secret: secretA,
});

assert.equal(changedAgent, hashA);

console.log("USER_AGENT_ROTATION_NO_BYPASS=PASS");

const otherIp = await deriveBuyerActorHash({
  request: makeRequest("203.0.113.41"),
  secret: secretA,
});

assert.notEqual(otherIp, hashA);
console.log("DISTINCT_IP_DISTINCT_ACTOR=PASS");

const otherSecret = await deriveBuyerActorHash({
  request: original,
  secret: secretB,
});

assert.notEqual(otherSecret, hashA);
console.log("ACTOR_SECRET_ISOLATION=PASS");

const forged = await deriveBuyerActorHash({
  request: makeRequest("203.0.113.40", {
    "X-Forwarded-For": "198.51.100.100",
    "X-Real-IP": "198.51.100.101",
    "X-Actor-Hash": "b".repeat(64),
  }),
  secret: secretA,
});

assert.equal(forged, hashA);
console.log("SPOOFED_FORWARD_HEADERS_IGNORED=PASS");

for (const ip of [
  null,
  "unknown",
  "203.0.113.40|forged",
  "203.0.113.999",
  "203.0.113",
  "999.999.999.999",
  "203.0.113.40\nforged",
]) {
  if (ip !== null && ip.includes("\n")) {
    // Headers cannot contain newlines.
    continue;
  }

  await assert.rejects(
    deriveBuyerActorHash({
      request: makeRequest(ip),
      secret: secretA,
    }),
    /NFT_ACTOR_ORIGIN_UNAVAILABLE/,
  );
}

console.log("INVALID_OR_MISSING_ORIGIN_BLOCKED=PASS");

await assert.rejects(
  deriveBuyerActorHash({
    request: original,
    secret: "",
  }),
  /NFT_ACTOR_NOT_CONFIGURED/,
);

await assert.rejects(
  deriveBuyerActorHash({
    request: original,
    secret: "short",
  }),
  /NFT_ACTOR_NOT_CONFIGURED/,
);

console.log("MISSING_HMAC_SECRET_FAIL_CLOSED=PASS");

/*
 * Verify domain service integration without
 * creating an HTTP route or sending an email.
 */
let calls = 0;
let receivedActor = null;

const response = await requestBuyerEmailFromWorker({
  request: original,
  secret: secretA,
  storage: { test: true },
  orderPublicId: "F6K-ABCDEF333333",
  email: "buyer@example.org",
  now: 123456789,
  service: async ({
    actorHash,
    orderPublicId,
    email,
  }) => {
    calls++;

    receivedActor = actorHash;

    assert.equal(
      orderPublicId,
      "F6K-ABCDEF333333",
    );

    assert.equal(
      email,
      "buyer@example.org",
    );

    return {
      acceptedForProcessing: true,
    };
  },
});

assert.equal(calls, 1);
assert.equal(receivedActor, hashA);
assert.deepEqual(response, {
  acceptedForProcessing: true,
});

console.log("WORKER_DOMAIN_ACTOR_BINDING=PASS");

await assert.rejects(
  requestBuyerEmailFromWorker({
    request: makeRequest(null),
    secret: secretA,
    service: async () => {
      throw new Error("SERVICE_MUST_NOT_RUN");
    },
  }),
  /NFT_ACTOR_ORIGIN_UNAVAILABLE/,
);

assert.equal(calls, 1);

console.log("MISSING_ORIGIN_NO_SERVICE_EXECUTION=PASS");
console.log("NFT_BUYER_ACTOR_IDENTITY_TEST=PASS");
console.log("NO PUBLIC ROUTE.");
console.log("NO EMAIL SENT.");
