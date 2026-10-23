import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

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

const membershipId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const now = Date.parse("2026-10-23T12:00:00Z");
const timestamp = new Date(now).toISOString();

db.prepare(`
  INSERT INTO founding_orders (
    id, public_id, phase_id, email,
    normalized_email, reference_price_usd,
    status, created_at, updated_at
  )
  VALUES (
    ?, 'F6K-555555555555', 'test',
    'buyer@example.org', 'buyer@example.org',
    50, 'PAID', ?, ?
  )
`).run(orderId, timestamp, timestamp);

db.prepare(`
  INSERT INTO founding_memberships (
    id, public_id, order_id, serial_number,
    founding_member, genesis_member, status,
    created_at, updated_at
  )
  VALUES (
    ?, ?, ?, 5, 1, 1,
    'ACTIVATION_PENDING', ?, ?
  )
`).run(
  membershipId,
  `mem_${crypto.randomUUID()}`,
  orderId,
  timestamp,
  timestamp,
);

db.prepare(`
  INSERT INTO nft_mint_jobs (
    id, membership_id, order_id, serial_number,
    status, created_at, updated_at
  )
  VALUES (
    ?, ?, ?, 5, 'AWAITING_WALLET', ?, ?
  )
`).run(
  crypto.randomUUID(),
  membershipId,
  orderId,
  timestamp,
  timestamp,
);

const base = {
  storage,
  membershipId,
  apiKey: "re_test_placeholder_not_real",
  from: "verify@example.org",
};

let sentCode = null;

const success = await deliverBuyerEmailCode({
  ...base,
  now,
  fetcher: async (_url, options) => {
    const body = JSON.parse(options.body);

    assert.deepEqual(
      body.to,
      ["buyer@example.org"],
    );

    sentCode = body.text.match(/[0-9a-f]{32}/)?.[0];

    return Response.json({
      id: "mock-email-001",
    });
  },
});

assert.equal(success.accepted, true);
assert.ok(sentCode);
assert.equal("code" in success, false);

assert.equal(
  Date.parse(success.expiresAt) - now,
  30 * 60 * 1000,
);

console.log("EMAIL_FLOW_ACCEPTED=PASS");
console.log("EMAIL_CODE_NOT_RETURNED=PASS");

await assert.rejects(
  deliverBuyerEmailCode({
    ...base,
    now: now + 1000,
    fetcher: async () => {
      throw new Error("SHOULD_NOT_SEND");
    },
  }),
  /NFT_EMAIL_COOLDOWN_ACTIVE/,
);

console.log("EMAIL_FLOW_COOLDOWN=PASS");

await assert.rejects(
  deliverBuyerEmailCode({
    ...base,
    now: now + 60000,
    fetcher: async () =>
      new Response("error", { status: 503 }),
  }),
  /NFT_EMAIL_DELIVERY_UNAVAILABLE/,
);

const codes = db.prepare(`
  SELECT status
  FROM nft_buyer_email_codes
  WHERE membership_id = ?
  ORDER BY created_at ASC
`).all(membershipId);

assert.equal(codes.length, 2);
assert.equal(codes[0].status, "REVOKED");
assert.equal(codes[1].status, "REVOKED");

console.log("FAILED_DELIVERY_CODE_REVOKED=PASS");

const reservations = db.prepare(`
  SELECT SUM(request_count) AS count
  FROM nft_email_rate_limits
  WHERE membership_id = ?
`).get(membershipId);

assert.equal(reservations.count, 2);

console.log("EMAIL_RATE_RESERVATIONS=PASS");

const ready = db.prepare(`
  SELECT COUNT(*) AS count
  FROM nft_mint_jobs
  WHERE status = 'READY'
`).get();

assert.equal(ready.count, 0);

const deliveries = db.prepare(`
  SELECT status, provider_message_id AS providerMessageId
  FROM nft_email_deliveries
  WHERE membership_id = ?
  ORDER BY prepared_at ASC
`).all(membershipId);

assert.equal(deliveries.length, 2);
assert.equal(deliveries[0].status, "ACCEPTED");
assert.equal(deliveries[0].providerMessageId, "mock-email-001");
assert.equal(deliveries[1].status, "FAILED");

console.log("EMAIL_DELIVERY_AUDIT_STATES=PASS");

const auditColumns = db.prepare(`
  PRAGMA table_info(nft_email_deliveries)
`).all().map(row => row.name);

assert.equal(auditColumns.includes("code"), false);
assert.equal(auditColumns.includes("api_key"), false);

console.log("EMAIL_DELIVERY_NO_SECRET_COLUMNS=PASS");

/*
 * A failure to record PREPARED must roll back both
 * the code issuance and the rate-limit reservation.
 */
db.exec(`
  CREATE TRIGGER nft_audit_test_failure
  BEFORE INSERT ON nft_email_deliveries
  BEGIN
    SELECT RAISE(ABORT, 'NFT_TEST_AUDIT_INSERT_FAILED');
  END;
`);

try {
  await assert.rejects(
    deliverBuyerEmailCode({
      ...base,
      now: now + 120000,
      fetcher: async () => {
        throw new Error("NETWORK_SHOULD_NOT_RUN");
      },
    }),
    /NFT_TEST_AUDIT_INSERT_FAILED/,
  );
} finally {
  db.exec("DROP TRIGGER nft_audit_test_failure");
}

assert.equal(
  db.prepare(`
    SELECT SUM(request_count) AS total
    FROM nft_email_rate_limits
    WHERE membership_id = ?
  `).get(membershipId).total,
  2,
);

assert.equal(
  db.prepare(`
    SELECT COUNT(*) AS total
    FROM nft_buyer_email_codes
    WHERE membership_id = ?
  `).get(membershipId).total,
  2,
);

console.log("EMAIL_AUDIT_ATOMIC_ROLLBACK=PASS");

console.log("EMAIL_FLOW_NO_MINT_AUTHORITY=PASS");
console.log("NFT_BUYER_EMAIL_FLOW_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
