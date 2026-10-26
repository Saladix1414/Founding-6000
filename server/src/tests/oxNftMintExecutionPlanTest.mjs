import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  Interface,
  Wallet,
} from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  buildNftMintExecutionPlan,
} from "../../../cloudflare/nftMintExecutionPlan.mjs";

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

      return {
        toArray: () => read
          ? statement.all(...args)
          : (statement.run(...args), []),
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

new CommerceCore(storage).initializeSchema();

const orderId = crypto.randomUUID();
const memberId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const challengeId = crypto.randomUUID();
const bindingId = crypto.randomUUID();
const wallet = Wallet.createRandom();

const stamp = new Date().toISOString();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email,
    normalized_email, reference_price_usd,
    status, created_at, updated_at
  ) VALUES (?, 'F6K-000000000601', 'fixture',
    'buyer@example.org', 'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id,
    serial_number, founding_member,
    genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 601, 1, 1,
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
  ) VALUES (?, ?, ?, 601, ?,
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
  ) VALUES (?, ?, ?, ?, 8453,
    'BOUND', ?)
`).run(
  bindingId,
  memberId,
  challengeId,
  wallet.address,
  stamp,
);

const input = {
  storage,
  mintJobId: jobId,
};

function blocked(changes = {}) {
  assert.throws(
    () => buildNftMintExecutionPlan({
      ...input,
      ...changes,
    }),
    /NFT_MINT_PLAN_UNAVAILABLE/,
  );
}

blocked();

console.log("MISSING_READINESS_AUDIT_BLOCKED=PASS");

db.prepare(`
  INSERT INTO nft_mint_readiness_events (
    id, mint_job_id, membership_id,
    binding_id, recipient_address,
    event_type, created_at
  ) VALUES (?, ?, ?, ?, ?,
    'MINT_JOB_READY', ?)
`).run(
  crypto.randomUUID(),
  jobId,
  memberId,
  bindingId,
  wallet.address,
  stamp,
);

const plan = buildNftMintExecutionPlan(input);

assert.equal(
  plan.readyForExecutionReview,
  true,
);
assert.equal(plan.tokenId, 601);
assert.equal(plan.recipient, wallet.address);
assert.equal(plan.chainId, 8453);
assert.equal(plan.mintAuthority, false);
assert.equal(plan.transactionSigned, false);
assert.equal(plan.transactionSubmitted, false);

const abi = new Interface([
  "function mint(address to,uint256 tokenId)",
]);

const decoded = abi.decodeFunctionData(
  "mint",
  plan.calldata,
);

assert.equal(decoded[0], wallet.address);
assert.equal(decoded[1], 601n);

console.log("MINT_CALLDATA_ABI_VERIFIED=PASS");
console.log("MINT_TOKEN_ID=VERIFIED");
console.log("MINT_RECIPIENT=VERIFIED");

blocked({
  mintJobId: crypto.randomUUID(),
});

console.log("FOREIGN_MINT_JOB_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET recipient_address = ?
  WHERE id = ?
`).run(
  Wallet.createRandom().address,
  jobId,
);

blocked();

db.prepare(`
  UPDATE nft_mint_jobs
  SET recipient_address = ?
  WHERE id = ?
`).run(wallet.address, jobId);

console.log("RECIPIENT_SUBSTITUTION_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_wallet_bindings
  SET wallet_address = ?
  WHERE id = ?
`).run(
  Wallet.createRandom().address,
  bindingId,
);

blocked();

db.prepare(`
  UPDATE nft_wallet_bindings
  SET wallet_address = ?
  WHERE id = ?
`).run(wallet.address, bindingId);

console.log("WALLET_BINDING_SUBSTITUTION_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'MINTING'
  WHERE id = ?
`).run(jobId);

blocked();

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'READY'
  WHERE id = ?
`).run(jobId);

console.log("NON_READY_JOB_BLOCKED=PASS");

db.prepare(`
  UPDATE nft_mint_jobs
  SET mint_tx_hash = ?
  WHERE id = ?
`).run("0x" + "a".repeat(64), jobId);

blocked();

db.prepare(`
  UPDATE nft_mint_jobs
  SET mint_tx_hash = NULL
  WHERE id = ?
`).run(jobId);

console.log("EXISTING_TRANSACTION_BLOCKED=PASS");

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

console.log("CANCELLED_ORDER_BLOCKED=PASS");

const repeat = buildNftMintExecutionPlan(input);

assert.deepEqual(repeat, plan);

const job = db.prepare(`
  SELECT status, recipient_address,
         mint_tx_hash
  FROM nft_mint_jobs
  WHERE id = ?
`).get(jobId);

assert.equal(job.status, "READY");
assert.equal(
  job.recipient_address,
  wallet.address,
);
assert.equal(job.mint_tx_hash, null);

console.log("MINT_PLAN_DETERMINISTIC=PASS");
console.log("MINT_JOB_READ_ONLY=PASS");

db.close();

console.log("========================================");
console.log(" OX_NFT_MINT_EXECUTION_PART_1=PASS");
console.log(" BLOCKCHAIN_SIGNER=NONE");
console.log(" PRIVATE_KEYS=NONE");
console.log(" RPC_CALLS=NONE");
console.log(" TRANSACTIONS_SUBMITTED=NO");
console.log(" REAL_MINT=NO");
console.log("========================================");
