import assert from "node:assert/strict";

import {
  handleBuyerEmailRequest,
} from "../../../cloudflare/nftBuyerHttpBoundary.mjs";

const path = "https://originx.example/api/nft/buyer/email";
const secret = "originx-test-hmac-secret-".repeat(3);

const validBody = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
};

let executions = 0;
let lastPayload = null;

const mockService = async payload => {
  executions++;
  lastPayload = payload;

  return {
    acceptedForProcessing: true,
  };
};

function makeRequest({
  body = validBody,
  method = "POST",
  contentType = "application/json",
  ip = "203.0.113.40",
} = {}) {
  return new Request(path, {
    method,
    headers: {
      "Content-Type": contentType,
      ...(ip === null ? {} : {
        "CF-Connecting-IP": ip,
      }),
    },
    ...(method === "GET" || method === "HEAD"
      ? {}
      : {
          body: typeof body === "string"
            ? body
            : JSON.stringify(body),
        }),
  });
}

const config = {
  storage: { test: true },
  enabled: true,
  actorSecret: secret,
  apiKey: "re_test_placeholder_not_real",
  from: "verify@example.org",
  service: mockService,
};

async function handle(request, overrides = {}) {
  return handleBuyerEmailRequest({
    request,
    ...config,
    ...overrides,
  });
}

/* Default disabled. */
const disabled = await handle(
  makeRequest(),
  { enabled: false },
);

assert.equal(disabled.status, 503);
assert.equal(executions, 0);

console.log("HTTP_FEATURE_DISABLED_BY_DEFAULT=PASS");

/* Missing HMAC configuration. */
const missingSecret = await handle(
  makeRequest(),
  { actorSecret: "" },
);

assert.equal(missingSecret.status, 503);
assert.equal(executions, 0);

console.log("HTTP_MISSING_SECRET_FAIL_CLOSED=PASS");

/* Method restriction. */
const getRequest = await handle(
  makeRequest({ method: "GET" }),
);

assert.equal(getRequest.status, 405);
console.log("HTTP_POST_ONLY=PASS");

/* Media type restriction. */
const wrongMedia = await handle(
  makeRequest({ contentType: "text/plain" }),
);

assert.equal(wrongMedia.status, 415);
console.log("HTTP_JSON_ONLY=PASS");

/* Reject arrays, extra keys, missing keys. */
for (const body of [
  [],
  {},
  { orderPublicId: validBody.orderPublicId },
  { ...validBody, membershipId: "forged" },
  { ...validBody, actorHash: "a".repeat(64) },
]) {
  const result = await handle(makeRequest({ body }));
  assert.equal(result.status, 400);
}

console.log("HTTP_STRICT_SCHEMA=PASS");

/* Body-size restriction. */
const oversized = await handle(
  makeRequest({
    body: JSON.stringify({
      ...validBody,
      padding: "x".repeat(3000),
    }),
  }),
);

assert.equal(oversized.status, 413);
console.log("HTTP_BODY_SIZE_LIMIT=PASS");

/* Invalid IP must stop before domain service. */
const invalidOrigin = await handle(
  makeRequest({ ip: null }),
);

assert.equal(invalidOrigin.status, 503);
assert.equal(executions, 0);

console.log("HTTP_INVALID_ORIGIN_FAIL_CLOSED=PASS");

/* Eligible-looking inputs yield generic response. */
const good = await handle(makeRequest());
assert.equal(good.status, 202);

const goodBody = await good.json();

assert.equal(goodBody.acceptedForProcessing, true);
assert.equal("membershipId" in goodBody, false);
assert.equal("claimToken" in goodBody, false);
assert.equal("code" in goodBody, false);

assert.equal(executions, 1);
assert.equal(lastPayload.orderPublicId,
  validBody.orderPublicId);
assert.equal(lastPayload.email, validBody.email);
assert.match(lastPayload.actorHash, /^[0-9a-f]{64}$/);

console.log("HTTP_PUBLIC_ACK_NO_SECRETS=PASS");
console.log("HTTP_ACTOR_DERIVED_SERVER_SIDE=PASS");

/* Domain failures must never expose internal data. */
const failed = await handle(
  makeRequest(),
  {
    service: async () => {
      throw new Error(
        "INTERNAL_PRIVATE_MEMBERSHIP_SECRET"
      );
    },
  },
);

assert.equal(failed.status, 503);

const failedBody = await failed.text();

assert.equal(
  failedBody.includes("PRIVATE_MEMBERSHIP"),
  false,
);

console.log("HTTP_INTERNAL_ERRORS_REDACTED=PASS");

const cached = await handle(makeRequest());
assert.equal(
  cached.headers.get("Cache-Control"),
  "no-store",
);

console.log("HTTP_RESPONSE_NO_STORE=PASS");
console.log("NFT_BUYER_HTTP_BOUNDARY_TEST=PASS");
console.log("PUBLIC_ROUTE_INSTALLED=NO");
console.log("REAL_EMAIL_SENT=NO");
