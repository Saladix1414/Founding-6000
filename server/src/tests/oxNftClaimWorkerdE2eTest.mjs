import assert from "node:assert/strict";

/*
 * Execute only with the isolated fixture
 * running on 127.0.0.1:8792.
 *
 * Never target a production URL.
 */

const BASE = "http://127.0.0.1:8792";
const KEY = "originx-fixture-internal-key-2026-test-only";

async function call(path, options = {}) {
  return fetch(BASE + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

let ready = false;

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await call("/__fixture/health");

    if (response.ok) {
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
    // Wait for workerd startup.
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.equal(ready, true, "FIXTURE_NOT_READY");

console.log("FIXTURE_WORKER_DO_SQLITE=PASS");

const unauthorized = await call("/__fixture/seed", {
  method: "POST",
});

assert.equal(unauthorized.status, 403);

console.log("FIXTURE_SEED_AUTH_REQUIRED=PASS");

const seeded = await call("/__fixture/seed", {
  method: "POST",
  headers: {
    "X-OriginX-Fixture-Key": KEY,
  },
});

assert.equal(seeded.status, 200);

const fixture = await seeded.json();

assert.match(
  fixture.orderPublicId,
  /^F6K-[A-F0-9]{12}$/,
);

assert.match(fixture.code, /^[a-f0-9]{32}$/);

console.log("FIXTURE_PAID_MEMBERSHIP=PASS");

const claimBody = {
  orderPublicId: fixture.orderPublicId,
  email: fixture.email,
  challengeId: fixture.challengeId,
  code: fixture.code,
};

function claim(body, origin = BASE) {
  return call("/api/nft/buyer/claim", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const crossOrigin = await claim(
  claimBody,
  "https://untrusted.example"
);

assert.equal(crossOrigin.status, 403);

console.log("E2E_CROSS_ORIGIN_BLOCKED=PASS");

const wrong = await claim({
  ...claimBody,
  code: "0".repeat(32),
});

assert.equal(wrong.status, 403);

console.log("E2E_INVALID_CODE_BLOCKED=PASS");

const results = await Promise.all(
  Array.from({ length: 3 }, () =>
    claim(claimBody)
  )
);

const successes = results.filter(
  response => response.status === 200
);

if (successes.length !== 1) {
  const diagnosticResponse = await call(
    "/__fixture/inspect",
    {
      method: "POST",
      headers: {
        "X-OriginX-Fixture-Key": KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        membershipId: fixture.membershipId,
      }),
    },
  );

  const diagnostic = diagnosticResponse.ok
    ? await diagnosticResponse.json()
    : {
        inspectionStatus: diagnosticResponse.status,
      };

  console.log(
    "E2E_CLAIM_HTTP_STATUSES=" +
    results.map(r => r.status).join(",")
  );

  console.log(
    "E2E_DIAGNOSTIC=" +
    JSON.stringify(diagnostic)
  );

  console.log("E2E_CLAIM_TOKEN_LOGGED=NO");
}

assert.equal(successes.length, 1);

const grant = await successes[0].json();

assert.match(
  grant.claimToken,
  /^0x[a-f0-9]{64}$/,
);

assert.ok(
  Date.parse(grant.claimExpiresAt) > Date.now()
);

console.log("E2E_CONCURRENT_SINGLE_CLAIM=PASS");

const replay = await claim(claimBody);

assert.notEqual(replay.status, 200);

console.log("E2E_EMAIL_PROOF_REPLAY_BLOCKED=PASS");

const inspection = await call(
  "/__fixture/inspect",
  {
    method: "POST",
    headers: {
      "X-OriginX-Fixture-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      membershipId: fixture.membershipId,
    }),
  },
);

assert.equal(inspection.status, 200);

const state = await inspection.json();

assert.equal(state.issuedGrants, 1);
assert.equal(state.totalGrants, 1);
assert.equal(
  state.mintJobStatus,
  "AWAITING_WALLET"
);

console.log("E2E_SQLITE_SINGLE_GRANT=PASS");
console.log("E2E_MINT_JOB_UNCHANGED=PASS");
console.log("REAL_PAYMENT=NO");
console.log("REAL_EMAIL=NO");
console.log("REAL_MINT=NO");
console.log("NFT_CLOUDFLARE_5I_10_E2E=PASS");
