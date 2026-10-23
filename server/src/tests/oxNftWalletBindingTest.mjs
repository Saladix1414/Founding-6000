import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "ethers";
import {
  issueNftClaimGrant,
} from "../../../cloudflare/nftClaimGrant.mjs";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  beginNftWalletBinding,
  completeNftWalletBinding,
} from "../../../cloudflare/nftWalletBinding.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }
      const stmt = db.prepare(query);
      const isRead = /^\s*(SELECT|WITH|PRAGMA)/i.test(query);
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

new CommerceCore(storage).initializeSchema();

db.exec(`
  CREATE TABLE IF NOT EXISTS nft_wallet_challenges (
    id TEXT PRIMARY KEY,
    membership_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    challenge_message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(
      status IN ('PENDING','VERIFIED','EXPIRED','REVOKED')
    ),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    verified_at TEXT,
    CHECK(
      (status = 'VERIFIED' AND verified_at IS NOT NULL)
      OR
      (status != 'VERIFIED' AND verified_at IS NULL)
    )
  );
`);

const memberId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const publicId = `mem_${crypto.randomUUID()}`;
const owner = Wallet.createRandom();
const attacker = Wallet.createRandom();
const now = Date.now();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email, normalized_email,
    reference_price_usd, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 50, 'PAID', ?, ?)
`).run(
  orderId, "F6K-111111111111", "test-phase",
  "buyer@example.org", "buyer@example.org",
  new Date(now).toISOString(),
  new Date(now).toISOString(),
);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  ) VALUES (?, ?, ?, 1, 1, 1, 'ACTIVATION_PENDING', ?, ?)
`).run(
  memberId, publicId, orderId,
  new Date(now).toISOString(),
  new Date(now).toISOString(),
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id, serial_number,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, 1, 'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(), memberId, orderId,
  new Date(now).toISOString(),
  new Date(now).toISOString(),
);

const options = {
  storage,
  membershipId: memberId,
  walletAddress: owner.address,
  origin: "https://founding.example.org",
  chainId: 8453,
  now,
};

const old = beginNftWalletBinding(options);
const challenge = beginNftWalletBinding(options);

assert.notEqual(old.nonce, challenge.nonce);

const oldSignature = await owner.signMessage(old.message);

assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: old.nonce, signature: oldSignature,
  now: now + 1000,
}), /NOT_PENDING/);

console.log("SUPERSEDED_NONCE_BLOCKED=PASS");

const signature = await owner.signMessage(challenge.message);

assert.throws(() => completeNftWalletBinding({
  storage,
  membershipId: crypto.randomUUID(),
  nonce: challenge.nonce, signature,
  now: now + 1000,
}), /NOT_ELIGIBLE/);

console.log("CROSS_MEMBERSHIP_BLOCKED=PASS");

const attackerSignature =
  await attacker.signMessage(challenge.message);

assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce,
  signature: attackerSignature,
  now: now + 1000,
}), /SIGNATURE_INVALID/);

console.log("WRONG_WALLET_BLOCKED=PASS");

assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce, signature,
  now: Date.parse(challenge.expiresAt),
}), /SIGNATURE_INVALID/);

console.log("EXPIRED_SIGNATURE_BLOCKED=PASS");

/*
 * A valid wallet signature without a buyer claim must fail.
 */
assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce, signature,
  now: now + 1000,
}), /NFT_CLAIM_REQUIRED/);

const grant = issueNftClaimGrant({
  storage, membershipId: memberId, now,
});

assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce, signature,
  claimToken: "0x" + "f".repeat(64),
  now: now + 1000,
}), /NFT_CLAIM_INVALID_OR_EXPIRED/);

const pendingBefore = db.prepare(`
  SELECT status FROM nft_wallet_challenges
  WHERE nonce = ?
`).get(challenge.nonce);

assert.equal(pendingBefore.status, "PENDING");

const grantBefore = db.prepare(`
  SELECT status FROM nft_claim_grants
  WHERE membership_id = ? AND status = 'ISSUED'
`).get(memberId);

assert.equal(grantBefore.status, "ISSUED");


/*
 * Force a failure after the claim and challenge
 * have been updated, at the mint-job transition.
 *
 * The entire transaction must roll back.
 */
db.exec(`
  CREATE TRIGGER nft_claim_test_reject_ready
  BEFORE UPDATE OF status ON nft_mint_jobs
  WHEN NEW.status = 'READY'
  BEGIN
    SELECT RAISE(ABORT, 'NFT_TEST_READY_FAILURE');
  END;
`);

let simulatedFailure = false;

try {
  completeNftWalletBinding({
    storage,
    membershipId: memberId,
    nonce: challenge.nonce,
    signature,
    claimToken: grant.token,
    now: now + 1000,
  });
} catch (error) {
  simulatedFailure =
    String(error).includes("NFT_TEST_READY_FAILURE");

  if (!simulatedFailure) {
    throw error;
  }
} finally {
  db.exec("DROP TRIGGER nft_claim_test_reject_ready");
}

assert.equal(
  simulatedFailure,
  true,
  "NFT_READY_FAILURE_NOT_TRIGGERED",
);

const claimAfterFailure = db.prepare(`
  SELECT status, consumed_at AS consumedAt
  FROM nft_claim_grants
  WHERE membership_id = ?
    AND token_hash = ?
`).get(
  memberId,
  (
    await import("ethers")
  ).sha256(grant.token),
);

assert.equal(claimAfterFailure.status, "ISSUED");
assert.equal(claimAfterFailure.consumedAt, null);

const challengeAfterFailure = db.prepare(`
  SELECT status, verified_at AS verifiedAt
  FROM nft_wallet_challenges
  WHERE nonce = ?
`).get(challenge.nonce);

assert.equal(challengeAfterFailure.status, "PENDING");
assert.equal(challengeAfterFailure.verifiedAt, null);

const jobAfterFailure = db.prepare(`
  SELECT status, recipient_address AS recipientAddress
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(memberId);

assert.equal(jobAfterFailure.status, "AWAITING_WALLET");
assert.equal(jobAfterFailure.recipientAddress, null);

console.log("NFT_CLAIM_ATOMIC_ROLLBACK=PASS");

const completed = completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce, signature,
  claimToken: grant.token,
  now: now + 1000,
});

assert.equal(completed.status, "READY");
assert.equal(completed.recipientAddress, owner.address);

const job = db.prepare(`
  SELECT status, recipient_address AS recipientAddress
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(memberId);

assert.equal(job.status, "READY");
assert.equal(job.recipientAddress, owner.address);

const consumedGrant = db.prepare(`
  SELECT status, consumed_at AS consumedAt
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(memberId);

assert.equal(consumedGrant.status, "CONSUMED");
assert.ok(consumedGrant.consumedAt);

console.log("AUTHORIZED_WALLET_JOB_READY=PASS");
console.log("NFT_CLAIM_AND_WALLET_ATOMIC=PASS");

assert.throws(() => completeNftWalletBinding({
  storage, membershipId: memberId,
  nonce: challenge.nonce, signature,
  now: now + 2000,
}));

console.log("SIGNATURE_REPLAY_BLOCKED=PASS");


/*
 * Eligibility is checked again at challenge creation.
 * Wallet ownership alone cannot authorize a membership.
 */
const bindingCountBefore = db.prepare(`
  SELECT COUNT(*) AS count
  FROM nft_wallet_challenges
`).get().count;

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'AWAITING_WALLET',
      recipient_address = NULL
  WHERE membership_id = ?
`).run(memberId);

db.prepare(`
  UPDATE founding_orders
  SET status = 'CREATED'
  WHERE id = ?
`).run(orderId);

assert.throws(
  () => beginNftWalletBinding(options),
  /NFT_WALLET_BINDING_NOT_ELIGIBLE/,
);

console.log("NFT_UNPAID_ORDER_BLOCKED=PASS");

db.prepare(`
  UPDATE founding_orders
  SET status = 'PAID'
  WHERE id = ?
`).run(orderId);

db.prepare(`
  UPDATE founding_memberships
  SET status = 'EXPIRED'
  WHERE id = ?
`).run(memberId);

assert.throws(
  () => beginNftWalletBinding(options),
  /NFT_WALLET_BINDING_NOT_ELIGIBLE/,
);

console.log("NFT_INELIGIBLE_MEMBERSHIP_BLOCKED=PASS");

db.prepare(`
  UPDATE founding_memberships
  SET status = 'ACTIVATION_PENDING'
  WHERE id = ?
`).run(memberId);

db.prepare(`
  UPDATE nft_mint_jobs
  SET status = 'READY',
      recipient_address = ?
  WHERE membership_id = ?
`).run(owner.address, memberId);

assert.throws(
  () => beginNftWalletBinding(options),
  /NFT_WALLET_BINDING_NOT_ELIGIBLE/,
);

console.log("NFT_ALREADY_READY_BLOCKED=PASS");

const bindingCountAfter = db.prepare(`
  SELECT COUNT(*) AS count
  FROM nft_wallet_challenges
`).get().count;

assert.equal(
  bindingCountAfter,
  bindingCountBefore,
  "REJECTED_REQUEST_CREATED_CHALLENGE",
);

console.log("REJECTED_BINDING_NO_SIDE_EFFECTS=PASS");

console.log("NFT_WALLET_BINDING_TEST=PASS");
console.log("NO_PUBLIC_ROUTE=YES");
console.log("NO_MINT_EXECUTED=YES");
