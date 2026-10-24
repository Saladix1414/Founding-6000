import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";

import {
  requestBuyerEmailVerification,
  reserveBuyerEmailActor,
} from "../../../cloudflare/nftBuyerEmailRequest.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }
      const stmt = db.prepare(query);
      const rows = /^\s*(SELECT|WITH|PRAGMA)/i.test(query)
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

const now = Date.parse("2026-10-23T15:00:00Z");
const stamp = new Date(now).toISOString();
const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const publicOrder = "F6K-ABCDEF333333";
const actorHash = "a".repeat(64);

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email,
    normalized_email, reference_price_usd,
    status, created_at, updated_at
  ) VALUES (?, ?, 'test',
    'buyer@example.org', 'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, publicOrder, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 41, 1, 1,
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
    serial_number, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 41, 'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(),
  membershipId,
  orderId,
  stamp,
  stamp,
);

let sends = 0;
let lastMembershipId = null;

const mockDeliver = async ({ membershipId: id }) => {
  sends++;
  lastMembershipId = id;
  return { accepted: true };
};

const request = (
  orderPublicId,
  email,
  overrides = {},
) => requestBuyerEmailVerification({
  storage,
  orderPublicId,
  email,
  actorHash,
  now,
  deliver: mockDeliver,
  ...overrides,
});

const unknown = await request(
  "F6K-000000000001",
  "buyer@example.org",
);

const wrongEmail = await request(
  publicOrder,
  "attacker@example.org",
);

const valid = await request(
  publicOrder,
  "buyer@example.org",
);

assert.deepEqual(unknown, wrongEmail);
assert.deepEqual(wrongEmail, valid);
assert.equal(sends, 1);
assert.equal(lastMembershipId, membershipId);

console.log("UNIFORM_PUBLIC_RESPONSE=PASS");
console.log("UNKNOWN_ORDER_NO_EMAIL_SENT=PASS");
console.log("CORRECT_ORDER_INTERNAL_DELIVERY=PASS");

let failedSends = 0;
const providerError = await request(
  publicOrder,
  "buyer@example.org",
  {
    deliver: async () => {
      failedSends++;
      throw new Error("SECRET_PROVIDER_ERROR");
    },
  },
);

assert.deepEqual(providerError, valid);
assert.equal(failedSends, 1);

console.log("PROVIDER_ERROR_NOT_EXPOSED=PASS");

const last = await request(
  publicOrder,
  "buyer@example.org",
);

assert.deepEqual(last, valid);
assert.equal(sends, 2);

const blocked = await request(
  publicOrder,
  "buyer@example.org",
);

assert.deepEqual(blocked, valid);
assert.equal(sends, 2);

console.log("ACTOR_FIVE_PER_HOUR_LIMIT=PASS");

const counter = db.prepare(`
  SELECT request_count AS count
  FROM nft_email_actor_limits
  WHERE actor_hash = ?
`).get(actorHash);

assert.equal(counter.count, 5);
console.log("UNKNOWN_ORDER_COUNTS_TOWARD_LIMIT=PASS");

const nextHour = await request(
  publicOrder,
  "buyer@example.org",
  {
    now: now + 3600000,
  },
);

assert.deepEqual(nextHour, valid);
assert.equal(sends, 3);

console.log("ACTOR_NEXT_HOUR_RECOVERY=PASS");

const another = await request(
  publicOrder,
  "buyer@example.org",
  {
    actorHash: "b".repeat(64),
  },
);

assert.deepEqual(another, valid);
assert.equal(sends, 4);

console.log("ACTOR_ISOLATION=PASS");

assert.throws(
  () => reserveBuyerEmailActor({
    storage,
    actorHash: "attacker-supplied-ip",
    now,
  }),
  /NFT_BUYER_ACTOR_INVALID/,
);

console.log("INVALID_ACTOR_BLOCKED=PASS");

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM nft_claim_grants
  `).get().count,
  0,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM nft_mint_jobs
    WHERE status = 'READY'
  `).get().count,
  0,
);

console.log("REQUEST_NO_CLAIM_OR_MINT=PASS");
console.log("NFT_BUYER_EMAIL_REQUEST_TEST=PASS");
console.log("NO PUBLIC ENDPOINT.");
console.log("NO REAL EMAIL.");
