import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  evaluateNftDeliveryPreflight,
} from "../../../cloudflare/nftWalletDeliveryPreflight.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const statement = db.prepare(query);
      const read = /^\s*(SELECT|WITH|PRAGMA)/i
        .test(query);

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
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

new CommerceCore(storage).initializeSchema();

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const challengeId = crypto.randomUUID();
const grantId = crypto.randomUUID();
const bindingId = crypto.randomUUID();
const wallet = Wallet.createRandom();
const stamp = new Date().toISOString();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email,
    normalized_email, reference_price_usd,
    status, created_at, updated_at
  ) VALUES (?, 'F6K-000000000501', 'fixture',
    'Buyer@Example.org', 'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 501, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(
  membershipId,
  "mem_" + crypto.randomUUID(),
  orderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id,
    serial_number, status, created_at, updated_at
  ) VALUES (?, ?, ?, 501, 'AWAITING_WALLET', ?, ?)
`).run(jobId, membershipId, orderId, stamp, stamp);

db.prepare(`
  INSERT INTO nft_wallet_challenges (
    id, membership_id, wallet_address,
    nonce, challenge_message, status,
    created_at, expires_at, verified_at
  ) VALUES (?, ?, ?, ?, 'fixture',
    'VERIFIED', ?, ?, ?)
`).run(
  challengeId,
  membershipId,
  wallet.address,
  crypto.randomUUID().replaceAll("-", ""),
  stamp,
  new Date(Date.now() + 300000).toISOString(),
  stamp,
);

db.prepare(`
  INSERT INTO nft_claim_grants (
    id, membership_id, token_hash, status,
    expires_at, consumed_at, created_at
  ) VALUES (?, ?, ?, 'CONSUMED', ?, ?, ?)
`).run(
  grantId,
  membershipId,
  "hash_" + crypto.randomUUID(),
  new Date(Date.now() + 900000).toISOString(),
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_wallet_bindings (
    id, membership_id, challenge_id,
    wallet_address, chain_id, status, bound_at
  ) VALUES (?, ?, ?, ?, 8453, 'BOUND', ?)
`).run(
  bindingId,
  membershipId,
  challengeId,
  wallet.address,
  stamp,
);

const input = {
  storage,
  membershipId,
  email: "BUYER@example.org",
};

function blocked(overrides = {}) {
  assert.throws(
    () => evaluateNftDeliveryPreflight({
      ...input,
      ...overrides,
    }),
    /NFT_DELIVERY_PREFLIGHT_UNAVAILABLE/,
  );
}

blocked();

console.log("MISSING_AUDIT_EVENT_BLOCKED=PASS");

db.prepare(`
  INSERT INTO nft_wallet_binding_events (
    id, binding_id, membership_id,
    challenge_id, event_type, created_at
  ) VALUES (?, ?, ?, ?, 'WALLET_BOUND', ?)
`).run(
  crypto.randomUUID(),
  bindingId,
  membershipId,
  challengeId,
  stamp,
);

const valid = evaluateNftDeliveryPreflight(input);

assert.equal(valid.eligibleForDeliveryReview, true);
assert.equal(valid.walletAddress, wallet.address);
assert.equal(valid.serialNumber, 501);
assert.equal(valid.chainId, 8453);
assert.equal(valid.mintAuthority, false);
assert.equal(valid.blockchainTransaction, false);

console.log("DELIVERY_PREFLIGHT_ELIGIBLE=PASS");
console.log("MINT_AUTHORITY_FALSE=PASS");

blocked({ email: "attacker@example.org" });
blocked({ membershipId: crypto.randomUUID() });

console.log("FOREIGN_EMAIL_BLOCKED=PASS");
console.log("FOREIGN_MEMBERSHIP_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'READY'
  WHERE id = ?
`).run(jobId);

blocked();

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'AWAITING_WALLET'
  WHERE id = ?
`).run(jobId);

console.log("READY_JOB_NOT_REAPPROVED=PASS");

db.prepare(`
  UPDATE nft_wallet_bindings
  SET wallet_address = ?
  WHERE id = ?
`).run(Wallet.createRandom().address, bindingId);

blocked();

db.prepare(`
  UPDATE nft_wallet_bindings
  SET wallet_address = ?
  WHERE id = ?
`).run(wallet.address, bindingId);

console.log("WALLET_SUBSTITUTION_BLOCKED=PASS");

db.prepare(`
  UPDATE founding_orders
  SET status = 'CANCELLED'
  WHERE id = ?
`).run(orderId);

blocked();

db.prepare(`
  UPDATE founding_orders
  SET status = 'PAID'
  WHERE id = ?
`).run(orderId);

console.log("UNPAID_ORDER_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_claim_grants
  SET status = 'REVOKED',
      consumed_at = NULL
  WHERE id = ?
`).run(grantId);

blocked();

console.log("REVOKED_CLAIM_BLOCKED=PASS");

const job = db.prepare(`
  SELECT status, recipient_address
  FROM nft_mint_jobs WHERE id = ?
`).get(jobId);

assert.equal(job.status, "AWAITING_WALLET");
assert.equal(job.recipient_address, null);

db.close();

console.log("MINT_JOB_UNCHANGED=PASS");
console.log("OX_NFT_5J_4_PART_1=PASS");
console.log("REAL_MINT=NO");
console.log("BLOCKCHAIN_TRANSACTION=NO");
