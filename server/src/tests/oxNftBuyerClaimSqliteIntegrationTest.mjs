import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  issueBuyerEmailCode,
} from "../../../cloudflare/nftBuyerEmailAuth.mjs";

import {
  handleInternalBuyerClaim,
} from "../../../cloudflare/nftBuyerClaimDoBridge.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const statement = db.prepare(query);
      const isRead = /^\s*(SELECT|WITH|PRAGMA)/i.test(query);

      const rows = isRead
        ? statement.all(...args)
        : (statement.run(...args), []);

      return { toArray: () => rows };
    },
  },

  transactionSync(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

new CommerceCore(storage).initializeSchema();

const secret = "originx-test-only-secret-".repeat(3);

const env = {
  NFT_BUYER_CLAIM_ENABLED: "true",
  NFT_INTERNAL_SERVICE_KEY: secret,
};

let counter = 0;

function createMembership() {
  counter += 1;

  const suffix = counter.toString(16)
    .toUpperCase()
    .padStart(12, "0");

  const orderPublicId = `F6K-${suffix}`;
  const orderId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const stamp = new Date().toISOString();
  const serial = counter + 100;

  db.prepare(`
    INSERT INTO founding_orders (
      id, public_id, phase_id,
      email, normalized_email,
      reference_price_usd,
      status, created_at, updated_at
    )
    VALUES (?, ?, 'test-phase',
      'buyer@example.org',
      'buyer@example.org',
      50, 'PAID', ?, ?)
  `).run(orderId, orderPublicId, stamp, stamp);

  db.prepare(`
    INSERT INTO founding_memberships (
      id, public_id, order_id,
      serial_number, founding_member,
      genesis_member, status,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, 1,
      'ACTIVATION_PENDING', ?, ?)
  `).run(
    membershipId,
    `mem_${crypto.randomUUID()}`,
    orderId,
    serial,
    stamp,
    stamp,
  );

  db.prepare(`
    INSERT INTO nft_mint_jobs (
      id, membership_id, order_id,
      serial_number, status,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'AWAITING_WALLET',
      ?, ?)
  `).run(
    crypto.randomUUID(),
    membershipId,
    orderId,
    serial,
    stamp,
    stamp,
  );

  return {
    orderPublicId,
    membershipId,
    email: "buyer@example.org",
  };
}

function issue(member) {
  return issueBuyerEmailCode({
    storage,
    membershipId: member.membershipId,
  });
}

const actor = "a".repeat(64);

function makeRequest(member, challenge, {
  code = challenge.code,
  actorHash = actor,
  key = secret,
} = {}) {
  return new Request(
    "https://founding-core.internal/internal/nft/buyer/claim",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OriginX-Internal-Key": key,
      },
      body: JSON.stringify({
        orderPublicId: member.orderPublicId,
        email: member.email,
        challengeId: challenge.challengeId,
        code,
        actorHash,
      }),
    },
  );
}

const claim = (member, challenge, opts = {}) =>
  handleInternalBuyerClaim({
    request: makeRequest(member, challenge, opts),
    storage,
    env,
  });

const one = createMembership();
const firstCode = issue(one);

const wrong = await claim(one, firstCode, {
  code: "0".repeat(32),
});

assert.equal(wrong.status, 403);

const wrongAttempts = db.prepare(`
  SELECT attempts
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(firstCode.challengeId);

assert.equal(wrongAttempts.attempts, 1);

console.log("SQLITE_WRONG_ATTEMPT_PERSISTED=PASS");

const good = await claim(one, firstCode);

assert.equal(good.status, 200);
assert.equal(good.headers.get("Cache-Control"), "no-store");

const grant = await good.json();

assert.match(grant.claimToken, /^0x[a-f0-9]{64}$/);

const stored = db.prepare(`
  SELECT status, token_hash
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(one.membershipId);

assert.equal(stored.status, "ISSUED");
assert.equal(stored.token_hash, sha256(grant.claimToken));

console.log("SQLITE_VERIFIED_CLAIM_ISSUED=PASS");
console.log("SQLITE_ONLY_CLAIM_HASH_STORED=PASS");

const replay = await claim(one, firstCode);

assert.equal(replay.status, 403);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_claim_grants
    WHERE membership_id = ?
  `).get(one.membershipId).total,
  1,
);

console.log("SQLITE_EMAIL_PROOF_REPLAY_BLOCKED=PASS");

const two = createMembership();
const secondCode = issue(two);

const attemptsActor = "b".repeat(64);

for (let index = 0; index < 5; index++) {
  const response = await claim(two, secondCode, {
    code: "0".repeat(32),
    actorHash: attemptsActor,
  });

  assert.equal(response.status, 403);
}

const lockedCode = await claim(two, secondCode, {
  actorHash: "c".repeat(64),
});

assert.equal(lockedCode.status, 403);

assert.equal(
  db.prepare(`
    SELECT attempts
    FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(secondCode.challengeId).attempts,
  5,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_claim_grants
    WHERE membership_id = ?
  `).get(two.membershipId).total,
  0,
);

console.log("SQLITE_FIVE_ATTEMPT_LOCK=PASS");
console.log("SQLITE_LOCK_CANNOT_ISSUE_GRANT=PASS");

const three = createMembership();
const thirdCode = issue(three);
const quotaActor = "d".repeat(64);

for (let index = 0; index < 5; index++) {
  await claim(three, thirdCode, {
    code: "0".repeat(32),
    actorHash: quotaActor,
  });
}

const quotaBlocked = await claim(three, thirdCode, {
  actorHash: quotaActor,
});

assert.equal(quotaBlocked.status, 429);

const quota = db.prepare(`
  SELECT request_count
  FROM nft_email_actor_limits
  WHERE actor_hash = ?
  ORDER BY bucket_start DESC
  LIMIT 1
`).get(quotaActor);

assert.equal(quota.request_count, 5);

console.log("SQLITE_ACTOR_RATE_LIMIT=PASS");

for (const member of [one, two, three]) {
  const job = db.prepare(`
    SELECT status
    FROM nft_mint_jobs
    WHERE membership_id = ?
  `).get(member.membershipId);

  assert.equal(job.status, "AWAITING_WALLET");
}

console.log("SQLITE_MINT_JOBS_UNCHANGED=PASS");

const unauthorized = await handleInternalBuyerClaim({
  request: makeRequest(one, firstCode, {
    key: "invalid-internal-key",
  }),
  storage,
  env,
});

assert.equal(unauthorized.status, 503);

console.log("SQLITE_INTERNAL_KEY_REQUIRED=PASS");

console.log("NFT_CLOUDFLARE_5I_8_SQLITE_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
console.log("REAL_MINT=NO");
console.log("BLOCKCHAIN_TRANSACTION=NO");

db.close();
