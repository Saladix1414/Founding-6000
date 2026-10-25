import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "ethers";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  issueNftClaimGrant,
} from "../../../cloudflare/nftClaimGrant.mjs";

import {
  issueEmailBoundWalletChallenge,
} from "../../../cloudflare/nftWalletChallengeRequest.mjs";

import {
  verifyEmailBoundWalletChallenge,
} from "../../../cloudflare/nftWalletChallengeVerification.mjs";

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

const now = Date.now();
const stamp = new Date(now).toISOString();
const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id,
    email, normalized_email,
    reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (?, 'F6K-ABCDEF123456', 'fixture',
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
  VALUES (?, ?, ?, 451, 1, 1,
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
  )
  VALUES (?, ?, ?, 451,
    'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(),
  membershipId,
  orderId,
  stamp,
  stamp,
);

const challengeEmailId = crypto.randomUUID();

db.prepare(`
  INSERT INTO nft_buyer_email_codes (
    id, membership_id, code_hash,
    status, attempts,
    expires_at, created_at, verified_at
  )
  VALUES (?, ?, 'fixture-hash',
    'VERIFIED', 0, ?, ?, ?)
`).run(
  challengeEmailId,
  membershipId,
  new Date(now + 600000).toISOString(),
  stamp,
  stamp,
);

const claim = issueNftClaimGrant({
  storage,
  membershipId,
  emailChallengeId: challengeEmailId,
  now,
});

const wallet = Wallet.createRandom();
const attacker = Wallet.createRandom();

function issue() {
  return issueEmailBoundWalletChallenge({
    storage,
    claimToken: claim.token,
    email: "buyer@example.org",
    walletAddress: wallet.address,
    domain: "originx.example",
    uri: "https://originx.example",
    chainId: 8453,
    now,
  });
}

const first = issue();

const signature = await wallet.signMessage(
  first.message
);

const verifyInput = {
  storage,
  challengeId: first.challengeId,
  claimToken: claim.token,
  email: "  BUYER@EXAMPLE.ORG ",
  signature,
  expectedOrigin: "https://originx.example",
  expectedChainId: 8453,
  now,
};

function reject(overrides) {
  assert.throws(
    () => verifyEmailBoundWalletChallenge({
      ...verifyInput,
      ...overrides,
    }),
    /NFT_WALLET_VERIFICATION_UNAVAILABLE|NFT_CLAIM_/,
  );
}

reject({
  email: "attacker@example.org",
});

reject({
  claimToken: "0x" + "0".repeat(64),
});

reject({
  expectedOrigin: "https://attacker.example",
});

reject({
  expectedChainId: 1,
});

reject({
  now: now + 6 * 60 * 1000,
});

const attackerSignature =
  await attacker.signMessage(first.message);

reject({
  signature: attackerSignature,
});

const untouched = db.prepare(`
  SELECT status
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(first.challengeId);

assert.equal(untouched.status, "PENDING");

console.log("WRONG_EMAIL_BLOCKED=PASS");
console.log("FORGED_CLAIM_BLOCKED=PASS");
console.log("WRONG_DOMAIN_BLOCKED=PASS");
console.log("WRONG_CHAIN_BLOCKED=PASS");
console.log("EXPIRED_CHALLENGE_BLOCKED=PASS");
console.log("FOREIGN_SIGNATURE_BLOCKED=PASS");

const verified =
  verifyEmailBoundWalletChallenge(verifyInput);

assert.equal(verified.verified, true);
assert.equal(verified.membershipId, membershipId);
assert.equal(verified.walletAddress, wallet.address);
assert.equal(verified.chainId, 8453);

const finalChallenge = db.prepare(`
  SELECT status, verified_at AS verifiedAt
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(first.challengeId);

assert.equal(finalChallenge.status, "VERIFIED");
assert.ok(finalChallenge.verifiedAt);

const finalClaim = db.prepare(`
  SELECT status, consumed_at AS consumedAt
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(finalClaim.status, "CONSUMED");
assert.ok(finalClaim.consumedAt);

console.log("REAL_ECDSA_SIGNATURE_VERIFIED=PASS");
console.log("EMAIL_BOUND_CLAIM_CONSUMED=PASS");
console.log("CHALLENGE_AND_CLAIM_ATOMIC=PASS");

reject({});

console.log("SIGNATURE_REPLAY_BLOCKED=PASS");

const job = db.prepare(`
  SELECT status, recipient_address AS recipient
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(job.status, "AWAITING_WALLET");
assert.equal(job.recipient, null);

console.log("MINT_JOB_UNCHANGED=PASS");
console.log("NO_WALLET_RECIPIENT_ASSIGNED=PASS");


/*
 * PHASE 5J.2 — PART 2
 *
 * Build a second independent membership to test
 * transactional rollback and a retry.
 *
 * These tests use real SQLite and real ECDSA.
 * They DO NOT simulate multiple workerd isolates.
 */

const recoveryOrderId = crypto.randomUUID();
const recoveryMemberId = crypto.randomUUID();
const recoveryEmailId = crypto.randomUUID();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id,
    email, normalized_email,
    reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (?, 'F6K-ABCDEF123457', 'fixture',
    'recovery@example.org',
    'recovery@example.org',
    50, 'PAID', ?, ?)
`).run(recoveryOrderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id,
    serial_number, founding_member,
    genesis_member, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 452, 1, 1,
    'ACTIVATION_PENDING', ?, ?)
`).run(
  recoveryMemberId,
  `mem_${crypto.randomUUID()}`,
  recoveryOrderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id,
    serial_number, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 452,
    'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(),
  recoveryMemberId,
  recoveryOrderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_buyer_email_codes (
    id, membership_id, code_hash,
    status, attempts,
    expires_at, created_at, verified_at
  )
  VALUES (?, ?, 'recovery-fixture',
    'VERIFIED', 0, ?, ?, ?)
`).run(
  recoveryEmailId,
  recoveryMemberId,
  new Date(now + 600000).toISOString(),
  stamp,
  stamp,
);

const recoveryGrant = issueNftClaimGrant({
  storage,
  membershipId: recoveryMemberId,
  emailChallengeId: recoveryEmailId,
  now,
});

const recoveryWallet = Wallet.createRandom();

const recoveryChallenge =
  issueEmailBoundWalletChallenge({
    storage,
    claimToken: recoveryGrant.token,
    email: "recovery@example.org",
    walletAddress: recoveryWallet.address,
    domain: "originx.example",
    uri: "https://originx.example",
    chainId: 8453,
    now,
  });

const recoverySignature =
  await recoveryWallet.signMessage(
    recoveryChallenge.message
  );

const recoveryInput = {
  storage,
  challengeId: recoveryChallenge.challengeId,
  claimToken: recoveryGrant.token,
  email: "recovery@example.org",
  signature: recoverySignature,
  expectedOrigin: "https://originx.example",
  expectedChainId: 8453,
  now,
};

/*
 * Force a failure at the last database write,
 * after the NFT claim has already been consumed
 * inside the enclosing transaction.
 *
 * All changes must roll back together.
 */

db.exec(`
  CREATE TRIGGER ox_test_reject_wallet_verification
  BEFORE UPDATE OF status
  ON nft_wallet_challenges
  WHEN NEW.status = 'VERIFIED'
  BEGIN
    SELECT RAISE(
      ABORT,
      'SIMULATED_WALLET_SQLITE_WRITE_FAILURE'
    );
  END;
`);

try {
  assert.throws(
    () => verifyEmailBoundWalletChallenge(
      recoveryInput
    ),
    /SIMULATED_WALLET_SQLITE_WRITE_FAILURE/,
  );
} finally {
  db.exec(
    "DROP TRIGGER ox_test_reject_wallet_verification"
  );
}

const rolledBackChallenge = db.prepare(`
  SELECT status, verified_at AS verifiedAt
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(recoveryChallenge.challengeId);

const rolledBackGrant = db.prepare(`
  SELECT status, consumed_at AS consumedAt
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(recoveryMemberId);

assert.equal(rolledBackChallenge.status, "PENDING");
assert.equal(rolledBackChallenge.verifiedAt, null);

assert.equal(rolledBackGrant.status, "ISSUED");
assert.equal(rolledBackGrant.consumedAt, null);

console.log("WALLET_SQLITE_ATOMIC_ROLLBACK=PASS");
console.log("WALLET_CLAIM_RECOVERABLE_AFTER_FAILURE=PASS");

/*
 * Six overlapping calls in one Node process.
 *
 * Exactly one may verify the ECDSA signature
 * and consume the buyer's claim credential.
 *
 * Promise.all here is NOT a multi-isolate race
 * simulation; that requires workerd testing.
 */

const simultaneous = await Promise.all(
  Array.from({ length: 6 }, async () => {
    try {
      return {
        ok: true,
        result: verifyEmailBoundWalletChallenge(
          recoveryInput
        ),
      };
    } catch {
      return { ok: false };
    }
  })
);

const accepted = simultaneous.filter(
  entry => entry.ok
);

assert.equal(accepted.length, 1);

assert.equal(
  accepted[0].result.walletAddress,
  recoveryWallet.address
);

const finalRecoveryChallenge = db.prepare(`
  SELECT status
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(recoveryChallenge.challengeId);

const finalRecoveryGrant = db.prepare(`
  SELECT status
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(recoveryMemberId);

assert.equal(
  finalRecoveryChallenge.status,
  "VERIFIED"
);

assert.equal(
  finalRecoveryGrant.status,
  "CONSUMED"
);

assert.throws(
  () => verifyEmailBoundWalletChallenge(
    recoveryInput
  ),
  /NFT_WALLET_VERIFICATION_UNAVAILABLE/,
);

const totalVerified = db.prepare(`
  SELECT COUNT(*) AS total
  FROM nft_wallet_challenges
  WHERE membership_id = ?
    AND status = 'VERIFIED'
`).get(recoveryMemberId);

assert.equal(totalVerified.total, 1);

const recoveryJob = db.prepare(`
  SELECT status, recipient_address AS recipient
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(recoveryMemberId);

assert.equal(
  recoveryJob.status,
  "AWAITING_WALLET"
);

assert.equal(
  recoveryJob.recipient,
  null
);

console.log("WALLET_SQLITE_FAILURE_RECOVERY=PASS");
console.log("WALLET_CONCURRENT_REQUESTS=6");
console.log("WALLET_CONCURRENT_SUCCESS_COUNT=1");
console.log("WALLET_SIGNATURE_REPLAY_BLOCKED=PASS");
console.log("WALLET_VERIFIED_CHALLENGE_COUNT=1");
console.log("WALLET_MINT_AUTHORITY=NONE");

db.close();

console.log("OX_NFT_5J_2_CRYPTO_SQLITE=PASS");
console.log("CONTRACT_WALLET_EIP1271=PENDING");
console.log("PUBLIC_HTTP_ENDPOINT=NO");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
