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

import {
  bindVerifiedWalletToMembership,
} from "../../../cloudflare/nftWalletMembershipBinding.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const stmt = db.prepare(query);
      const isRead = /^\s*(SELECT|WITH|PRAGMA)/i
        .test(query);

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

console.log("BINDING_SCHEMA_IDEMPOTENT=PASS");

const now = Date.now();
const stamp = new Date(now).toISOString();

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const emailCodeId = crypto.randomUUID();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id,
    email, normalized_email,
    reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (?, 'F6K-123456ABCDEF', 'fixture',
    'Buyer@Example.org', 'buyer@example.org',
    50, 'PAID', ?, ?)
`).run(orderId, stamp, stamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id,
    serial_number, founding_member,
    genesis_member, status,
    created_at, updated_at
  )
  VALUES (?, ?, ?, 550, 1, 1,
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
  VALUES (?, ?, ?, 550,
    'AWAITING_WALLET', ?, ?)
`).run(
  crypto.randomUUID(),
  membershipId,
  orderId,
  stamp,
  stamp,
);

db.prepare(`
  INSERT INTO nft_buyer_email_codes (
    id, membership_id, code_hash,
    status, attempts,
    expires_at, created_at, verified_at
  )
  VALUES (?, ?, 'fixture-code',
    'VERIFIED', 0, ?, ?, ?)
`).run(
  emailCodeId,
  membershipId,
  new Date(now + 600000).toISOString(),
  stamp,
  stamp,
);

const grant = issueNftClaimGrant({
  storage,
  membershipId,
  emailChallengeId: emailCodeId,
  now,
});

const wallet = Wallet.createRandom();

const challenge = issueEmailBoundWalletChallenge({
  storage,
  claimToken: grant.token,
  email: "buyer@example.org",
  walletAddress: wallet.address,
  domain: "originx.example",
  uri: "https://originx.example",
  chainId: 8453,
  now,
});

const input = {
  storage,
  challengeId: challenge.challengeId,
  email: "buyer@example.org",
  now,
};

function reject(changes = {}) {
  assert.throws(
    () => bindVerifiedWalletToMembership({
      ...input,
      ...changes,
    }),
    /NFT_WALLET_BINDING_UNAVAILABLE/,
  );
}

reject();

console.log("UNVERIFIED_CHALLENGE_BLOCKED=PASS");

const signature = await wallet.signMessage(
  challenge.message
);

const verified = verifyEmailBoundWalletChallenge({
  storage,
  challengeId: challenge.challengeId,
  claimToken: grant.token,
  email: input.email,
  signature,
  expectedOrigin: "https://originx.example",
  expectedChainId: 8453,
  now,
});

assert.equal(verified.verified, true);

reject({ email: "attacker@example.org" });
reject({ challengeId: crypto.randomUUID() });
reject({ now: now + 16 * 60 * 1000 });

console.log("FOREIGN_SUBSCRIBER_EMAIL_BLOCKED=PASS");
console.log("UNKNOWN_CHALLENGE_BLOCKED=PASS");
console.log("STALE_BINDING_ATTEMPT_BLOCKED=PASS");

/*
 * Simulate event persistence failure.
 * Binding and event must roll back together.
 */
db.exec(`
  CREATE TRIGGER reject_wallet_binding_event
  BEFORE INSERT ON nft_wallet_binding_events
  BEGIN
    SELECT RAISE(
      ABORT,
      'SIMULATED_BINDING_EVENT_FAILURE'
    );
  END;
`);

try {
  assert.throws(
    () => bindVerifiedWalletToMembership(input),
    /SIMULATED_BINDING_EVENT_FAILURE/,
  );
} finally {
  db.exec("DROP TRIGGER reject_wallet_binding_event");
}

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_wallet_bindings
  `).get().total,
  0,
);

console.log("BINDING_EVENT_FAILURE_ROLLBACK=PASS");

const bound = bindVerifiedWalletToMembership(input);

assert.equal(bound.bound, true);
assert.equal(bound.membershipId, membershipId);
assert.equal(bound.walletAddress, wallet.address);
assert.equal(bound.serialNumber, 550);
assert.equal(bound.chainId, 8453);

const row = db.prepare(`
  SELECT b.wallet_address AS wallet,
         o.normalized_email AS originalEmail,
         b.status
  FROM nft_wallet_bindings b
  JOIN founding_memberships m
    ON m.id = b.membership_id
  JOIN founding_orders o
    ON o.id = m.order_id
  WHERE b.membership_id = ?
`).get(membershipId);

assert.equal(row.wallet, wallet.address);
assert.equal(row.originalEmail, "buyer@example.org");
assert.equal(row.status, "BOUND");

console.log("PERSISTENT_WALLET_BINDING=PASS");
console.log("ORIGINAL_SUBSCRIBER_EMAIL_PRESERVED=PASS");

reject();

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_wallet_bindings
    WHERE membership_id = ?
  `).get(membershipId).total,
  1,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_wallet_binding_events
    WHERE membership_id = ?
      AND event_type = 'WALLET_BOUND'
  `).get(membershipId).total,
  1,
);

console.log("DUPLICATE_BINDING_BLOCKED=PASS");
console.log("BINDING_AUDIT_EVENT_ONCE=PASS");

const mintJob = db.prepare(`
  SELECT status, recipient_address AS recipient
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(mintJob.status, "AWAITING_WALLET");
assert.equal(mintJob.recipient, null);

console.log("MINT_JOB_UNCHANGED=PASS");
console.log("ONCHAIN_OWNERSHIP_NOT_ASSUMED=PASS");

db.close();

console.log("OX_NFT_5J_3_PART_1=PASS");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
