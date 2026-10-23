import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CommerceCore } from "../../../cloudflare/commerceCore.mjs";
import {
  deliverBuyerEmailCode,
} from "../../../cloudflare/nftBuyerEmailFlow.mjs";

const db = new DatabaseSync(":memory:");

const storage = {
  sql: {
    exec(query, ...args) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }

      const statement = db.prepare(query);
      const read = /^\s*(SELECT|WITH|PRAGMA)/i.test(query);

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

const now = Date.parse("2026-10-23T15:00:00Z");
const timestamp = new Date(now).toISOString();

function createBuyer(serial) {
  const membershipId = crypto.randomUUID();
  const orderId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO founding_orders (
      id, public_id, phase_id,
      email, normalized_email,
      reference_price_usd,
      status, created_at, updated_at
    )
    VALUES (?, ?, 'test',
      'buyer@example.org',
      'buyer@example.org',
      50, 'PAID', ?, ?)
  `).run(
    orderId,
    `F6K-${String(serial).padStart(12, "0")}`,
    timestamp,
    timestamp,
  );

  db.prepare(`
    INSERT INTO founding_memberships (
      id, public_id, order_id, serial_number,
      founding_member, genesis_member, status,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, 1,
      'ACTIVATION_PENDING', ?, ?)
  `).run(
    membershipId,
    `mem_${crypto.randomUUID()}`,
    orderId,
    serial,
    timestamp,
    timestamp,
  );

  db.prepare(`
    INSERT INTO nft_mint_jobs (
      id, membership_id, order_id,
      serial_number, status,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'AWAITING_WALLET', ?, ?)
  `).run(
    crypto.randomUUID(),
    membershipId,
    orderId,
    serial,
    timestamp,
    timestamp,
  );

  return membershipId;
}

function request(membershipId, fetcher) {
  return deliverBuyerEmailCode({
    storage,
    membershipId,
    now,
    apiKey: "re_test_placeholder_not_real",
    from: "verify@example.org",
    fetcher,
  });
}

function count(table, membershipId) {
  const supported = new Set([
    "nft_buyer_email_codes",
    "nft_email_rate_limits",
    "nft_email_deliveries",
  ]);

  assert.ok(supported.has(table));

  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM ${table}
    WHERE membership_id = ?
  `).get(membershipId).total;
}

/*
 * TEST 1 — concurrent requests while the first
 * provider call remains unresolved.
 */
const memberA = createBuyer(21);

let releaseProvider;
let providerCalls = 0;

const providerGate = new Promise(resolve => {
  releaseProvider = resolve;
});

const pending = request(memberA, async () => {
  providerCalls++;
  await providerGate;
  return Response.json({ id: "mock-concurrent-001" });
});

await assert.rejects(
  request(memberA, async () => {
    providerCalls++;
    throw new Error("SECOND_SEND_NOT_ALLOWED");
  }),
  /NFT_EMAIL_COOLDOWN_ACTIVE/,
);

assert.equal(providerCalls, 1);
assert.equal(
  count("nft_email_deliveries", memberA),
  1,
);

releaseProvider();
const firstResult = await pending;

assert.equal(firstResult.accepted, true);
assert.equal("code" in firstResult, false);

console.log("CONCURRENT_DUPLICATE_SEND_BLOCKED=PASS");
console.log("CONCURRENT_SINGLE_RESERVATION=PASS");

/*
 * TEST 2 — provider accepts, but SQLite refuses
 * to record the acceptance.
 *
 * The code must be revoked and the outcome
 * reported as unavailable, not delivered.
 */
const memberB = createBuyer(22);

db.exec(`
  CREATE TRIGGER nft_test_acceptance_failure
  BEFORE UPDATE OF status ON nft_email_deliveries
  WHEN NEW.status = 'ACCEPTED'
  BEGIN
    SELECT RAISE(ABORT, 'NFT_TEST_AUDIT_FAILURE');
  END;
`);

let providerAccepted = false;

try {
  await assert.rejects(
    request(memberB, async () => {
      providerAccepted = true;
      return Response.json({
        id: "mock-provider-accepted-002",
      });
    }),
    /NFT_EMAIL_DELIVERY_UNAVAILABLE/,
  );
} finally {
  db.exec("DROP TRIGGER nft_test_acceptance_failure");
}

assert.equal(providerAccepted, true);

const failedCode = db.prepare(`
  SELECT status
  FROM nft_buyer_email_codes
  WHERE membership_id = ?
`).get(memberB);

const failedAudit = db.prepare(`
  SELECT status
  FROM nft_email_deliveries
  WHERE membership_id = ?
`).get(memberB);

assert.equal(failedCode.status, "REVOKED");
assert.equal(failedAudit.status, "FAILED");

console.log("PROVIDER_ACCEPTED_AUDIT_FAILURE=PASS");
console.log("UNCERTAIN_DELIVERY_CODE_REVOKED=PASS");

/*
 * TEST 3 — code insertion failure must undo
 * the rate reservation in the same transaction.
 */
const memberC = createBuyer(23);

db.exec(`
  CREATE TRIGGER nft_test_code_insert_failure
  BEFORE INSERT ON nft_buyer_email_codes
  BEGIN
    SELECT RAISE(ABORT, 'NFT_TEST_CODE_INSERT_FAILURE');
  END;
`);

let attemptedSend = false;

try {
  await assert.rejects(
    request(memberC, async () => {
      attemptedSend = true;
      return Response.json({ id: "unexpected" });
    }),
    /NFT_TEST_CODE_INSERT_FAILURE/,
  );
} finally {
  db.exec("DROP TRIGGER nft_test_code_insert_failure");
}

assert.equal(attemptedSend, false);

assert.equal(
  count("nft_email_rate_limits", memberC),
  0,
);

assert.equal(
  count("nft_buyer_email_codes", memberC),
  0,
);

assert.equal(
  count("nft_email_deliveries", memberC),
  0,
);

console.log("CODE_FAILURE_RATE_ROLLBACK=PASS");
console.log("CODE_FAILURE_NO_PROVIDER_REQUEST=PASS");

/*
 * None of these tests may advance NFT minting.
 */
const ready = db.prepare(`
  SELECT COUNT(*) AS total
  FROM nft_mint_jobs
  WHERE status = 'READY'
`).get().total;

assert.equal(ready, 0);

console.log("CONCURRENCY_NO_MINT_AUTHORITY=PASS");
console.log("NFT_EMAIL_CONCURRENCY_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
