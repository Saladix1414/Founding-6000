import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";
import {
  recoverStaleBuyerEmailDeliveries,
} from "../../../cloudflare/nftEmailRecovery.mjs";

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
      const rows = read
        ? stmt.all(...args)
        : (stmt.run(...args), []);
      return { toArray: () => rows };
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

const memberId = crypto.randomUUID();
const now = Date.parse("2026-10-23T15:00:00Z");

function fixture(ageMinutes, deliveryStatus = "PREPARED") {
  const challengeId = crypto.randomUUID();
  const preparedAt = new Date(
    now - ageMinutes * 60000,
  ).toISOString();

  db.prepare(`
    INSERT INTO nft_buyer_email_codes (
      id, membership_id, code_hash, status,
      attempts, expires_at, created_at,
      verified_at
    ) VALUES (
      ?, ?, ?, 'PENDING', 0, ?, ?, NULL
    )
  `).run(
    challengeId,
    memberId,
    "mock-hash-not-a-code",
    new Date(now + 600000).toISOString(),
    preparedAt,
  );

  db.prepare(`
    INSERT INTO nft_email_deliveries (
      challenge_id, membership_id, status,
      provider_message_id, prepared_at,
      accepted_at, failed_at
    ) VALUES (?, ?, ?, NULL, ?, NULL, NULL)
  `).run(
    challengeId,
    memberId,
    deliveryStatus,
    preparedAt,
  );

  return challengeId;
}

function state(id) {
  return {
    code: db.prepare(`
      SELECT status
      FROM nft_buyer_email_codes
      WHERE id = ?
    `).get(id).status,

    delivery: db.prepare(`
      SELECT status
      FROM nft_email_deliveries
      WHERE challenge_id = ?
    `).get(id).status,
  };
}

const stale = fixture(6);
const recent = fixture(2);
const accepted = fixture(10, "ACCEPTED");
const boundary = fixture(5);

const result = recoverStaleBuyerEmailDeliveries({
  storage,
  now,
});

assert.equal(result.recovered, 2);
assert.equal(result.emailsResent, 0);

assert.deepEqual(state(stale), {
  code: "REVOKED",
  delivery: "FAILED",
});

assert.deepEqual(state(boundary), {
  code: "REVOKED",
  delivery: "FAILED",
});

console.log("STALE_DELIVERY_RECOVERED=PASS");
console.log("RECOVERY_FIVE_MIN_BOUNDARY=PASS");

assert.deepEqual(state(recent), {
  code: "PENDING",
  delivery: "PREPARED",
});

console.log("RECENT_DELIVERY_PRESERVED=PASS");

assert.deepEqual(state(accepted), {
  code: "PENDING",
  delivery: "ACCEPTED",
});

console.log("ACCEPTED_DELIVERY_UNCHANGED=PASS");

const repeat = recoverStaleBuyerEmailDeliveries({
  storage,
  now,
});

assert.equal(repeat.recovered, 0);
console.log("RECOVERY_IDEMPOTENT=PASS");

/*
 * A forced database failure must roll back
 * both the code revocation and audit changes.
 */
const rollback = fixture(8);

db.exec(`
  CREATE TRIGGER nft_recovery_fail_test
  BEFORE UPDATE OF status ON nft_email_deliveries
  WHEN NEW.status = 'FAILED'
  BEGIN
    SELECT RAISE(
      ABORT,
      'NFT_TEST_RECOVERY_FAILURE'
    );
  END;
`);

try {
  assert.throws(
    () => recoverStaleBuyerEmailDeliveries({
      storage,
      now,
    }),
    /NFT_TEST_RECOVERY_FAILURE/,
  );
} finally {
  db.exec("DROP TRIGGER nft_recovery_fail_test");
}

assert.deepEqual(state(rollback), {
  code: "PENDING",
  delivery: "PREPARED",
});

console.log("RECOVERY_ATOMIC_ROLLBACK=PASS");

assert.throws(
  () => recoverStaleBuyerEmailDeliveries({
    storage,
    now,
    limit: 101,
  }),
  /INVALID_INPUT/,
);

console.log("RECOVERY_BATCH_BOUNDED=PASS");
console.log("NFT_EMAIL_RECOVERY_TEST=PASS");
console.log("NO REAL EMAIL.");
console.log("NO PUBLIC ENDPOINT.");
