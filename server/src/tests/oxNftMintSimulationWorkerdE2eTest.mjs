import assert from "node:assert/strict";
import { Wallet } from "ethers";

const BASE = "http://127.0.0.1:8798";
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
/*
 * Perform exactly one readiness transition,
 * then race six independent HTTP reservations.
 */
const prepared = await fixture(
  "/__fixture/mint/readiness",
  input,
);

assert.equal(prepared.status, 200);

const readiness = await prepared.json();

assert.equal(readiness.prepared, true);
assert.equal(readiness.status, "READY");

const reserveInput = {
  mintJobId: readiness.mintJobId,
};

const prematureReplay = await fixture(
  "/__fixture/mint/readiness",
  input,
);

assert.equal(prematureReplay.status, 403);

const unauth = await call(
  "/__fixture/mint/simulate",
  { method: "POST" },
);

assert.equal(unauth.status, 403);

const unknown = await fixture(
  "/__fixture/mint/simulate",
  { mintJobId: crypto.randomUUID() },
);

assert.equal(unknown.status, 403);

for (const attack of [
  { ...reserveInput, recipient: wallet.address },
  { ...reserveInput, tokenId: 51 },
  { ...reserveInput, mintAuthority: true },
]) {
  const response = await fixture(
    "/__fixture/mint/simulate",
    attack,
  );

  assert.equal(response.status, 400);
}

console.log("SIMULATION_FIXTURE_AUTH=PASS");
console.log("SIMULATION_INPUT_INJECTION_BLOCKED=PASS");

const responses = await Promise.all(
  Array.from({ length: 6 }, () =>
    fixture(
      "/__fixture/mint/simulate",
      reserveInput,
    )
  )
);

const statuses = responses.map(r => r.status);

assert.equal(
  statuses.filter(s => s === 200).length,
  1,
  "SIMULATION_STATUSES:" + statuses.join(","),
);

assert.equal(
  statuses.filter(s => s === 403).length,
  5,
);

const reservation = await responses[
  statuses.indexOf(200)
].json();

assert.equal(reservation.simulated, true);
assert.equal(reservation.status, "MINTING");
assert.equal(reservation.tokenId, 51);
assert.equal(reservation.recipient, wallet.address);
assert.equal(reservation.mintAuthority, false);
assert.equal(reservation.transactionSigned, false);
assert.equal(reservation.transactionSubmitted, false);

console.log("SIMULATION_HTTP_REQUESTS=6");
console.log("SIMULATION_HTTP_SINGLE_SUCCESS=PASS");

const replay = await fixture(
  "/__fixture/mint/simulate",
  reserveInput,
);

assert.equal(replay.status, 403);

console.log("SIMULATION_HTTP_REPLAY_BLOCKED=PASS");

const inspected = await inspect(
  member.membershipId
);

assert.equal(inspected.mintJobStatus, "MINTING");
assert.equal(inspected.walletRecipient, wallet.address);
assert.equal(inspected.mintReadinessEventCount, 1);
assert.equal(inspected.mintSimulationReservationCount, 1);
assert.equal(inspected.walletBindingCount, 1);
assert.equal(inspected.walletBindingEventCount, 1);
assert.equal(inspected.consumedGrants, 1);

console.log("SIMULATION_SQLITE_MINTING=PASS");
console.log("SIMULATION_SQLITE_AUDIT_ONCE=PASS");
console.log("ORIGINAL_BUYER_IDENTITY_PRESERVED=PASS");

console.log("OX_NFT_MINT_SIMULATION_WORKER_E2E=PASS");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
