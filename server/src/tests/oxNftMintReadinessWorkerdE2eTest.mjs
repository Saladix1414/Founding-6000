import assert from "node:assert/strict";
import { Wallet } from "ethers";

const BASE = "http://127.0.0.1:8796";
const KEY =
  "originx-fixture-internal-key-2026-test-only";

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
      "X-OriginX-Fixture-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function inspect(membershipId) {
  const response = await fixture(
    "/__fixture/inspect",
    { membershipId },
  );

  assert.equal(response.status, 200);
  return response.json();
}

let ready = false;

for (let n = 0; n < 45; n++) {
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
    // Worker initialization pending.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true);

console.log("READINESS_WORKER_READY=PASS");

const unauthorized = await call(
  "/__fixture/mint/readiness",
  { method: "POST" },
);

assert.equal(unauthorized.status, 403);

console.log("READINESS_FIXTURE_AUTH=PASS");

const seedResponse = await fixture(
  "/__fixture/seed",
  {},
);

assert.equal(seedResponse.status, 200);
const member = await seedResponse.json();

const input = {
  membershipId: member.membershipId,
  email: member.email,
};

const premature = await fixture(
  "/__fixture/mint/readiness",
  input,
);

assert.equal(premature.status, 403);

console.log("READINESS_PREMATURE_BLOCKED=PASS");

const claimResponse = await call(
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

assert.equal(claimResponse.status, 200);

const grant = await claimResponse.json();

const wallet = Wallet.createRandom();

const challengeResponse = await fixture(
  "/__fixture/wallet/challenge",
  {
    claimToken: grant.claimToken,
    email: member.email,
    walletAddress: wallet.address,
  },
);

assert.equal(challengeResponse.status, 200);

const challenge = await challengeResponse.json();

const signature = await wallet.signMessage(
  challenge.message
);

const verifyResponse = await fixture(
  "/__fixture/wallet/verify",
  {
    challengeId: challenge.challengeId,
    claimToken: grant.claimToken,
    email: member.email,
    signature,
  },
);

assert.equal(verifyResponse.status, 200);

const withoutBinding = await fixture(
  "/__fixture/mint/readiness",
  input,
);

assert.equal(withoutBinding.status, 403);

console.log("READINESS_BINDING_REQUIRED=PASS");

const bindResponse = await fixture(
  "/__fixture/wallet/bind",
  {
    challengeId: challenge.challengeId,
    email: member.email,
  },
);

assert.equal(bindResponse.status, 200);

const foreignEmail = await fixture(
  "/__fixture/mint/readiness",
  {
    ...input,
    email: "attacker@example.org",
  },
);

assert.equal(foreignEmail.status, 403);

const foreignMember = await fixture(
  "/__fixture/mint/readiness",
  {
    ...input,
    membershipId: crypto.randomUUID(),
  },
);

assert.equal(foreignMember.status, 403);

console.log("READINESS_FOREIGN_EMAIL_BLOCKED=PASS");
console.log("READINESS_FOREIGN_MEMBER_BLOCKED=PASS");

/*
 * Six concurrent requests are sent to
 * the actual SQLite-backed Durable Object.
 */
const responses = await Promise.all(
  Array.from({ length: 6 }, () =>
    fixture(
      "/__fixture/mint/readiness",
      input,
    )
  )
);

const statuses = responses.map(
  response => response.status
);

assert.equal(
  statuses.filter(s => s === 200).length,
  1,
  `READINESS_STATUSES:${statuses.join(",")}`,
);

assert.equal(
  statuses.filter(s => s === 403).length,
  5,
);

const success = await responses[
  statuses.indexOf(200)
].json();

assert.equal(success.prepared, true);
assert.equal(success.status, "READY");
assert.equal(success.walletAddress, wallet.address);
assert.equal(success.mintAuthority, false);
assert.equal(success.transactionSubmitted, false);

console.log("READINESS_CONCURRENT_REQUESTS=6");
console.log("READINESS_CONCURRENT_SINGLE_SUCCESS=PASS");

const replay = await fixture(
  "/__fixture/mint/readiness",
  input,
);

assert.equal(replay.status, 403);

console.log("READINESS_REPLAY_BLOCKED=PASS");

const state = await inspect(
  member.membershipId
);

assert.equal(state.mintJobStatus, "READY");
assert.equal(state.walletRecipient, wallet.address);
assert.equal(state.walletBindingCount, 1);
assert.equal(state.walletBindingEventCount, 1);
assert.equal(state.mintReadinessEventCount, 1);

assert.equal(state.consumedGrants, 1);
assert.equal(state.verifiedWalletChallenges, 1);

console.log("READINESS_SQLITE_STATUS_READY=PASS");
console.log("READINESS_SQLITE_RECIPIENT=PASS");
console.log("READINESS_AUDIT_EVENT_ONCE=PASS");

console.log("OX_NFT_5J_5_WORKER_E2E=PASS");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
