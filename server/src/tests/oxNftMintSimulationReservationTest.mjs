import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  reserveSimulatedNftMint,
} from "../../../cloudflare/nftMintSimulationReservation.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const stmt = db.prepare(query);

      const read =
        /^\s*(SELECT|WITH|PRAGMA)/i.test(query);

      /*
       * Cloudflare storage.sql.exec() executes
       * writes immediately, even when the caller
       * does not consume a result iterator.
       *
       * A lazy write here silently skipped UPDATE
       * and INSERT and prevented fault injection.
       */
      if (!read) {
        stmt.run(...args);

        return {
          toArray: () => [],
        };
      }

      return {
        toArray: () => stmt.all(...args),
      };
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

const core = new CommerceCore(storage);
core.initializeSchema();
core.initializeSchema();

console.log("SIMULATION_SCHEMA_IDEMPOTENT=PASS");

const now = Date.now();
const stamp = new Date(now).toISOString();

const orderId = crypto.randomUUID();
const memberId = crypto.randomUUID();
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
  VALUES (?, 'F6K-000000000701', 'fixture',
    'buyer@example.org', 'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id,
    serial_number, founding_member,
    genesis_member, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 701, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(
  memberId,
  "mem_" + crypto.randomUUID(),
  orderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id,
    serial_number, recipient_address,
    status, created_at, updated_at
  )
  VALUES (?, ?, ?, 701, ?,
    'READY', ?, ?)
`).run(
  jobId,
  memberId,
  orderId,
  wallet.address,
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
  memberId,
  challengeId,
  wallet.address,
  stamp,
);

db.prepare(`
  INSERT INTO nft_mint_readiness_events (
    id, mint_job_id, membership_id,
    binding_id, recipient_address,
    event_type, created_at
  )
  VALUES (?, ?, ?, ?, ?,
    'MINT_JOB_READY', ?)
`).run(
  crypto.randomUUID(),
  jobId,
  memberId,
  bindingId,
  wallet.address,
  stamp,
);

const input = {
  storage,
  mintJobId: jobId,
  now,
};

function reject(changes = {}) {
  assert.throws(
    () => reserveSimulatedNftMint({
      ...input,
      ...changes,
    }),
    /NFT_MINT_SIMULATION_UNAVAILABLE|NFT_MINT_PLAN_UNAVAILABLE/,
  );
}

function job() {
  return db.prepare(`
    SELECT status,
           recipient_address AS recipient,
           mint_tx_hash AS txHash
    FROM nft_mint_jobs
    WHERE id = ?
  `).get(jobId);
}

function reservations() {
  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_mint_simulation_reservations
    WHERE mint_job_id = ?
  `).get(jobId).total;
}

reject({
  mintJobId: crypto.randomUUID(),
});

console.log("FOREIGN_JOB_REJECTED=PASS");

/*
 * Fault injection: audit persistence fails
 * after the job UPDATE. The full transaction
 * must be rolled back.
 */
db.exec(`
  CREATE TRIGGER reject_simulated_reservation
  BEFORE INSERT ON nft_mint_simulation_reservations
  BEGIN
    SELECT RAISE(
      ABORT,
      'SIMULATED_RESERVATION_AUDIT_FAILURE'
    );
  END;
`);

try {
  assert.throws(
    () => reserveSimulatedNftMint(input),
    /SIMULATED_RESERVATION_AUDIT_FAILURE/,
  );
} finally {
  db.exec(
    "DROP TRIGGER reject_simulated_reservation"
  );
}

assert.equal(job().status, "READY");
assert.equal(job().recipient, wallet.address);
assert.equal(job().txHash, null);
assert.equal(reservations(), 0);

console.log("SIMULATION_AUDIT_FAILURE_ROLLBACK=PASS");

/*
 * Six attempted reservations against one
 * SQLite database: only one may succeed.
 */
const attempts = await Promise.all(
  Array.from({ length: 6 }, async () => {
    try {
      return {
        ok: true,
        result: reserveSimulatedNftMint(input),
      };
    } catch {
      return { ok: false };
    }
  }),
);

const successes = attempts.filter(x => x.ok);

assert.equal(successes.length, 1);

const reserved = successes[0].result;

assert.equal(reserved.simulated, true);
assert.equal(reserved.status, "MINTING");
assert.equal(reserved.tokenId, 701);
assert.equal(reserved.recipient, wallet.address);
assert.equal(reserved.mintAuthority, false);
assert.equal(reserved.transactionSigned, false);
assert.equal(reserved.transactionSubmitted, false);

assert.equal(job().status, "MINTING");
assert.equal(job().recipient, wallet.address);
assert.equal(job().txHash, null);
assert.equal(reservations(), 1);

console.log("SIMULATION_REQUESTS=6");
console.log("SIMULATION_SINGLE_RESERVATION=PASS");
console.log("SIMULATION_AUDIT_ONCE=PASS");

reject();

console.log("SIMULATION_REPLAY_REJECTED=PASS");

const buyer = db.prepare(`
  SELECT normalized_email
  FROM founding_orders
  WHERE id = ?
`).get(orderId);

assert.equal(
  buyer.normalized_email,
  "buyer@example.org",
);

console.log("ORIGINAL_SUBSCRIBER_EMAIL_PRESERVED=PASS");

db.close();

console.log("========================================");
console.log(" OX_NFT_MINT_EXECUTION_PART_2=PASS");
console.log(" SIMULATION_ONLY=YES");
console.log(" REAL_MINT=NO");
console.log(" REAL_FUNDS_MOVED=NO");
console.log("========================================");
