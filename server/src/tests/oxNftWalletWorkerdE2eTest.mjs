import assert from "node:assert/strict";
import { Wallet } from "ethers";

/*
 * PHASE 5J.2 — real Cloudflare workerd test.
 *
 * The fixture is strictly loopback-only.
 * Wallets are generated for testing.
 *
 * Never run against a production domain.
 */

const BASE = "http://127.0.0.1:8793";
const KEY = "originx-fixture-internal-key-2026-test-only";

async function request(path, options = {}) {
  return fetch(BASE + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

async function fixtureRequest(path, data) {
  return request(path, {
    method: "POST",
    headers: {
      "X-OriginX-Fixture-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

async function inspect(membershipId) {
  const response = await fixtureRequest(
    "/__fixture/inspect",
    { membershipId },
  );

  assert.equal(response.status, 200);

  return response.json();
}

let ready = false;

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await request("/__fixture/health");

    if (response.status === 200) {
      const result = await response.json();

      if (
        result.database === "ok" &&
        result.migrations === "current"
      ) {
        ready = true;
        break;
      }
    }
  } catch {
    // Wait for the isolated workerd.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true, "WALLET_WORKER_NOT_READY");

console.log("WALLET_WORKER_DO_READY=PASS");

/*
 * Fixtures require an internal-only test key.
 */
const unauthorized = await request(
  "/__fixture/wallet/challenge",
  { method: "POST" },
);

assert.equal(unauthorized.status, 403);

console.log("WALLET_FIXTURE_AUTH_REQUIRED=PASS");

/*
 * Simulate the already-tested purchaser email
 * verification flow.
 */
const seeded = await fixtureRequest(
  "/__fixture/seed",
  {},
);

assert.equal(seeded.status, 200);

const membership = await seeded.json();

const buyerClaim = await request(
  "/api/nft/buyer/claim",
  {
    method: "POST",
    headers: {
      Origin: BASE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderPublicId: membership.orderPublicId,
      email: membership.email,
      challengeId: membership.challengeId,
      code: membership.code,
    }),
  },
);

assert.equal(buyerClaim.status, 200);

const claim = await buyerClaim.json();

assert.match(
  claim.claimToken,
  /^0x[a-f0-9]{64}$/,
);

console.log("WALLET_EMAIL_BOUND_CLAIM=PASS");

/*
 * Test wrong subscriber email before creating
 * the legitimate challenge.
 */
const wallet = Wallet.createRandom();
const attacker = Wallet.createRandom();

const challengeInput = {
  claimToken: claim.claimToken,
  email: membership.email,
  walletAddress: wallet.address,
};

const foreignEmail = await fixtureRequest(
  "/__fixture/wallet/challenge",
  {
    ...challengeInput,
    email: "attacker@example.org",
  },
);

assert.equal(foreignEmail.status, 403);

console.log("WALLET_FOREIGN_EMAIL_BLOCKED=PASS");

/*
 * Issue one challenge against the real
 * Durable Object and SQLite storage.
 */
const issued = await fixtureRequest(
  "/__fixture/wallet/challenge",
  challengeInput,
);

assert.equal(issued.status, 200);

const challenge = await issued.json();

assert.match(
  challenge.challengeId,
  /^[0-9a-f-]{36}$/i,
);

assert.equal(
  challenge.walletAddress,
  wallet.address,
);

assert.equal(challenge.chainId, 8453);

assert.ok(
  challenge.message.includes(
    "originx.example wants you to sign in"
  )
);

assert.equal(
  challenge.message.includes(
    membership.email
  ),
  false,
);

console.log("WALLET_SIWE_CHALLENGE_ISSUED=PASS");

/*
 * Cryptographically valid attacker signature
 * must not match the intended wallet.
 */
const attackerSignature =
  await attacker.signMessage(challenge.message);

const verificationBase = {
  challengeId: challenge.challengeId,
  claimToken: claim.claimToken,
  email: membership.email,
};

const forged = await fixtureRequest(
  "/__fixture/wallet/verify",
  {
    ...verificationBase,
    signature: attackerSignature,
  },
);

assert.equal(forged.status, 403);

const before = await inspect(
  membership.membershipId
);

assert.equal(before.issuedGrants, 1);
assert.equal(before.consumedGrants, 0);
assert.equal(before.verifiedWalletChallenges, 0);

console.log("WALLET_FOREIGN_SIGNATURE_BLOCKED=PASS");
console.log("WALLET_FAILED_SIGNATURE_NO_CONSUMPTION=PASS");

/*
 * Six simultaneous HTTP verification requests.
 * One must succeed, five must fail.
 */
const signature = await wallet.signMessage(
  challenge.message
);

const responses = await Promise.all(
  Array.from({ length: 6 }, () =>
    fixtureRequest(
      "/__fixture/wallet/verify",
      {
        ...verificationBase,
        signature,
      },
    )
  )
);

const statuses = responses.map(
  response => response.status
);

assert.equal(
  statuses.filter(status => status === 200).length,
  1,
  `WALLET_STATUSES:${statuses.join(",")}`,
);

assert.equal(
  statuses.filter(status => status === 403).length,
  5,
);

const accepted = await responses[
  statuses.indexOf(200)
].json();

assert.equal(accepted.verified, true);
assert.equal(
  accepted.walletAddress,
  wallet.address
);

console.log("WALLET_WORKER_SINGLE_SUCCESS=PASS");
console.log("WALLET_WORKER_CONCURRENT_REQUESTS=6");

/*
 * Reusing the same signature and token is
 * forbidden after the first success.
 */
const replay = await fixtureRequest(
  "/__fixture/wallet/verify",
  {
    ...verificationBase,
    signature,
  },
);

assert.equal(replay.status, 403);

console.log("WALLET_WORKER_REPLAY_BLOCKED=PASS");

/*
 * Inspect persisted SQLite state directly.
 */
const after = await inspect(
  membership.membershipId
);

assert.equal(after.issuedGrants, 0);
assert.equal(after.consumedGrants, 1);
assert.equal(after.totalGrants, 1);
assert.equal(after.verifiedWalletChallenges, 1);

assert.equal(
  after.mintJobStatus,
  "AWAITING_WALLET"
);

assert.equal(after.walletRecipient, null);

console.log("WALLET_WORKER_SQLITE_ATOMIC=PASS");
console.log("WALLET_WORKER_ONE_VERIFIED_CHALLENGE=PASS");
console.log("WALLET_WORKER_MINT_JOB_UNCHANGED=PASS");

console.log("==================================");
console.log(" OX_NFT_5J_2_WORKER_E2E=PASS");
console.log(" EMAIL_MEMBERSHIP_BINDING=VERIFIED");
console.log(" ECDSA_SIGNATURE=VERIFIED");
console.log(" CLAIM_CONSUMPTION=VERIFIED");
console.log(" REAL_MINT=NO");
console.log(" REAL_EMAIL_SENT=NO");
console.log("==================================");
