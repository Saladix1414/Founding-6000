import {
  DatabaseSync,
} from "node:sqlite";

import {
  CommerceCore,
} from "../../../cloudflare/commerceCore.mjs";

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

class Cursor {
  constructor(rows = []) {
    this.rows = rows;
    this.index = 0;
  }

  toArray() {
    const remaining =
      this.rows.slice(
        this.index,
      );

    this.index =
      this.rows.length;

    return remaining;
  }

  one() {
    const rows =
      this.toArray();

    if (rows.length !== 1) {
      throw new Error(
        "CURSOR_EXPECTED_ONE_ROW",
      );
    }

    return rows[0];
  }

  [Symbol.iterator]() {
    return {
      next: () => {
        if (
          this.index >=
          this.rows.length
        ) {
          return {
            done: true,
          };
        }

        const value =
          this.rows[
            this.index
          ];

        this.index += 1;

        return {
          done: false,
          value,
        };
      },
    };
  }
}

class NodeSqlAdapter {
  constructor(db) {
    this.db = db;
  }

  exec(
    query,
    ...bindings
  ) {
    const trimmed =
      query.trim();

    const statements =
      trimmed
        .split(";")
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean);

    if (
      bindings.length === 0 &&
      statements.length > 1
    ) {
      this.db.exec(
        query,
      );

      return new Cursor();
    }

    const statement =
      this.db.prepare(
        query,
      );

    const command =
      trimmed
        .match(
          /^([A-Za-z]+)/,
        )
        ?.[1]
        ?.toUpperCase();

    if (
      [
        "SELECT",
        "WITH",
        "PRAGMA",
        "EXPLAIN",
      ].includes(
        command,
      )
    ) {
      return new Cursor(
        statement.all(
          ...bindings,
        ),
      );
    }

    statement.run(
      ...bindings,
    );

    return new Cursor();
  }
}

class NodeStorage {
  constructor(db) {
    this.db = db;

    this.sql =
      new NodeSqlAdapter(
        db,
      );
  }

  transactionSync(
    callback,
  ) {
    this.db.exec(
      "BEGIN IMMEDIATE",
    );

    try {
      const result =
        callback();

      this.db.exec(
        "COMMIT",
      );

      return result;
    } catch (error) {
      try {
        this.db.exec(
          "ROLLBACK",
        );
      } catch {
        // Best effort.
      }

      throw error;
    }
  }
}

function expectError(
  fn,
  expected,
) {
  let received = null;

  try {
    fn();
  } catch (error) {
    received =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    received === expected,
    `EXPECTED_${expected}_GOT_${received}`,
  );
}

const db =
  new DatabaseSync(
    ":memory:",
  );

const storage =
  new NodeStorage(
    db,
  );

/*
 * commerceCore writes audit events into the canonical
 * FoundingCore audit table.
 */
db.exec(`
  CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const commerce =
  new CommerceCore(
    storage,
  );

commerce.initializeSchema();

try {
  console.log("");
  console.log(
    "============================================",
  );
  console.log(
    " P6-A2 CLOUDFLARE COMMERCE CORE TESTS",
  );
  console.log(
    "============================================",
  );

  /*
   * -------------------------------------------------------
   * 1. Campaign bootstrap
   * -------------------------------------------------------
   */

  const phases =
    db.prepare(`
      SELECT
        code,
        capacity,
        reference_price_usd AS price,
        serial_start AS serialStart,
        serial_end AS serialEnd,
        active

      FROM campaign_phases

      ORDER BY position
    `).all();

  assert(
    phases.length === 3,
    "PHASE_COUNT_INVALID",
  );

  assert(
    phases[0].code ===
      "GENESIS",
    "GENESIS_MISSING",
  );

  assert(
    phases[0].price === 50,
    "GENESIS_PRICE_NOT_50",
  );

  assert(
    phases[0].capacity ===
      1000,
    "GENESIS_CAPACITY_INVALID",
  );

  assert(
    phases[0].serialStart ===
      1 &&
    phases[0].serialEnd ===
      1000,
    "GENESIS_SERIAL_RANGE_INVALID",
  );

  assert(
    phases[0].active === 1,
    "GENESIS_NOT_ACTIVE",
  );

  console.log(
    "CAMPAIGN_BOOTSTRAP=PASS",
  );

  /*
   * -------------------------------------------------------
   * 2. Order creation
   * -------------------------------------------------------
   */

  const order1 =
    commerce.createOrder({
      email:
        "Founder.One@example.com",

      idempotencyKey:
        "p6a-order-founder-one",
    });

  assert(
    order1.idempotentReplay ===
      false,
    "ORDER_FIRST_CALL_REPLAYED",
  );

  assert(
    order1.order
      .referencePriceUsd ===
      50,
    "ORDER_PRICE_INVALID",
  );

  assert(
    order1.order.phase.code ===
      "GENESIS",
    "ORDER_PHASE_INVALID",
  );

  assert(
    /^F6K-[A-F0-9]{12}$/
      .test(
        order1.order.publicId,
      ),
    "ORDER_PUBLIC_ID_INVALID",
  );

  console.log(
    "ORDER_CREATION=PASS",
  );

  /*
   * -------------------------------------------------------
   * 3. Order idempotency
   * -------------------------------------------------------
   */

  const orderReplay =
    commerce.createOrder({
      email:
        "founder.one@example.com",

      idempotencyKey:
        "p6a-order-founder-one",
    });

  assert(
    orderReplay
      .idempotentReplay ===
      true,
    "ORDER_REPLAY_NOT_IDEMPOTENT",
  );

  assert(
    orderReplay.order.publicId ===
      order1.order.publicId,
    "ORDER_REPLAY_CHANGED_ID",
  );

  expectError(
    () =>
      commerce.createOrder({
        email:
          "different@example.com",

        idempotencyKey:
          "p6a-order-founder-one",
      }),

    "IDEMPOTENCY_KEY_CONFLICT",
  );

  console.log(
    "ORDER_IDEMPOTENCY=PASS",
  );

  /*
   * -------------------------------------------------------
   * 4. USDT attempt
   * -------------------------------------------------------
   */

  const attempt1 =
    commerce.createUsdtAttempt({
      orderPublicId:
        order1.order.publicId,

      idempotencyKey:
        "p6a-usdt-attempt-one",
    });

  assert(
    attempt1
      .idempotentReplay ===
      false,
    "ATTEMPT_FIRST_CALL_REPLAYED",
  );

  const payment =
    attempt1.attempt;

  assert(
    payment.network ===
      "ethereum-mainnet",
    "USDT_NETWORK_INVALID",
  );

  assert(
    payment.chainId === 1,
    "USDT_CHAIN_INVALID",
  );

  assert(
    payment.tokenContract
      .toLowerCase() ===
      "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "USDT_CONTRACT_INVALID",
  );

  assert(
    payment.tokenDecimals ===
      6,
    "USDT_DECIMALS_INVALID",
  );

  assert(
    payment.receiverAddress
      .toLowerCase() ===
      "0xe695bc03a11d5de3f5e38b4acb66d13aede3b840",
    "USDT_RECEIVER_INVALID",
  );

  assert(
    payment.expectedAmountMinor ===
      50_000_000,
    "USDT_MINOR_AMOUNT_INVALID",
  );

  assert(
    payment.expectedAmountUsdt ===
      "50.000000",
    "USDT_FORMATTED_AMOUNT_INVALID",
  );

  assert(
    payment.status ===
      "AWAITING_TRANSFER",
    "ATTEMPT_INITIAL_STATUS_INVALID",
  );

  console.log(
    "USDT_ATTEMPT=PASS",
  );

  /*
   * -------------------------------------------------------
   * 5. Attempt idempotency
   * -------------------------------------------------------
   */

  const attemptReplay =
    commerce.createUsdtAttempt({
      orderPublicId:
        order1.order.publicId,

      idempotencyKey:
        "p6a-usdt-attempt-one",
    });

  assert(
    attemptReplay
      .idempotentReplay ===
      true,
    "ATTEMPT_REPLAY_FAILED",
  );

  assert(
    attemptReplay
      .attempt.publicId ===
      payment.publicId,
    "ATTEMPT_REPLAY_CHANGED_ID",
  );

  console.log(
    "USDT_ATTEMPT_IDEMPOTENCY=PASS",
  );

  /*
   * -------------------------------------------------------
   * 6. Invalid hash rejected
   * -------------------------------------------------------
   */

  expectError(
    () =>
      commerce.submitUsdtHash({
        paymentAttemptPublicId:
          payment.publicId,

        txHash:
          "0x1234",
      }),

    "INVALID_TX_HASH",
  );

  console.log(
    "INVALID_TX_HASH_BLOCKED=PASS",
  );

  /*
   * -------------------------------------------------------
   * 7. Valid hash submission
   * -------------------------------------------------------
   */

  const hashA =
    `0x${"a".repeat(64)}`;

  const submission =
    commerce.submitUsdtHash({
      paymentAttemptPublicId:
        payment.publicId,

      txHash:
        hashA,
    });

  assert(
    submission.attempt.status ===
      "SUBMITTED",
    "HASH_NOT_SUBMITTED",
  );

  assert(
    submission
      .paymentVerified ===
      false,
    "HASH_SUBMISSION_VERIFIED_PAYMENT",
  );

  assert(
    submission
      .settlementCreated ===
      false,
    "HASH_SUBMISSION_CREATED_SETTLEMENT",
  );

  console.log(
    "TX_HASH_SUBMISSION=PASS",
  );

  /*
   * -------------------------------------------------------
   * 8. Same hash safe replay
   * -------------------------------------------------------
   */

  const submissionReplay =
    commerce.submitUsdtHash({
      paymentAttemptPublicId:
        payment.publicId,

      txHash:
        hashA.toUpperCase()
          .replace(
            "0X",
            "0x",
          ),
    });

  assert(
    submissionReplay
      .idempotentReplay ===
      true,
    "TX_REPLAY_NOT_IDEMPOTENT",
  );

  assert(
    submissionReplay
      .paymentVerified ===
      false,
    "TX_REPLAY_VERIFIED_PAYMENT",
  );

  console.log(
    "TX_HASH_REPLAY=PASS",
  );

  /*
   * -------------------------------------------------------
   * 9. Hash becomes immutable
   * -------------------------------------------------------
   */

  const hashB =
    `0x${"b".repeat(64)}`;

  expectError(
    () =>
      commerce.submitUsdtHash({
        paymentAttemptPublicId:
          payment.publicId,

        txHash:
          hashB,
      }),

    "PAYMENT_ATTEMPT_HASH_LOCKED",
  );

  console.log(
    "TX_HASH_IMMUTABILITY=PASS",
  );

  /*
   * -------------------------------------------------------
   * 10. Hash cannot belong to another payment
   * -------------------------------------------------------
   */

  const order2 =
    commerce.createOrder({
      email:
        "founder.two@example.com",

      idempotencyKey:
        "p6a-order-founder-two",
    });

  const attempt2 =
    commerce.createUsdtAttempt({
      orderPublicId:
        order2.order.publicId,

      idempotencyKey:
        "p6a-usdt-attempt-two",
    });

  expectError(
    () =>
      commerce.submitUsdtHash({
        paymentAttemptPublicId:
          attempt2.attempt
            .publicId,

        txHash:
          hashA,
      }),

    "TX_HASH_ALREADY_SUBMITTED",
  );

  console.log(
    "CROSS_PAYMENT_TX_REUSE_BLOCKED=PASS",
  );

  /*
   * -------------------------------------------------------
   * 11. Critical trust boundary
   * -------------------------------------------------------
   *
   * A submitted tx hash is evidence only.
   * At this phase it MUST NOT:
   *
   * - create a settlement;
   * - mark an order PAID;
   * - allocate a serial;
   * - create a membership.
   */

  const settlements =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM payment_settlements
    `).get().count;

  const allocations =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM inventory_allocations
    `).get().count;

  const memberships =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM founding_memberships
    `).get().count;

  const storedOrder =
    db.prepare(`
      SELECT status
      FROM founding_orders
      WHERE public_id = ?
    `).get(
      order1.order.publicId,
    );

  assert(
    settlements === 0,
    "UNVERIFIED_SETTLEMENT_CREATED",
  );

  assert(
    allocations === 0,
    "UNVERIFIED_SERIAL_ALLOCATED",
  );

  assert(
    memberships === 0,
    "UNVERIFIED_MEMBERSHIP_CREATED",
  );

  assert(
    storedOrder.status ===
      "CREATED",
    "UNVERIFIED_ORDER_MARKED_PAID",
  );

  console.log(
    "UNVERIFIED_SETTLEMENT=BLOCKED",
  );

  console.log(
    "UNVERIFIED_SERIAL_ALLOCATION=BLOCKED",
  );

  console.log(
    "UNVERIFIED_MEMBERSHIP=BLOCKED",
  );

  /*
   * -------------------------------------------------------
   * 12. Audit evidence
   * -------------------------------------------------------
   */

  const auditTypes =
    db.prepare(`
      SELECT event_type AS eventType
      FROM audit_events
      ORDER BY created_at ASC
    `).all()
      .map(
        (row) =>
          row.eventType,
      );

  assert(
    auditTypes.includes(
      "FOUNDING_ORDER_CREATED",
    ),
    "ORDER_AUDIT_MISSING",
  );

  assert(
    auditTypes.includes(
      "USDT_PAYMENT_ATTEMPT_CREATED",
    ),
    "PAYMENT_AUDIT_MISSING",
  );

  assert(
    auditTypes.includes(
      "USDT_TX_HASH_SUBMITTED",
    ),
    "HASH_AUDIT_MISSING",
  );

  console.log(
    "AUDIT_EVIDENCE=PASS",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " P6-A2 TESTS = PASS",
  );

  console.log(
    " PAYMENT AUTHORITY = STILL CLOSED",
  );

  console.log(
    "============================================",
  );
} finally {
  db.close();
}
