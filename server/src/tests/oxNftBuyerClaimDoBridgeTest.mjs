import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  handleInternalBuyerClaim,
} from "../../../cloudflare/nftBuyerClaimDoBridge.mjs";

const secret = "originx-test-internal-".repeat(3);
const token = "0x" + "a".repeat(64);

const env = {
  NFT_BUYER_CLAIM_ENABLED: "true",
  NFT_INTERNAL_SERVICE_KEY: secret,
};

const storage = {
  sql: {},
  transactionSync: fn => fn(),
};

const payload = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  challengeId: "11111111-2222-4333-8444-555555555555",
  code: "b".repeat(32),
  actorHash: "c".repeat(64),
};

let reserved = 0;
let completed = 0;

const reserve = ({ actorHash }) => {
  reserved++;
  assert.equal(actorHash, payload.actorHash);
  return { allowed: true };
};

const complete = data => {
  completed++;
  assert.equal(data.orderPublicId, payload.orderPublicId);
  assert.equal(data.challengeId, payload.challengeId);
  return {
    verified: true,
    claimToken: token,
    claimExpiresAt: "2026-10-25T04:00:00Z",
  };
};

function req({
  body = payload,
  key = secret,
  method = "POST",
  contentType = "application/json",
} = {}) {
  return new Request(
    "https://founding-core.internal/internal/nft/buyer/claim",
    {
      method,
      headers: {
        "Content-Type": contentType,
        ...(key === null ? {} : {
          "X-OriginX-Internal-Key": key,
        }),
      },
      ...(method === "GET" ? {} : {
        body: JSON.stringify(body),
      }),
    },
  );
}

const run = (
  request,
  environment = env,
  overrides = {},
) => handleInternalBuyerClaim({
  request,
  env: environment,
  storage,
  reserve,
  complete,
  ...overrides,
});

assert.equal(
  (await run(req(), {
    ...env,
    NFT_BUYER_CLAIM_ENABLED: "false",
  })).status,
  503,
);

assert.equal(reserved, 0);
assert.equal(completed, 0);

console.log("CLAIM_DO_DISABLED_BY_DEFAULT=PASS");

assert.equal(
  (await run(req({ key: null }))).status,
  503,
);

assert.equal(
  (await run(req({ key: "wrong-key" }))).status,
  503,
);

assert.equal(reserved, 0);
assert.equal(completed, 0);

console.log("CLAIM_DO_INTERNAL_AUTH_REQUIRED=PASS");

for (const body of [
  {},
  { ...payload, membershipId: "forged" },
  { ...payload, claimToken: token },
  { ...payload, actorHash: "invalid" },
  { ...payload, challengeId: "invalid" },
  { ...payload, code: "invalid" },
]) {
  assert.equal(
    (await run(req({ body }))).status,
    400,
  );
}

assert.equal(reserved, 0);
assert.equal(completed, 0);

console.log("CLAIM_DO_STRICT_INPUT=PASS");

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

console.log("CLAIM_DO_HTTP_GUARDS=PASS");

const limited = await run(req(), env, {
  reserve: () => ({ allowed: false }),
});

assert.equal(limited.status, 429);
assert.equal(completed, 0);

console.log("CLAIM_DO_RATE_LIMIT=PASS");

const rejected = await run(req(), env, {
  complete: () => {
    throw new Error("SECRET_PRIVATE_MEMBER_DATA");
  },
});

assert.equal(rejected.status, 403);
assert.equal(
  (await rejected.text()).includes(
    "SECRET_PRIVATE_MEMBER_DATA"
  ),
  false,
);

console.log("CLAIM_DO_ERRORS_REDACTED=PASS");

const success = await run(req());

assert.equal(success.status, 200);
assert.equal(
  success.headers.get("Cache-Control"),
  "no-store",
);

const result = await success.json();

assert.deepEqual(result, {
  claimToken: token,
  claimExpiresAt: "2026-10-25T04:00:00Z",
});

assert.equal(reserved, 2);
assert.equal(completed, 1);

console.log("CLAIM_DO_PRIVATE_CREDENTIAL=PASS");

const core = readFileSync(
  new URL(
    "../../../cloudflare/foundingCore.mjs",
    import.meta.url,
  ),
  "utf8",
);

const worker = readFileSync(
  new URL(
    "../../../cloudflare/worker.mjs",
    import.meta.url,
  ),
  "utf8",
);

assert.ok(
  core.includes('"/internal/nft/buyer/claim"'),
);

assert.ok(
  core.includes(
    'import("./nftBuyerClaimDoBridge.mjs")'
  ),
);

assert.equal(
  worker.includes('"/api/nft/buyer/claim"'),
  false,
);

console.log("CLAIM_DO_PRIVATE_ROUTE=PASS");
console.log("NFT_BUYER_CLAIM_DO_BRIDGE_TEST=PASS");
console.log("PUBLIC_CLAIM_ENDPOINT=NO");
console.log("REAL_MINT=NO");
