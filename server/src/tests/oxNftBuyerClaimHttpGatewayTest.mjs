import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  handleBuyerClaimHttp,
} from "../../../cloudflare/nftBuyerClaimHttpGateway.mjs";

const secret = "test-secret-originx-".repeat(3);
const actor = "a".repeat(64);
const token = "0x" + "b".repeat(64);

const body = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  challengeId: "11111111-2222-4333-8444-555555555555",
  code: "c".repeat(32),
};

let derived = 0;
let forwarded = 0;

const baseEnv = {
  NFT_BUYER_CLAIM_HTTP_ENABLED: "true",
  NFT_BUYER_CLAIM_ENABLED: "true",
  NFT_BUYER_ACTOR_SECRET: secret,
  NFT_INTERNAL_SERVICE_KEY: secret,
  FOUNDING_CORE: {
    idFromName: () => "test-id",
    get: () => ({ fetch: async () => null }),
  },
};

const deriveActor = () => {
  derived++;
  return actor;
};

const futureExpiry = () =>
  new Date(Date.now() + 10 * 60 * 1000)
    .toISOString();

const forward = async input => {
  forwarded++;
  assert.equal(input.actorHash, actor);
  assert.equal(input.code, body.code);

  return {
    claimToken: token,
    claimExpiresAt: futureExpiry(),
  };
};

function req({
  payload = body,
  origin = "https://originx.example",
  fetchSite = "same-origin",
  contentType = "application/json",
  method = "POST",
  url = "https://originx.example/api/nft/buyer/claim",
} = {}) {
  return new Request(url, {
    method,
    headers: {
      ...(origin === null ? {} : {
        Origin: origin,
      }),
      "Sec-Fetch-Site": fetchSite,
      "Content-Type": contentType,
      "CF-Connecting-IP": "192.0.2.1",
    },
    ...(method === "POST" ? {
      body: JSON.stringify(payload),
    } : {}),
  });
}

const run = (request, env = baseEnv, extra = {}) =>
  handleBuyerClaimHttp({
    request,
    env,
    forward,
    deriveActor,
    ...extra,
  });

for (const environment of [
  {},
  {
    ...baseEnv,
    NFT_BUYER_CLAIM_HTTP_ENABLED: "false",
  },
  {
    ...baseEnv,
    NFT_BUYER_CLAIM_ENABLED: "false",
  },
  {
    ...baseEnv,
    NFT_INTERNAL_SERVICE_KEY: "",
  },
  {
    ...baseEnv,
    NFT_BUYER_ACTOR_SECRET: "",
  },
]) {
  assert.equal(
    (await run(req(), environment)).status,
    503,
  );
}

assert.equal(derived, 0);
assert.equal(forwarded, 0);

console.log("CLAIM_HTTP_DOUBLE_GATE=PASS");
console.log("CLAIM_HTTP_DISABLED_NO_DO_CALL=PASS");

for (const request of [
  req({ origin: null }),
  req({ origin: "https://attacker.example" }),
  req({ fetchSite: "cross-site" }),
]) {
  assert.equal(
    (await run(request)).status,
    403,
  );
}

assert.equal(forwarded, 0);

console.log("CLAIM_HTTP_CROSS_ORIGIN_BLOCKED=PASS");

assert.equal(
  (await run(req({
    contentType: "text/plain",
  }))).status,
  415,
);

assert.equal(
  (await run(req({ method: "GET" }))).status,
  405,
);

console.log("CLAIM_HTTP_METHOD_MEDIA_GUARDS=PASS");

for (const payload of [
  {},
  { ...body, actorHash: actor },
  { ...body, membershipId: "forged" },
  { ...body, claimToken: token },
  { ...body, code: "bad" },
  { ...body, challengeId: "invalid" },
]) {
  assert.equal(
    (await run(req({ payload }))).status,
    400,
  );
}

assert.equal(forwarded, 0);

console.log("CLAIM_HTTP_FORGED_INPUT_BLOCKED=PASS");

const valid = await run(req());

assert.equal(valid.status, 200);
assert.equal(
  valid.headers.get("Cache-Control"),
  "no-store, max-age=0",
);
assert.equal(
  valid.headers.get("Access-Control-Allow-Origin"),
  null,
);

const result = await valid.json();

assert.equal(result.claimToken, token);
assert.ok(
  Date.parse(result.claimExpiresAt) > Date.now()
);
assert.equal(derived, 1);
assert.equal(forwarded, 1);

console.log("CLAIM_HTTP_SUCCESS=PASS");
console.log("CLAIM_HTTP_NO_CACHE_NO_CORS=PASS");

const error = await run(req(), baseEnv, {
  forward: async () => {
    throw new Error("PRIVATE_DO_MEMBER_SECRET");
  },
});

assert.equal(error.status, 403);
assert.equal(
  (await error.text()).includes(
    "PRIVATE_DO_MEMBER_SECRET"
  ),
  false,
);

console.log("CLAIM_HTTP_ERRORS_REDACTED=PASS");

for (const credential of [
  null,
  {},
  {
    claimToken: "invalid",
    claimExpiresAt: futureExpiry(),
  },
  {
    claimToken: token,
    claimExpiresAt: "invalid",
  },
]) {
  const response = await run(
    req(),
    baseEnv,
    {
      forward: async () => credential,
    },
  );

  assert.equal(response.status, 503);
}

console.log("CLAIM_HTTP_INVALID_CREDENTIAL_BLOCKED=PASS");

/*
 * Test the actual HMAC actor derivation.
 * The buyer never supplies actorHash in JSON.
 */
const realActorResponse = await run(
  req(),
  baseEnv,
  {
    deriveActor: undefined,
    forward: async input => {
      assert.match(
        input.actorHash,
        /^[a-f0-9]{64}$/,
      );
      assert.notEqual(input.actorHash, actor);

      return {
        claimToken: token,
        claimExpiresAt: futureExpiry(),
      };
    },
  },
);

assert.equal(realActorResponse.status, 200);

console.log("CLAIM_HTTP_ACTOR_HMAC=PASS");

/*
 * The production Worker must remain without
 * a public claim route during Part 1.
 */
const worker = readFileSync(
  new URL(
    "../../../cloudflare/worker.mjs",
    import.meta.url,
  ),
  "utf8",
);

/*
 * Phase 5I.7 Part 2:
 * The route is now registered but must remain
 * disabled until both explicit flags are enabled.
 */
assert.equal(
  worker.includes('"/api/nft/buyer/claim"'),
  true,
);

assert.ok(
  worker.includes("OX_NFT_BUYER_CLAIM_GATE_V1"),
);

const routeStart = worker.indexOf(
  "OX_NFT_BUYER_CLAIM_GATE_V1",
);

const routeEnd = worker.indexOf(
  "OX_NFT_BUYER_PUBLIC_GATE_V1",
  routeStart,
);

assert.ok(routeStart >= 0);
assert.ok(routeEnd > routeStart);

const routeSection = worker.slice(
  routeStart,
  routeEnd,
);

assert.ok(
  routeSection.includes(
    'env?.NFT_BUYER_CLAIM_ENABLED !== "true"'
  ),
);

assert.ok(
  routeSection.includes(
    'env?.NFT_BUYER_CLAIM_HTTP_ENABLED !== "true"'
  ),
);

assert.ok(
  routeSection.includes(
    'import("./nftBuyerClaimHttpGateway.mjs")'
  ),
);

const flagIndex = routeSection.indexOf(
  'env?.NFT_BUYER_CLAIM_ENABLED !== "true"'
);

const importIndex = routeSection.indexOf(
  'import("./nftBuyerClaimHttpGateway.mjs")'
);

assert.ok(flagIndex >= 0);
assert.ok(importIndex > flagIndex);

console.log("CLAIM_HTTP_ROUTE_REGISTERED=PASS");
console.log("CLAIM_HTTP_DOUBLE_GATE_BEFORE_IMPORT=PASS");
console.log("NFT_CLOUDFLARE_PART_5I_7_1=PASS");
console.log("REAL_EMAIL_SENT=NO");
console.log("REAL_MINT=NO");
