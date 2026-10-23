import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  reserveBuyerEmailSend,
} from "../../../cloudflare/nftEmailRateLimit.mjs";

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

const membershipId = crypto.randomUUID();
const otherMembership = crypto.randomUUID();
const start = Date.parse("2026-10-23T12:00:00Z");

const reserve = (now, id = membershipId) =>
  reserveBuyerEmailSend({
    storage,
    membershipId: id,
    now,
  });

assert.equal(reserve(start).remaining, 2);

assert.throws(
  () => reserve(start + 1000),
  /NFT_EMAIL_COOLDOWN_ACTIVE/,
);

console.log("EMAIL_60_SECOND_COOLDOWN=PASS");

assert.equal(reserve(start + 60000).remaining, 1);
assert.equal(reserve(start + 120000).remaining, 0);

assert.throws(
  () => reserve(start + 180000),
  /NFT_EMAIL_HOURLY_LIMIT/,
);

console.log("EMAIL_THREE_PER_HOUR_LIMIT=PASS");

const stored = db.prepare(`
  SELECT request_count AS count
  FROM nft_email_rate_limits
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(stored.count, 3);
console.log("REJECTED_REQUEST_NOT_COUNTED=PASS");

assert.equal(
  reserve(start + 180000, otherMembership).reserved,
  true,
);

console.log("MEMBERSHIP_RATE_ISOLATION=PASS");

assert.equal(
  reserve(start + 3600000).reserved,
  true,
);

console.log("EMAIL_NEXT_HOUR_RECOVERY=PASS");

assert.throws(
  () => reserve(start, ""),
  /NFT_EMAIL_RATE_INVALID_INPUT/,
);

console.log("INVALID_MEMBERSHIP_BLOCKED=PASS");
console.log("NFT_EMAIL_RATE_LIMIT_TEST=PASS");
console.log("NO EMAIL SENT.");
