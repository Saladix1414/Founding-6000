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


/*
 * PHASE 5I.8 — PART 2
 *
 * This runs real Node SQLite transactions against
 * the actual domain and Durable Object handler.
 *
 * Promise.all exercises overlapping asynchronous
 * requests within one Node process. It does NOT
 * simulate separate Cloudflare isolates.
 */

const concurrentMember = createMembership();
const concurrentCode = issue(concurrentMember);

const simultaneous = await Promise.all(
  Array.from({ length: 8 }, (_, index) =>
    claim(concurrentMember, concurrentCode, {
      actorHash: index.toString(16).repeat(64),
    })
  ),
);

const statuses = simultaneous.map(
  response => response.status,
);

assert.equal(
  statuses.filter(status => status === 200).length,
  1,
);

assert.equal(
  statuses.filter(status => status === 403).length,
  7,
);

const issued = db.prepare(`
  SELECT status, token_hash
  FROM nft_claim_grants
  WHERE membership_id = ?
`).all(concurrentMember.membershipId);

assert.equal(issued.length, 1);
assert.equal(issued[0].status, "ISSUED");

const successIndex = statuses.indexOf(200);

const credential = await simultaneous[
  successIndex
].json();

assert.match(
  credential.claimToken,
  /^0x[a-f0-9]{64}$/,
);

assert.equal(
  issued[0].token_hash,
  sha256(credential.claimToken),
);

const consumedEmail = db.prepare(`
  SELECT status
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(concurrentCode.challengeId);

assert.equal(consumedEmail.status, "REVOKED");

console.log("CONCURRENT_REQUESTS=8");
console.log("CONCURRENT_SUCCESS_COUNT=1");
console.log("CONCURRENT_DUPLICATE_GRANTS=0");
console.log("CONCURRENT_EMAIL_PROOF_CONSUMED=PASS");

/*
 * Inject a database failure after email
 * verification but before grant insertion.
 *
 * The entire domain transaction must roll back.
 * Actor-rate reservations are separate and
 * intentionally stay committed.
 */
const failureMember = createMembership();
const failureCode = issue(failureMember);

db.exec(`
  CREATE TRIGGER reject_nft_claim_insert
  BEFORE INSERT ON nft_claim_grants
  BEGIN
    SELECT RAISE(
      ABORT,
      'SIMULATED_SQLITE_WRITE_FAILURE'
    );
  END;
`);

let failed;

try {
  failed = await claim(
    failureMember,
    failureCode,
    { actorHash: "a".repeat(64) },
  );
} finally {
  db.exec("DROP TRIGGER reject_nft_claim_insert");
}

assert.equal(failed.status, 403);

const afterFailure = db.prepare(`
  SELECT status, attempts
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(failureCode.challengeId);

assert.equal(afterFailure.status, "PENDING");
assert.equal(afterFailure.attempts, 0);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_claim_grants
    WHERE membership_id = ?
  `).get(failureMember.membershipId).total,
  0,
);

console.log("SQLITE_WRITE_FAILURE_REDACTED=PASS");
console.log("SQLITE_EMAIL_PROOF_ROLLBACK=PASS");
console.log("SQLITE_PARTIAL_GRANT=NONE");

/*
 * Recovery must work once the write failure
 * is removed, without creating duplicate grants.
 */
const recovered = await claim(
  failureMember,
  failureCode,
  { actorHash: "b".repeat(64) },
);

assert.equal(recovered.status, 200);

const recoveredCredential = await recovered.json();

assert.match(
  recoveredCredential.claimToken,
  /^0x[a-f0-9]{64}$/,
);

const recoveredGrants = db.prepare(`
  SELECT status, token_hash
  FROM nft_claim_grants
  WHERE membership_id = ?
`).all(failureMember.membershipId);

assert.equal(recoveredGrants.length, 1);
assert.equal(recoveredGrants[0].status, "ISSUED");

assert.equal(
  recoveredGrants[0].token_hash,
  sha256(recoveredCredential.claimToken),
);

const recoveryReplay = await claim(
  failureMember,
  failureCode,
  { actorHash: "c".repeat(64) },
);

assert.equal(recoveryReplay.status, 403);

console.log("SQLITE_FAILURE_RECOVERY=PASS");
console.log("SQLITE_RECOVERY_GRANT_ONCE=PASS");
console.log("SQLITE_RECOVERY_REPLAY_BLOCKED=PASS");

/*
 * Eight parallel invalid submissions from
 * one actor. The fifth consumes the hourly
 * request allowance; the next three must
 * be rejected by the rate limiter.
 */
const limitMember = createMembership();
const limitCode = issue(limitMember);

const limited = await Promise.all(
  Array.from({ length: 8 }, () =>
    claim(limitMember, limitCode, {
      code: "0".repeat(32),
      actorHash: "d".repeat(64),
    })
  ),
);

const limits = limited.map(response => response.status);

assert.equal(
  limits.filter(status => status === 403).length,
  5,
);

assert.equal(
  limits.filter(status => status === 429).length,
  3,
);

assert.equal(
  db.prepare(`
    SELECT attempts
    FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(limitCode.challengeId).attempts,
  5,
);

console.log("CONCURRENT_ACTOR_LIMIT=PASS");
console.log("CONCURRENT_FIVE_ATTEMPT_LOCK=PASS");

/*
 * No test must change a mint job, membership
 * entitlement or on-chain state.
 */
for (const member of [
  concurrentMember,
  failureMember,
  limitMember,
]) {
  const mintJob = db.prepare(`
    SELECT status
    FROM nft_mint_jobs
    WHERE membership_id = ?
  `).get(member.membershipId);

  assert.equal(
    mintJob.status,
    "AWAITING_WALLET",
  );
}

console.log("MINT_JOBS_UNCHANGED=PASS");

db.close();

console.log("NFT_CLOUDFLARE_5I_8_PART_2_TEST=PASS");
console.log("REAL_CLOUDFLARE_RUNTIME=NO");
console.log("REAL_EMAIL_SENT=NO");
console.log("BLOCKCHAIN_TRANSACTION=NO");
console.log("REAL_MINT=NO");
