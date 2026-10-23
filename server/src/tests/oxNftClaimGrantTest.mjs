import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  issueBuyerEmailCode,
  verifyBuyerEmailCode,
} from "../../../cloudflare/nftBuyerEmailAuth.mjs";
import {
  issueNftClaimGrant,
  consumeNftClaimGrant,
} from "../../../cloudflare/nftClaimGrant.mjs";

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
      const rows = read ? stmt.all(...args) : (stmt.run(...args), []);
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

const memberId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const now = Date.now();
const date = new Date(now).toISOString();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email, normalized_email,
    reference_price_usd, status, created_at, updated_at
  ) VALUES (?, ?, 'test-phase', 'buyer@example.org',
    'buyer@example.org', 50, 'CREATED', ?, ?)
`).run(orderId, "F6K-222222222222", date, date);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 2, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(memberId, `mem_${crypto.randomUUID()}`,
       orderId, date, date);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id, serial_number,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, 2, 'AWAITING_WALLET', ?, ?)
`).run(crypto.randomUUID(), memberId, orderId, date, date);

const issue = (
  membershipId = memberId,
  time = now,
  emailChallengeId,
) => issueNftClaimGrant({
  storage, membershipId, emailChallengeId, now: time,
});

function verifiedEmail() {
  const challenge = issueBuyerEmailCode({
    storage, membershipId: memberId, now,
  });
  const result = verifyBuyerEmailCode({
    storage,
    membershipId: memberId,
    challengeId: challenge.challengeId,
    code: challenge.code,
    now: now + 1000,
  });
  assert.equal(result.verified, true);
  return challenge.challengeId;
}

const consume = (token, membershipId = memberId, time = now) =>
  consumeNftClaimGrant({
    storage, membershipId, token, now: time,
  });

assert.throws(issue, /NOT_ELIGIBLE/);
console.log("UNPAID_CLAIM_BLOCKED=PASS");

db.prepare(`
  UPDATE founding_orders SET status = 'PAID'
  WHERE id = ?
`).run(orderId);

assert.throws(
  () => issue(),
  /NFT_VERIFIED_EMAIL_REQUIRED/,
);
console.log("CLAIM_WITHOUT_EMAIL_BLOCKED=PASS");

const firstEmail = verifiedEmail();
const first = issue(memberId, now + 1000, firstEmail);

assert.throws(
  () => issue(memberId, now + 1000, firstEmail),
  /NFT_VERIFIED_EMAIL_REQUIRED/,
);
console.log("EMAIL_PROOF_REPLAY_BLOCKED=PASS");

/*
 * Fail claim insertion after email proof consumption:
 * SQLite must restore the verified email proof.
 */
const rollbackEmail = verifiedEmail();

db.exec(`
  CREATE TRIGGER nft_email_claim_fail
  BEFORE INSERT ON nft_claim_grants
  BEGIN
    SELECT RAISE(ABORT, 'NFT_TEST_CLAIM_INSERT_FAILURE');
  END;
`);

try {
  assert.throws(
    () => issue(memberId, now + 1000, rollbackEmail),
    /NFT_TEST_CLAIM_INSERT_FAILURE/,
  );
} finally {
  db.exec("DROP TRIGGER nft_email_claim_fail");
}

assert.equal(
  db.prepare(`
    SELECT status FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(rollbackEmail).status,
  "VERIFIED",
);

console.log("EMAIL_CLAIM_ATOMIC_ROLLBACK=PASS");

const second = issue(memberId, now + 1000, rollbackEmail);

assert.equal(
  db.prepare(`
    SELECT status FROM nft_buyer_email_codes
    WHERE id = ?
  `).get(rollbackEmail).status,
  "REVOKED",
);
console.log("VERIFIED_EMAIL_CONSUMED=PASS");

assert.notEqual(first.token, second.token);
assert.throws(() => consume(first.token), /NOT_VALID/);
console.log("SUPERSEDED_CLAIM_BLOCKED=PASS");

assert.throws(
  () => consume(second.token, crypto.randomUUID()),
  /NOT_ELIGIBLE/,
);
console.log("CROSS_MEMBERSHIP_CLAIM_BLOCKED=PASS");

assert.throws(
  () => consume("0x" + "a".repeat(64)),
  /NOT_VALID/,
);
console.log("INVALID_CLAIM_BLOCKED=PASS");

assert.throws(
  () => consume(second.token, memberId,
    Date.parse(second.expiresAt)),
  /NOT_VALID/,
);
console.log("EXPIRED_CLAIM_BLOCKED=PASS");

assert.deepEqual(
  consume(second.token),
  { consumed: true, membershipId: memberId },
);
assert.throws(
  () => consume(second.token),
  /NOT_VALID/,
);
console.log("CLAIM_REPLAY_BLOCKED=PASS");

const stored = db.prepare(`
  SELECT token_hash AS hash, status
  FROM nft_claim_grants
  WHERE status = 'CONSUMED'
`).get();

assert.equal(stored.status, "CONSUMED");
assert.notEqual(stored.hash, second.token);
assert.equal(
  db.prepare(`
    SELECT status FROM nft_mint_jobs
    WHERE membership_id = ?
  `).get(memberId).status,
  "AWAITING_WALLET",
);
console.log("TOKEN_HASH_ONLY=PASS");
console.log("CLAIM_DOES_NOT_AUTHORIZE_MINT=PASS");
console.log("NFT_CLAIM_GRANT_TEST=PASS");
