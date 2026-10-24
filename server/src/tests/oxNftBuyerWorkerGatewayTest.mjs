import assert from "node:assert/strict";

import {
  handleNftBuyerGateway,
} from "../../../cloudflare/nftBuyerWorkerGateway.mjs";

const path = "https://originx.example/api/nft/buyer/email";
const actorSecret = "originx-test-actor-secret-".repeat(3);
const internalKey = "originx-test-internal-key-".repeat(3);

const body = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
};

let calls = 0;
let lastPayload = null;

const env = {
  NFT_BUYER_EMAIL_ENABLED: "true",
  NFT_BUYER_ACTOR_SECRET: actorSecret,
  NFT_INTERNAL_SERVICE_KEY: internalKey,
  FOUNDING_CORE: {
    idFromName: () => "mock-id",
    get: () => ({ fetch: async () => Response.json({}) }),
  },
};

const forward = async payload => {
  calls++;
  lastPayload = payload;

  return { acceptedForProcessing: true };
};

function req({
  payload = body,
  ip = "203.0.113.40",
  method = "POST",
  media = "application/json",
  url = path,
} = {}) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": media,
      ...(ip === null ? {} : {
        "CF-Connecting-IP": ip,
      }),
    },
    ...(method === "GET" || method === "HEAD"
      ? {}
      : {
          body: typeof payload === "string"
            ? payload : JSON.stringify(payload),
        }),
  });
}

const run = (request, overrides = {}) =>
  handleNftBuyerGateway({
    request,
    env,
    forward,
    ...overrides,
  });

const disabled = await run(req(), {
  env: { ...env, NFT_BUYER_EMAIL_ENABLED: "false" },
});

assert.equal(disabled.status, 503);
assert.equal(calls, 0);

console.log("GATEWAY_DISABLED_FAIL_CLOSED=PASS");

for (const badEnv of [
  { ...env, NFT_BUYER_ACTOR_SECRET: "" },
  { ...env, NFT_INTERNAL_SERVICE_KEY: "" },
  { ...env, FOUNDING_CORE: null },
]) {
  assert.equal(
    (await run(req(), { env: badEnv })).status,
    503,
  );
}

assert.equal(calls, 0);

console.log("GATEWAY_REQUIRED_CONFIG=PASS");

assert.equal(
  (await run(req({ method: "GET" }))).status,
  405,
);

assert.equal(
  (await run(req({ media: "text/plain" }))).status,
  415,
);

console.log("GATEWAY_POST_JSON_ONLY=PASS");

for (const payload of [
  {},
  [],
  { ...body, membershipId: "forged" },
  { ...body, claimToken: "forged" },
  { ...body, actorHash: "a".repeat(64) },
]) {
  assert.equal(
    (await run(req({ payload }))).status,
    400,
  );
}

assert.equal(calls, 0);

console.log("GATEWAY_STRICT_PUBLIC_FIELDS=PASS");

assert.equal(
  (await run(req({ payload: "x".repeat(3000) }))).status,
  413,
);

assert.equal(
  (await run(req({ ip: null }))).status,
  503,
);

assert.equal(calls, 0);

console.log("GATEWAY_BODY_AND_ORIGIN_LIMITS=PASS");

const valid = await run(req());

assert.equal(valid.status, 202);
assert.equal(calls, 1);

assert.equal(
  lastPayload.orderPublicId,
  body.orderPublicId,
);

assert.equal(
  lastPayload.email,
  body.email,
);

assert.match(
  lastPayload.actorHash,
  /^[a-f0-9]{64}$/,
);

assert.equal(
  lastPayload.env.NFT_INTERNAL_SERVICE_KEY,
  internalKey,
);

assert.equal(
  "apiKey" in lastPayload,
  false,
);

assert.equal(
  "membershipId" in lastPayload,
  false,
);

console.log("GATEWAY_HMAC_TO_BRIDGE=PASS");
console.log("GATEWAY_NO_RESEND_SECRET=PASS");

const publicBody = await valid.json();

for (const key of [
  "membershipId",
  "mintJobId",
  "claimToken",
  "code",
  "actorHash",
]) {
  assert.equal(key in publicBody, false);
}

assert.equal(
  valid.headers.get("Cache-Control"),
  "no-store",
);

console.log("GATEWAY_RESPONSE_REDACTED=PASS");

const unavailable = await run(req(), {
  forward: async () => {
    throw new Error("PRIVATE_CLOUDFLARE_ERROR");
  },
});

assert.equal(unavailable.status, 503);

assert.equal(
  (await unavailable.text()).includes(
    "PRIVATE_CLOUDFLARE_ERROR"
  ),
  false,
);

console.log("GATEWAY_BRIDGE_ERRORS_REDACTED=PASS");

assert.equal(calls, 1);

console.log("NFT_BUYER_WORKER_GATEWAY_TEST=PASS");
console.log("PUBLIC_ROUTE_INSTALLED=NO");
console.log("REAL_EMAIL_SENT=NO");
