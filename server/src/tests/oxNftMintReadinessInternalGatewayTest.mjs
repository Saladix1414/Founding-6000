import assert from "node:assert/strict";

import {
  handleInternalMintReadiness,
} from "../../../cloudflare/nftMintReadinessInternalGateway.mjs";

const KEY = "test-only-readiness-key-2026-".repeat(2);

const membershipId = crypto.randomUUID();

const storage = {
  sql: {},
  transactionSync(fn) {
    return fn();
  },
};

const baseEnv = {
  NFT_MINT_READINESS_ENABLED: "true",
  NFT_READINESS_INTERNAL_KEY: KEY,
};

let serviceCalls = 0;

function prepare(input) {
  serviceCalls++;

  assert.equal(input.membershipId, membershipId);
  assert.equal(input.email, "buyer@example.org");
  assert.equal(
    input.authorizeReadiness({
      operation: "NFT_MINT_READINESS",
      membershipId,
    }),
    true,
  );

  assert.equal(
    input.authorizeReadiness({
      operation: "NFT_MINT_EXECUTE",
      membershipId,
    }),
    false,
  );

  return {
    prepared: true,
    membershipId,
    serialNumber: 551,
    status: "READY",
    mintAuthority: false,
    transactionSubmitted: false,
  };
}

function request({
  key = KEY,
  method = "POST",
  body = {
    membershipId,
    email: "buyer@example.org",
  },
  contentType = "application/json",
} = {}) {
  const headers = {
    "Content-Type": contentType,
  };

  if (key !== null) {
    headers["X-OriginX-Readiness-Key"] = key;
  }

  return new Request(
    "https://founding-core.internal/internal/nft/mint/readiness",
    {
      method,
      headers,
      ...(method !== "GET"
        ? { body: JSON.stringify(body) }
        : {}),
    },
  );
}

async function invoke({
  env = baseEnv,
  ...options
} = {}) {
  return handleInternalMintReadiness({
    request: request(options),
    storage,
    env,
    prepare,
  });
}

const disabled = await invoke({
  env: {
    ...baseEnv,
    NFT_MINT_READINESS_ENABLED: "false",
  },
});

assert.equal(disabled.status, 403);

const missingEnv = await invoke({
  env: {},
});

assert.equal(missingEnv.status, 403);

console.log("READINESS_DEFAULT_OFF=PASS");

assert.equal(
  (await invoke({ key: null })).status,
  403,
);

assert.equal(
  (await invoke({ key: "attacker" })).status,
  403,
);

console.log("READINESS_INTERNAL_KEY_REQUIRED=PASS");

assert.equal(
  (await invoke({ method: "GET" })).status,
  405,
);

assert.equal(
  (await invoke({
    contentType: "text/plain",
  })).status,
  415,
);

console.log("READINESS_HTTP_BOUNDARY=PASS");

for (const extra of [
  { walletAddress: "0xattacker" },
  { recipientAddress: "0xattacker" },
  { mintAuthority: true },
  { authorizeReadiness: true },
  { role: "ADMIN" },
  { approved: true },
]) {
  const result = await invoke({
    body: {
      membershipId,
      email: "buyer@example.org",
      ...extra,
    },
  });

  assert.equal(result.status, 400);
}

console.log("READINESS_AUTHORITY_INJECTION_BLOCKED=PASS");

assert.equal(serviceCalls, 0);

const success = await invoke();

assert.equal(success.status, 200);

const response = await success.json();

assert.equal(response.prepared, true);
assert.equal(response.status, "READY");
assert.equal(response.serialNumber, 551);
assert.equal(response.mintAuthority, false);
assert.equal(response.transactionSubmitted, false);

assert.equal(serviceCalls, 1);

console.log("READINESS_TRUSTED_GATEWAY=PASS");
console.log("READINESS_MINT_AUTHORITY_NONE=PASS");

console.log("OX_NFT_5J_6_PART_2=PASS");
console.log("PUBLIC_ENDPOINT=NO");
console.log("REAL_MINT=NO");
