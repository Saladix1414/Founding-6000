import assert from "node:assert/strict";
import { Wallet } from "ethers";

const BASE = "http://127.0.0.1:8797";

const FIXTURE_KEY =
  "originx-fixture-internal-key-2026-test-only";

const READINESS_KEY =
  "originx-readiness-fixture-2026-local-only-key";

async function call(path, options = {}) {
  return fetch(BASE + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

async function fixture(path, body) {
  return call(path, {
    method: "POST",
    headers: {
      "X-OriginX-Fixture-Key": FIXTURE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function readiness(body, key = READINESS_KEY) {
  return call("/__fixture/readiness/bridge", {
    method: "POST",
    headers: {
      "X-OriginX-Fixture-Key": FIXTURE_KEY,
      "Content-Type": "application/json",
      ...(key === null
        ? {}
        : { "X-OriginX-Readiness-Key": key }),
    },
    body: JSON.stringify(body),
  });
}

let ready = false;

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await call("/__fixture/health");

    if (response.status === 200) {
      const health = await response.json();

      if (
        health.database === "ok" &&
        health.migrations === "current"
      ) {
        ready = true;
        break;
      }
    }
  } catch {
    // Workerd startup is still pending.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true);

console.log("AUTHORITY_WORKER_READY=PASS");

/*
 * A direct public request to the private
 * DO route must not be routed to FoundingCore.
 */
const publicAccess = await call(
  "/internal/nft/mint/readiness",
  { method: "POST" },
);

assert.equal(publicAccess.status, 404);

console.log("PRIVATE_ROUTE_NOT_PUBLIC=PASS");

const unauthorizedFixture = await call(
  "/__fixture/readiness/bridge",
  { method: "POST" },
);

assert.equal(unauthorizedFixture.status, 403);

console.log("FIXTURE_BRIDGE_AUTH_REQUIRED=PASS");

const seeded = await fixture("/__fixture/seed", {});

assert.equal(seeded.status, 200);

const member = await seeded.json();

const input = {
  membershipId: member.membershipId,
  email: member.email,
};

assert.equal(
  (await readiness(input, null)).status,
  403
);

assert.equal(
  (await readiness(input, "attacker")).status,
  403
);

console.log("READINESS_INTERNAL_SECRET_REQUIRED=PASS");

assert.equal(
  (await readiness({
    ...input,
    walletAddress: Wallet.createRandom().address,
  })).status,
  400
);

assert.equal(
  (await readiness({
    ...input,
    approved: true,
  })).status,
  400
);

assert.equal(
  (await readiness({
    ...input,
    mintAuthority: true,
  })).status,
  400
);

console.log("READINESS_AUTHORITY_INJECTION_BLOCKED=PASS");

assert.equal(
  (await readiness(input)).status,
  403
);

console.log("READINESS_PREMATURE_REJECTED=PASS");

const claimed = await call(
  "/api/nft/buyer/claim",
  {
    method: "POST",
    headers: {
      Origin: BASE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderPublicId: member.orderPublicId,
      email: member.email,
      challengeId: member.challengeId,
      code: member.code,
    }),
  },
);

assert.equal(claimed.status, 200);

const grant = await claimed.json();

const wallet = Wallet.createRandom();

const issued = await fixture(
  "/__fixture/wallet/challenge",
  {
    claimToken: grant.claimToken,
    email: member.email,
    walletAddress: wallet.address,
  },
);

assert.equal(issued.status, 200);

const challenge = await issued.json();
const signature = await wallet.signMessage(
  challenge.message
);

const verified = await fixture(
  "/__fixture/wallet/verify",
  {
    challengeId: challenge.challengeId,
    claimToken: grant.claimToken,
    email: member.email,
    signature,
  },
);

assert.equal(verified.status, 200);

assert.equal(
  (await readiness(input)).status,
  403
);

console.log("READINESS_BINDING_REQUIRED=PASS");

const bound = await fixture(
  "/__fixture/wallet/bind",
  {
    challengeId: challenge.challengeId,
    email: member.email,
  },
);

assert.equal(bound.status, 200);

assert.equal(
  (await readiness({
    ...input,
    email: "attacker@example.org",
  })).status,
  403
);

console.log("READINESS_ORIGINAL_EMAIL_REQUIRED=PASS");

const responses = await Promise.all(
  Array.from({ length: 6 }, () =>
    readiness(input)
  )
);

const statuses = responses.map(
  response => response.status
);

assert.equal(
  statuses.filter(status => status === 200).length,
  1,
  `AUTHORITY_E2E_STATUSES:${statuses.join(",")}`
);

assert.equal(
  statuses.filter(status => status === 403).length,
  5
);

const success = await responses[
  statuses.indexOf(200)
].json();

assert.equal(success.prepared, true);
assert.equal(success.status, "READY");
assert.equal(success.mintAuthority, false);
assert.equal(success.transactionSubmitted, false);

console.log("AUTHORITY_CONCURRENT_SINGLE_SUCCESS=PASS");

assert.equal(
  (await readiness(input)).status,
  403
);

console.log("AUTHORITY_REPLAY_BLOCKED=PASS");

const inspected = await fixture(
  "/__fixture/inspect",
  { membershipId: member.membershipId },
);

assert.equal(inspected.status, 200);

const state = await inspected.json();

assert.equal(state.mintJobStatus, "READY");
assert.equal(state.walletRecipient, wallet.address);
assert.equal(state.mintReadinessEventCount, 1);
assert.equal(state.walletBindingCount, 1);
assert.equal(state.walletBindingEventCount, 1);

console.log("AUTHORITY_SQLITE_READY=PASS");
console.log("AUTHORITY_AUDIT_ONCE=PASS");
console.log("AUTHORITY_RECIPIENT_VERIFIED=PASS");

console.log("OX_NFT_5J_6_AUTHORITY_WORKER_E2E=PASS");
console.log("PUBLIC_MINT_READINESS_ENDPOINT=NO");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
