import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  resolveBuyerOrderForEmail,
  buyerEmailRequestAcknowledgement,
} from "../../../cloudflare/nftBuyerOrderResolver.mjs";

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

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const mintJobId = crypto.randomUUID();
const stamp = new Date().toISOString();
const publicOrder = "F6K-ABCDEF123456";

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email,
    normalized_email, reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (
    ?, ?, 'test', 'buyer@example.org',
    'buyer@example.org', 50, 'CREATED', ?, ?
  )
`).run(orderId, publicOrder, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  )
  VALUES (
    ?, ?, ?, 31, 1, 1,
    'ACTIVATION_PENDING', ?, ?
  )
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
  )
  VALUES (
    ?, ?, ?, 31, 'AWAITING_WALLET', ?, ?
  )
`).run(
  mintJobId,
  membershipId,
  orderId,
  stamp,
  stamp,
);

const resolve = (
  orderPublicId = publicOrder,
  email = "buyer@example.org",
) => resolveBuyerOrderForEmail({
  storage,
  orderPublicId,
  email,
});

assert.throws(
  () => resolve(),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);
console.log("UNPAID_ORDER_NOT_RESOLVED=PASS");

db.prepare(`
  UPDATE founding_orders
  SET status = 'PAID'
  WHERE id = ?
`).run(orderId);

const valid = resolve(
  publicOrder,
  "  BUYER@EXAMPLE.ORG  ",
);

assert.equal(valid.membershipId, membershipId);
assert.equal(valid.registeredEmail, "buyer@example.org");
assert.equal(valid.mintJobId, mintJobId);
assert.equal(Object.isFrozen(valid), true);

console.log("PAID_BUYER_ORDER_RESOLVED=PASS");
console.log("REGISTERED_EMAIL_NORMALIZED=PASS");

assert.throws(
  () => resolve(publicOrder, "attacker@example.org"),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);

assert.throws(
  () => resolve("F6K-000000000000"),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);

console.log("WRONG_EMAIL_AND_ORDER_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'READY'
  WHERE id = ?
`).run(mintJobId);

assert.throws(
  () => resolve(),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);

console.log("ALREADY_READY_NOT_ELIGIBLE=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'AWAITING_WALLET'
  WHERE id = ?
`).run(mintJobId);

db.prepare(`
  UPDATE founding_memberships
  SET status = 'ACTIVE'
  WHERE id = ?
`).run(membershipId);

assert.throws(
  () => resolve(),
  /NFT_BUYER_ORDER_UNAVAILABLE/,
);

console.log("INELIGIBLE_MEMBERSHIP_BLOCKED=PASS");

const response = buyerEmailRequestAcknowledgement();

assert.equal(
  "membershipId" in response,
  false,
);
assert.equal(
  "registeredEmail" in response,
  false,
);
assert.equal(
  "mintJobId" in response,
  false,
);

assert.equal(
  "challengeId" in response,
  false,
);

console.log("PUBLIC_RESPONSE_NO_INTERNAL_IDS=PASS");

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM nft_email_deliveries
  `).get().count,
  0,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS count
    FROM nft_claim_grants
  `).get().count,
  0,
);

console.log("RESOLUTION_NO_EMAIL_OR_CLAIM=PASS");
console.log("NFT_BUYER_ORDER_RESOLVER_TEST=PASS");
console.log("NO PUBLIC ENDPOINT.");
console.log("NO REAL EMAIL.");
console.log("NO REAL MINT.");
