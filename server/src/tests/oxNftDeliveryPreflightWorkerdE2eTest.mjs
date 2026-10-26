import assert from "node:assert/strict";
import { Wallet } from "ethers";

/*
 * OriginX 5J.4 — isolated workerd E2E.
 * Only 127.0.0.1:8795 is supported.
 * Never point this test at production.
 */

const BASE = "http://127.0.0.1:8795";
const KEY = "originx-fixture-internal-key-2026-test-only";

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

async function preflight(membershipId, email) {
  return fixture("/__fixture/delivery/preflight", {
    membershipId,
    email,
  });
}

let ready = false;

for (let n = 0; n < 45; n++) {
  try {
    const response = await call("/__fixture/health");

    if (response.ok) {
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
    // Wait for isolated workerd startup.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true, "PREFLIGHT_WORKER_NOT_READY");

console.log("PREFLIGHT_DO_SQLITE_READY=PASS");

const unauthorized = await call(
  "/__fixture/delivery/preflight",
  { method: "POST" },
);

assert.equal(unauthorized.status, 403);

console.log("PREFLIGHT_FIXTURE_AUTH_REQUIRED=PASS");

const seedResponse = await fixture(
  "/__fixture/seed",
  {},
);

assert.equal(seedResponse.status, 200);

const member = await seedResponse.json();

const before = await preflight(
  member.membershipId,
  member.email,
);

assert.equal(before.status, 403);

console.log("UNBOUND_MEMBERSHIP_BLOCKED=PASS");

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

assert.match(
  grant.claimToken,
  /^0x[a-f0-9]{64}$/,
);

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

const unverified = await preflight(
  member.membershipId,
  member.email,
);

assert.equal(unverified.status, 403);

console.log("UNVERIFIED_SIGNATURE_BLOCKED=PASS");

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

const notBound = await preflight(
  member.membershipId,
  member.email,
);

assert.equal(notBound.status, 403);

console.log("MISSING_WALLET_BINDING_BLOCKED=PASS");

const bound = await fixture(
  "/__fixture/wallet/bind",
  {
    challengeId: challenge.challengeId,
    email: member.email,
  },
);

assert.equal(bound.status, 200);

const wrongEmail = await preflight(
  member.membershipId,
  "attacker@example.org",
);

assert.equal(wrongEmail.status, 403);

const wrongMember = await preflight(
  crypto.randomUUID(),
  member.email,
);

assert.equal(wrongMember.status, 403);

console.log("PREFLIGHT_FOREIGN_EMAIL_BLOCKED=PASS");
console.log("PREFLIGHT_FOREIGN_MEMBER_BLOCKED=PASS");

const response = await preflight(
  member.membershipId,
  member.email,
);

assert.equal(response.status, 200);

const review = await response.json();

assert.equal(review.eligibleForDeliveryReview, true);
assert.equal(review.membershipId, member.membershipId);
assert.equal(review.walletAddress, wallet.address);
assert.equal(review.chainId, 8453);
assert.equal(review.mintAuthority, false);
assert.equal(review.blockchainTransaction, false);

console.log("PREFLIGHT_VERIFIED_DELIVERY=PASS");
console.log("PREFLIGHT_MINT_AUTHORITY_FALSE=PASS");

const inspection = await fixture(
  "/__fixture/inspect",
  { membershipId: member.membershipId },
);

assert.equal(inspection.status, 200);

const state = await inspection.json();

assert.equal(state.walletBindingCount, 1);
assert.equal(state.walletBindingEventCount, 1);
assert.equal(state.consumedGrants, 1);
assert.equal(state.verifiedWalletChallenges, 1);
assert.equal(state.mintJobStatus, "AWAITING_WALLET");
assert.equal(state.walletRecipient, null);

console.log("PREFLIGHT_SQLITE_EVIDENCE=PASS");
console.log("PREFLIGHT_MINT_JOB_UNCHANGED=PASS");

console.log("OX_NFT_5J_4_WORKER_E2E=PASS");
console.log("PUBLIC_PREFLIGHT_ROUTE=NO");
console.log("REAL_PAYMENT=NO");
console.log("REAL_EMAIL=NO");
console.log("REAL_MINT=NO");
