import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  prepareNftMintReadiness,
} from "../../../cloudflare/nftMintReadinessTransition.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const stmt = db.prepare(query);

      const isRead =
        /^\s*(SELECT|WITH|PRAGMA)/i.test(query);

      const rows = isRead
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

const core = new CommerceCore(storage);
core.initializeSchema();
core.initializeSchema();

console.log("READINESS_SCHEMA_IDEMPOTENT=PASS");

const now = Date.now();
const stamp = new Date(now).toISOString();

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const challengeId = crypto.randomUUID();
const bindingId = crypto.randomUUID();

const wallet = Wallet.createRandom();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id,
    email, normalized_email,
    reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (?, 'F6K-000000000551', 'fixture',
    'Buyer@Example.org',
    'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id,
    serial_number, founding_member,
    genesis_member, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 551, 1, 1,
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
    serial_number, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 551,
    'AWAITING_WALLET', ?, ?)
`).run(
  jobId,
  membershipId,
  orderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_wallet_challenges (
    id, membership_id, wallet_address,
    nonce, challenge_message, status,
    created_at, expires_at, verified_at
  )
  VALUES (?, ?, ?, ?, 'fixture',
    'VERIFIED', ?, ?, ?)
`).run(
  challengeId,
  membershipId,
  wallet.address,
  crypto.randomUUID().replaceAll("-", ""),
  stamp,
  new Date(now + 300000).toISOString(),
  stamp,
);

db.prepare(`
  INSERT INTO nft_claim_grants (
    id, membership_id, token_hash,
    status, expires_at, consumed_at,
    created_at
  )
  VALUES (?, ?, ?, 'CONSUMED', ?, ?, ?)
`).run(
  crypto.randomUUID(),
  membershipId,
  "hash_" + crypto.randomUUID(),
  new Date(now + 900000).toISOString(),
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_wallet_bindings (
    id, membership_id, challenge_id,
    wallet_address, chain_id,
    status, bound_at
  )
  VALUES (?, ?, ?, ?, 8453, 'BOUND', ?)
`).run(
  bindingId,
  membershipId,
  challengeId,
  wallet.address,
  stamp,
);

db.prepare(`
  INSERT INTO nft_wallet_binding_events (
    id, binding_id, membership_id,
    challenge_id, event_type, created_at
  )
  VALUES (?, ?, ?, ?,
    'WALLET_BOUND', ?)
`).run(
  crypto.randomUUID(),
  bindingId,
  membershipId,
  challengeId,
  stamp,
);

const authorize = context =>
  context.operation === "NFT_MINT_READINESS" &&
  context.membershipId === membershipId;

const input = {
  storage,
  membershipId,
  email: "BUYER@example.org",
  authorizeReadiness: authorize,
  now,
};

function reject(changes = {}) {
  assert.throws(
    () => prepareNftMintReadiness({
      ...input,
      ...changes,
    }),
    /NFT_MINT_READINESS_UNAVAILABLE|NFT_DELIVERY_PREFLIGHT_UNAVAILABLE/,
  );
}

/*
 * No trusted callback means no transition.
 */
reject({
  authorizeReadiness: undefined,
});

reject({
  authorizeReadiness: () => false,
});

reject({
  email: "attacker@example.org",
});

reject({
  membershipId: crypto.randomUUID(),
});

console.log("MISSING_AUTHORITY_BLOCKED=PASS");
console.log("UNAUTHORIZED_TRANSITION_BLOCKED=PASS");
console.log("FOREIGN_EMAIL_BLOCKED=PASS");
console.log("FOREIGN_MEMBERSHIP_BLOCKED=PASS");

function mintState() {
  return db.prepare(`
    SELECT status,
           recipient_address AS recipient,
           mint_tx_hash AS txHash
    FROM nft_mint_jobs
    WHERE id = ?
  `).get(jobId);
}

function eventCount() {
  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_mint_readiness_events
    WHERE mint_job_id = ?
  `).get(jobId).total;
}

/*
 * Simulate an audit failure after the job
 * update. Both writes must roll back.
 */
db.exec(`
  CREATE TRIGGER reject_readiness_event
  BEFORE INSERT ON nft_mint_readiness_events
  BEGIN
    SELECT RAISE(
      ABORT,
      'SIMULATED_READINESS_EVENT_FAILURE'
    );
  END;
`);

try {
  assert.throws(
    () => prepareNftMintReadiness(input),
    /SIMULATED_READINESS_EVENT_FAILURE/,
  );
} finally {
  db.exec("DROP TRIGGER reject_readiness_event");
}

assert.equal(
  mintState().status,
  "AWAITING_WALLET"
);

assert.equal(mintState().recipient, null);
assert.equal(eventCount(), 0);

console.log("READINESS_SQLITE_ROLLBACK=PASS");
console.log("FAILED_AUDIT_RESTORES_JOB=PASS");

/*
 * Simulate six overlapping requests.
 *
 * This is a single-process SQLite test,
 * not a multi-isolate Cloudflare test.
 */
const attempts = await Promise.all(
  Array.from({ length: 6 }, async () => {
    try {
      return {
        ok: true,
        value: prepareNftMintReadiness(input),
      };
    } catch {
      return { ok: false };
    }
  })
);

const successful = attempts.filter(
  item => item.ok
);

assert.equal(successful.length, 1);

const result = successful[0].value;

assert.equal(result.prepared, true);
assert.equal(result.status, "READY");
assert.equal(result.walletAddress, wallet.address);
assert.equal(result.serialNumber, 551);

assert.equal(result.mintAuthority, false);
assert.equal(result.transactionSubmitted, false);

console.log("READINESS_CONCURRENT_REQUESTS=6");
console.log("READINESS_SINGLE_SUCCESS=PASS");

assert.equal(mintState().status, "READY");
assert.equal(mintState().recipient, wallet.address);
assert.equal(mintState().txHash, null);

assert.equal(eventCount(), 1);

console.log("READINESS_RECIPIENT_PERSISTED=PASS");
console.log("READINESS_AUDIT_EVENT_ONCE=PASS");
console.log("READINESS_NO_BLOCKCHAIN_TX=PASS");

reject();

console.log("READINESS_DUPLICATE_BLOCKED=PASS");

/*
 * The historical purchaser email remains
 * unchanged by readiness preparation.
 */
const originalEmail = db.prepare(`
  SELECT normalized_email
  FROM founding_orders
  WHERE id = ?
`).get(orderId).normalized_email;

assert.equal(
  originalEmail,
  "buyer@example.org"
);

console.log("ORIGINAL_SUBSCRIBER_EMAIL_PRESERVED=PASS");

db.close();

console.log("OX_NFT_5J_5_PART_2=PASS");
console.log("MINT_AUTHORITY=NONE");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
