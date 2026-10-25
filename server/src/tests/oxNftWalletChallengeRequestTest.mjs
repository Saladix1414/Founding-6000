import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

import {
  issueNftClaimGrant,
} from "../../../cloudflare/nftClaimGrant.mjs";

import {
  issueEmailBoundWalletChallenge,
} from "../../../cloudflare/nftWalletChallengeRequest.mjs";

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

const orderId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const stamp = new Date(now).toISOString();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id,
    email, normalized_email,
    reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (?, 'F6K-ABCDEF123456', 'fixture',
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

const emailChallengeId = crypto.randomUUID();

db.prepare(`
  INSERT INTO nft_buyer_email_codes (
    id, membership_id, code_hash,
    status, attempts,
    expires_at, created_at, verified_at
  )
  VALUES (?, ?, ?, 'VERIFIED', 1, ?, ?, ?)
`).run(
  emailChallengeId,
  membershipId,
  "test-hash",
  new Date(now + 600000).toISOString(),
  stamp,
  stamp,
);

const grant = issueNftClaimGrant({
  storage,
  membershipId,
  emailChallengeId,
  now,
});

const walletAddress =
  "0x000000000000000000000000000000000000dEaD";

const request = {
  storage,
  claimToken: grant.token,
  email: "  BUYER@example.org ",
  walletAddress,
  domain: "originx.example",
  uri: "https://originx.example",
  chainId: 8453,
  now,
};

const first = issueEmailBoundWalletChallenge(request);

assert.match(
  first.challengeId,
  /^[0-9a-f-]{36}$/,
);

assert.equal(first.chainId, 8453);
assert.equal(first.walletAddress, walletAddress);

assert.ok(
  first.message.includes("Chain ID: 8453")
);

assert.ok(
  first.message.includes("Version: 1")
);

assert.ok(
  first.message.includes("Request ID:")
);

assert.equal(
  first.message.includes("buyer@example.org"),
  false,
);

const stored = db.prepare(`
  SELECT
    membership_id AS membershipId,
    status,
    wallet_address AS walletAddress
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(first.challengeId);

assert.equal(stored.membershipId, membershipId);
assert.equal(stored.status, "PENDING");
assert.equal(stored.walletAddress, walletAddress);

console.log("WALLET_CHALLENGE_ISSUED=PASS");
console.log("MEMBERSHIP_EMAIL_BOUND=PASS");
console.log("EMAIL_NOT_EXPOSED_IN_MESSAGE=PASS");

for (const changes of [
  { email: "attacker@example.org" },
  { claimToken: "0x" + "0".repeat(64) },
  { chainId: 1 },
  { domain: "attacker.example" },
  { walletAddress: "not-a-wallet" },
  { now: now + 16 * 60 * 1000 },
]) {
  assert.throws(
    () => issueEmailBoundWalletChallenge({
      ...request,
      ...changes,
    }),
    /NFT_WALLET_CHALLENGE_UNAVAILABLE/,
  );
}

console.log("WRONG_EMAIL_BLOCKED=PASS");
console.log("FORGED_CLAIM_BLOCKED=PASS");
console.log("WRONG_CHAIN_BLOCKED=PASS");
console.log("DOMAIN_MISMATCH_BLOCKED=PASS");
console.log("INVALID_WALLET_BLOCKED=PASS");
console.log("EXPIRED_CLAIM_BLOCKED=PASS");

const second = issueEmailBoundWalletChallenge(request);

assert.notEqual(first.challengeId, second.challengeId);

const previous = db.prepare(`
  SELECT status
  FROM nft_wallet_challenges
  WHERE id = ?
`).get(first.challengeId);

assert.equal(previous.status, "REVOKED");

console.log("PREVIOUS_CHALLENGE_REVOKED=PASS");

const job = db.prepare(`
  SELECT status, recipient_address
  FROM nft_mint_jobs
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(job.status, "AWAITING_WALLET");
assert.equal(job.recipient_address, null);

const claimState = db.prepare(`
  SELECT status
  FROM nft_claim_grants
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(claimState.status, "ISSUED");

console.log("CLAIM_CREDENTIAL_NOT_CONSUMED=PASS");
console.log("MINT_JOB_UNCHANGED=PASS");
console.log("WALLET_NOT_YET_BOUND=PASS");

db.close();

console.log("OX_NFT_5J_1_SQLITE=PASS");
console.log("SIGNATURE_VERIFICATION=NOT_YET_IMPLEMENTED");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
