import assert from "node:assert/strict";
import { Wallet } from "ethers";

/*
 * PHASE 5J.3
 *
 * Execute only against the loopback fixture
 * running at 127.0.0.1:8794.
 *
 * Never target a production URL.
 */

const BASE = "http://127.0.0.1:8794";

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

/*
 * Wait until Cloudflare Durable Object
 * and SQLite migrations are ready.
 */
let ready = false;

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await call(
      "/__fixture/health"
    );

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
    // workerd is still starting.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true);

console.log("WALLET_BINDING_WORKER_READY=PASS");

/*
 * The new fixture route must never accept
 * unauthenticated requests.
 */
const unauthorized = await call(
  "/__fixture/wallet/bind",
  { method: "POST" },
);

assert.equal(unauthorized.status, 403);

console.log("WALLET_BINDING_FIXTURE_AUTH=PASS");

/*
 * Generate a simulated paid order and
 * its registered subscriber email.
 */
const seeded = await fixture(
  "/__fixture/seed",
  {},
);

assert.equal(seeded.status, 200);

const member = await seeded.json();

assert.equal(member.email, "buyer@example.org");

/*
 * Verify buyer email and obtain a claim
 * through the existing HTTP gateway.
 */
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

assert.match(
  grant.claimToken,
  /^0x[a-f0-9]{64}$/,
);

console.log("BINDING_BUYER_EMAIL_VERIFIED=PASS");

/*
 * Generate a real, disposable Ethereum wallet.
 */
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

assert.equal(
  challenge.walletAddress,
  wallet.address,
);

/*
 * A pending challenge is not sufficient
 * authorization to create a wallet binding.
 */
const bindingInput = {
  challengeId: challenge.challengeId,
  email: member.email,
};

const premature = await fixture(
  "/__fixture/wallet/bind",
  bindingInput,
);

assert.equal(premature.status, 403);

const pending = await inspect(
  member.membershipId
);

assert.equal(pending.walletBindingCount, 0);

console.log("UNVERIFIED_WALLET_BINDING_BLOCKED=PASS");

/*
 * Sign the exact challenge issued by the
 * Durable Object using real ECDSA.
 */
const signature = await wallet.signMessage(
  challenge.message
);

const verified = await fixture(
  "/__fixture/wallet/verify",
  {
    ...bindingInput,
    claimToken: grant.claimToken,
    signature,
  },
);

assert.equal(verified.status, 200);

const verifiedResult = await verified.json();

assert.equal(verifiedResult.verified, true);
assert.equal(
  verifiedResult.walletAddress,
  wallet.address,
);

console.log("BINDING_REAL_ECDSA_VERIFIED=PASS");

/*
 * The buyer's original email is essential.
 * A different email cannot bind the wallet.
 */
const wrongEmail = await fixture(
  "/__fixture/wallet/bind",
  {
    ...bindingInput,
    email: "attacker@example.org",
  },
);

assert.equal(wrongEmail.status, 403);

const wrongChallenge = await fixture(
  "/__fixture/wallet/bind",
  {
    ...bindingInput,
    challengeId: crypto.randomUUID(),
  },
);

assert.equal(wrongChallenge.status, 403);

console.log("BINDING_FOREIGN_EMAIL_BLOCKED=PASS");
console.log("BINDING_UNKNOWN_CHALLENGE_BLOCKED=PASS");

/*
 * Six overlapping HTTP requests against
 * the Cloudflare Durable Object.
 *
 * Exactly one may create the durable record.
 */
const responses = await Promise.all(
  Array.from({ length: 6 }, () =>
    fixture(
      "/__fixture/wallet/bind",
      bindingInput,
    )
  )
);

const statuses = responses.map(
  response => response.status
);

assert.equal(
  statuses.filter(status => status === 200).length,
  1,
  `BINDING_HTTP_STATUSES:${statuses.join(",")}`,
);

assert.equal(
  statuses.filter(status => status === 403).length,
  5,
);

const success = await responses[
  statuses.indexOf(200)
].json();

assert.equal(success.bound, true);
assert.equal(
  success.walletAddress,
  wallet.address,
);

console.log("BINDING_CONCURRENT_REQUESTS=6");
console.log("BINDING_CONCURRENT_SUCCESS_COUNT=1");

/*
 * A second binding attempt must never
 * overwrite the original association.
 */
const replay = await fixture(
  "/__fixture/wallet/bind",
  bindingInput,
);

assert.equal(replay.status, 403);

console.log("BINDING_DUPLICATE_BLOCKED=PASS");

/*
 * Inspect the durable SQLite state.
 */
const state = await inspect(
  member.membershipId
);

assert.equal(state.walletBindingCount, 1);
assert.equal(state.walletBindingStatus, "BOUND");

assert.equal(
  state.walletBindingAddress,
  wallet.address,
);

assert.equal(state.walletBindingEventCount, 1);

assert.equal(
  state.mintJobStatus,
  "AWAITING_WALLET",
);

assert.equal(state.walletRecipient, null);

assert.equal(state.consumedGrants, 1);
assert.equal(state.verifiedWalletChallenges, 1);

console.log("BINDING_SQLITE_SINGLE_RECORD=PASS");
console.log("BINDING_AUDIT_EVENT_ONCE=PASS");
console.log("BINDING_EMAIL_CLAIM_CONSUMED=PASS");
console.log("BINDING_MINT_JOB_UNCHANGED=PASS");

console.log("========================================");
console.log(" OX_NFT_5J_3_WORKER_E2E=PASS");
console.log(" REGISTERED_SUBSCRIBER_EMAIL=REQUIRED");
console.log(" CRYPTOGRAPHIC_WALLET_PROOF=REQUIRED");
console.log(" PERSISTENT_BINDING=VERIFIED");
console.log(" PUBLIC_WALLET_BINDING_ENDPOINT=NO");
console.log(" NFT_OWNER_OF=NOT_ASSUMED");
console.log(" REAL_MINT=NO");
console.log(" REAL_FUNDS_MOVED=NO");
console.log("========================================");
