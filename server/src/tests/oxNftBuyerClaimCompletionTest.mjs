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
  completeBuyerEmailClaim,
  completeBuyerEmailClaimSafely,
} from "../../../cloudflare/nftBuyerClaimCompletion.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const stmt = db.prepare(query);
      const read = /^\s*(SELECT|WITH|PRAGMA)/i.test(query);

      // Execute writes immediately, matching
      // Cloudflare Durable Object SQLite semantics.
      const rows = read
        ? stmt.all(...args)
        : (stmt.run(...args), []);

      return {
        toArray: () => rows,
      };
    },
  },

  transactionSync(fn) {
    db.exec("BEGIN IMMEDIATE");

    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

new CommerceCore(storage).initializeSchema();

const now = Date.parse("2026-10-24T12:00:00Z");
const stamp = new Date(now).toISOString();

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const publicOrder = "F6K-ABCDEF556677";

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
`).run(orderId, publicOrder, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member,
    status, created_at, updated_at
  )
  VALUES (?, ?, ?, 51, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(
  membershipId,
  `mem_${crypto.randomUUID()}`,
  orderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id,
    serial_number, status, created_at, updated_at
  )
  VALUES (?, ?, ?, 51, 'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(),
  membershipId,
  orderId,
  stamp,
  stamp,
);

const issue = () => issueBuyerEmailCode({
  storage,
  membershipId,
  now,
});

const complete = (challenge, overrides = {}) =>
  completeBuyerEmailClaim({
    storage,
    orderPublicId: publicOrder,
    email: "buyer@example.org",
    challengeId: challenge.challengeId,
    code: challenge.code,
    now: now + 1000,
    ...overrides,
  });

const first = issue();

assert.throws(
  () => complete(first, {
    email: "attacker@example.org",
  }),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);

console.log("WRONG_BUYER_EMAIL_BLOCKED=PASS");

assert.throws(
  () => complete(first, {
    code: "0".repeat(32),
  }),
  /NFT_BUYER_CLAIM_UNAVAILABLE/,
);

assert.equal(
  db.prepare(`
    SELECT attempts
    FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(first.challengeId).attempts,
  1,
);

console.log("WRONG_CODE_ATTEMPT_PERSISTED=PASS");

const grant = complete(first);

assert.equal(grant.verified, true);
assert.match(grant.claimToken, /^0x[a-f0-9]{64}$/);

assert.equal(
  Date.parse(grant.claimExpiresAt) - (now + 1000),
  15 * 60 * 1000,
);

console.log("EMAIL_VERIFIED_CLAIM_ISSUED=PASS");

const stored = db.prepare(`
  SELECT status, token_hash AS hash
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(stored.status, "ISSUED");
assert.equal(stored.hash, sha256(grant.claimToken));

console.log("CLAIM_TOKEN_HASH_ONLY=PASS");

assert.throws(
  () => complete(first),
  /BUYER_AUTH_UNAVAILABLE/,
);

console.log("EMAIL_PROOF_REPLAY_BLOCKED=PASS");

const second = issue();

db.exec(`
  CREATE TRIGGER nft_claim_atomic_failure
  BEFORE INSERT ON nft_claim_grants
  BEGIN
    SELECT RAISE(
      ABORT,
      'NFT_TEST_CLAIM_WRITE_FAILED'
    );
  END;
`);

try {
  assert.throws(
    () => complete(second),
    /NFT_TEST_CLAIM_WRITE_FAILED/,
  );
} finally {
  db.exec("DROP TRIGGER nft_claim_atomic_failure");
}

const restored = db.prepare(`
  SELECT status, attempts
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(second.challengeId);

assert.equal(restored.status, "PENDING");
assert.equal(restored.attempts, 0);

console.log("EMAIL_TO_CLAIM_ATOMIC_ROLLBACK=PASS");

const recovered = complete(second);

assert.equal(recovered.verified, true);
assert.notEqual(recovered.claimToken, grant.claimToken);

const claims = db.prepare(`
  SELECT status
  FROM nft_claim_grants
  WHERE membership_id = ?
  ORDER BY created_at ASC
`).all(membershipId);

assert.equal(claims.length, 2);
assert.equal(
  claims.filter(row => row.status === "ISSUED").length,
  1,
);

console.log("CLAIM_FAILURE_RECOVERY=PASS");
console.log("SUPERSEDED_CLAIM_REVOKED=PASS");

const job = db.prepare(`
  SELECT status
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(job.status, "AWAITING_WALLET");

console.log("EMAIL_CLAIM_NO_MINT_AUTHORITY=PASS");

/*
 * Five incorrect attempts must remain committed
 * even when the safe boundary rejects them.
 */
const locked = issue();

const safeComplete = (challenge, overrides = {}) =>
  completeBuyerEmailClaimSafely({
    storage,
    orderPublicId: publicOrder,
    email: "buyer@example.org",
    challengeId: challenge.challengeId,
    code: challenge.code,
    now: now + 1000,
    ...overrides,
  });

const grantsBeforeLock = db.prepare(`
  SELECT COUNT(*) AS total
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(membershipId).total;

for (let attempt = 1; attempt <= 5; attempt++) {
  assert.throws(
    () => safeComplete(locked, {
      code: "0".repeat(32),
    }),
    error => {
      assert.equal(
        error.message,
        "NFT_BUYER_CLAIM_UNAVAILABLE",
      );
      return true;
    },
  );
}

assert.equal(
  db.prepare(`
    SELECT attempts
    FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(locked.challengeId).attempts,
  5,
);

console.log("BUYER_CLAIM_FIVE_ATTEMPTS_PERSISTED=PASS");

assert.throws(
  () => safeComplete(locked),
  /NFT_BUYER_CLAIM_UNAVAILABLE/,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_claim_grants
    WHERE membership_id = ?
  `).get(membershipId).total,
  grantsBeforeLock,
);

console.log("BUYER_CLAIM_CORRECT_CODE_AFTER_LOCK_BLOCKED=PASS");
console.log("BUYER_CLAIM_LOCK_NO_GRANT_ISSUED=PASS");

/*
 * Internal order information and low-level
 * errors must not escape the safe boundary.
 */
for (const override of [
  { email: "attacker@example.org" },
  { orderPublicId: "F6K-000000000000" },
  { challengeId: crypto.randomUUID() },
  { code: "not-a-code" },
]) {
  assert.throws(
    () => safeComplete(locked, override),
    error => {
      assert.equal(
        error.message,
        "NFT_BUYER_CLAIM_UNAVAILABLE",
      );
      return true;
    },
  );
}

console.log("BUYER_CLAIM_ERRORS_REDACTED=PASS");

/*
 * A newly issued code may be used after the
 * previous challenge was locked.
 */
const fresh = issue();

const freshGrant = safeComplete(fresh);

assert.equal(freshGrant.verified, true);
assert.match(
  freshGrant.claimToken,
  /^0x[a-f0-9]{64}$/,
);

assert.throws(
  () => safeComplete(fresh),
  /NFT_BUYER_CLAIM_UNAVAILABLE/,
);

console.log("BUYER_CLAIM_NEW_CODE_RECOVERY=PASS");
console.log("BUYER_CLAIM_NEW_CODE_REPLAY_BLOCKED=PASS");

assert.equal(
  db.prepare(`
    SELECT status
    FROM nft_mint_jobs
    WHERE membership_id = ?
  `).get(membershipId).status,
  "AWAITING_WALLET",
);

console.log("BUYER_CLAIM_SAFE_BOUNDARY_NO_MINT=PASS");

console.log("NFT_BUYER_CLAIM_COMPLETION_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
console.log("PUBLIC_ENDPOINT=NO");
