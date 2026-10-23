import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  issueBuyerEmailCode,
  verifyBuyerEmailCode,
} from "../../../cloudflare/nftBuyerEmailAuth.mjs";

const db = new DatabaseSync(":memory:");
const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }
      const statement = db.prepare(query);
      const read = /^\s*(SELECT|WITH|PRAGMA)/i.test(query);
      const rows = read
        ? statement.all(...args)
        : (statement.run(...args), []);
      return { toArray: () => rows };
    },
  },
  transactionSync(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};

new CommerceCore(storage).initializeSchema();

const now = Date.now();
const stamp = new Date(now).toISOString();
const orderId = crypto.randomUUID();
const memberId = crypto.randomUUID();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email, normalized_email,
    reference_price_usd, status, created_at, updated_at
  ) VALUES (?, 'F6K-333333333333', 'test',
    'buyer@example.org', 'buyer@example.org',
    50, 'CREATED', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 3, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(memberId, `mem_${crypto.randomUUID()}`,
       orderId, stamp, stamp);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id, serial_number,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, 3, 'AWAITING_WALLET', ?, ?)
`).run(crypto.randomUUID(), memberId, orderId, stamp, stamp);

const issue = () => issueBuyerEmailCode({
  storage, membershipId: memberId, now,
});

const verify = (challenge, code, time = now + 1000) =>
  verifyBuyerEmailCode({
    storage, membershipId: memberId,
    challengeId: challenge.challengeId,
    code, now: time,
  });

assert.throws(issue, /NOT_ELIGIBLE/);
console.log("UNPAID_BUYER_BLOCKED=PASS");

db.prepare(`
  UPDATE founding_orders SET status = 'PAID'
  WHERE id = ?
`).run(orderId);


/*
 * Verify the exact 30-minute window.
 * Five incorrect attempts must lock a code.
 */
const lockedChallenge = issue();

assert.equal(
  Date.parse(lockedChallenge.expiresAt) - now,
  30 * 60 * 1000,
  "EMAIL_CODE_TTL_NOT_30_MINUTES",
);

console.log("EMAIL_CODE_30_MINUTES=PASS");

for (let attempt = 0; attempt < 5; attempt++) {
  assert.deepEqual(
    verify(lockedChallenge, "0".repeat(32)),
    { verified: false },
  );
}

assert.throws(
  () => verify(lockedChallenge, lockedChallenge.code),
  /BUYER_AUTH_LOCKED/,
);

const storedAttempts = db.prepare(`
  SELECT attempts
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(lockedChallenge.challengeId);

assert.equal(storedAttempts.attempts, 5);

console.log("EMAIL_CODE_FIVE_ATTEMPTS_LOCKED=PASS");

/*
 * A newly issued code supersedes the locked one
 * and starts with zero failed attempts.
 */
const recoveryChallenge = issue();

assert.notEqual(
  recoveryChallenge.code,
  lockedChallenge.code,
);

assert.deepEqual(
  verify(recoveryChallenge, recoveryChallenge.code),
  { verified: true, membershipId: memberId },
);

console.log("EMAIL_CODE_RECOVERY=PASS");

const first = issue();
const second = issue();

assert.notEqual(first.code, second.code);
assert.throws(
  () => verify(first, first.code),
  /UNAVAILABLE/,
);
console.log("OLD_EMAIL_CODE_REVOKED=PASS");

assert.deepEqual(
  verify(second, "0".repeat(32)),
  { verified: false },
);
console.log("WRONG_EMAIL_CODE_BLOCKED=PASS");

assert.throws(
  () => verify(second, second.code,
    Date.parse(second.expiresAt)),
  /UNAVAILABLE/,
);
console.log("EXPIRED_EMAIL_CODE_BLOCKED=PASS");

assert.deepEqual(
  verify(second, second.code),
  { verified: true, membershipId: memberId },
);

assert.throws(
  () => verify(second, second.code),
  /UNAVAILABLE/,
);
console.log("EMAIL_CODE_REPLAY_BLOCKED=PASS");

const row = db.prepare(`
  SELECT code_hash AS hash, status
  FROM nft_buyer_email_codes
  WHERE id = ?
`).get(second.challengeId);

assert.equal(row.status, "VERIFIED");
assert.notEqual(row.hash, second.code);

assert.equal(
  db.prepare(`
    SELECT status FROM nft_mint_jobs
    WHERE membership_id = ?
  `).get(memberId).status,
  "AWAITING_WALLET",
);

console.log("EMAIL_CODE_HASH_ONLY=PASS");
console.log("EMAIL_AUTH_NO_MINT_AUTHORITY=PASS");
console.log("NFT_BUYER_EMAIL_AUTH_TEST=PASS");
