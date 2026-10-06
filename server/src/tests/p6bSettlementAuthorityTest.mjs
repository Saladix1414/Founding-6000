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

async function expectError(
  fn,
  expected,
) {
  let received = null;

  try {
    await fn();
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

class Cursor {
  constructor(rows = []) {
    this.rows = rows;
    this.index = 0;
  }

  toArray() {
    const result =
      this.rows.slice(
        this.index,
      );

    this.index =
      this.rows.length;

    return result;
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

function createHarness() {
  const db =
    new DatabaseSync(
      ":memory:",
    );

  const storage =
    new NodeStorage(
      db,
    );

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

  return {
    db,
    commerce,
  };
}

function createPreparedPayment(
  commerce,
  suffix,
  email,
) {
  const order =
    commerce.createOrder({
      email,

      idempotencyKey:
        `settlement-order-${suffix}`,
    });

  const attempt =
    commerce.createUsdtAttempt({
      orderPublicId:
        order.order.publicId,

      idempotencyKey:
        `settlement-attempt-${suffix}`,
    });

  const txHash =
    `0x${suffix.repeat(64).slice(0, 64)}`;

  commerce.submitUsdtHash({
    paymentAttemptPublicId:
      attempt.attempt.publicId,

    txHash,
  });

  return {
    order:
      order.order,

    attempt:
      attempt.attempt,

    txHash,
  };
}

function verifiedTransfer(
  payment,
  txHash,
  overrides = {},
) {
  return {
    txHash,

    chainId:
      1,

    tokenContract:
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",

    senderAddress:
      "0x1111111111111111111111111111111111111111",

    receiverAddress:
      payment.receiverAddress,

    amountMinor:
      String(
        payment.expectedAmountMinor,
      ),

    blockNumber:
      123456,

    transactionIndex:
      2,

    confirmations:
      12,

    ...overrides,
  };
}

function count(
  db,
  table,
) {
  return Number(
    db.prepare(
      `SELECT COUNT(*) AS count FROM ${table}`
    )
      .get()
      .count,
  );
}

console.log("");
console.log(
  "============================================",
);
console.log(
  " P6-B2 SETTLEMENT AUTHORITY TESTS",
);
console.log(
  "============================================",
);

/*
 * ==========================================================
 * SCENARIO A — trust boundary
 * ==========================================================
 */

{
  const {
    db,
    commerce,
  } =
    createHarness();

  try {
    const prepared =
      createPreparedPayment(
        commerce,
        "a",
        "settlement-a@example.com",
      );

    const baseTransfer =
      verifiedTransfer(
        prepared.attempt,
        prepared.txHash,
      );

    /*
     * Less than 12 confirmations.
     */
    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              confirmations:
                11,
            },
          }),

      "INSUFFICIENT_CONFIRMATIONS",
    );

    assert(
      count(
        db,
        "payment_settlements",
      ) === 0,
      "LOW_CONFIRMATION_SETTLEMENT_CREATED",
    );

    console.log(
      "CONFIRMATION_GUARD=PASS",
    );

    /*
     * Wrong receiver.
     */
    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              receiverAddress:
                "0x2222222222222222222222222222222222222222",
            },
          }),

      "SETTLEMENT_RECEIVER_MISMATCH",
    );

    console.log(
      "RECEIVER_GUARD=PASS",
    );

    /*
     * Wrong amount.
     */
    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              amountMinor:
                "49000000",
            },
          }),

      "SETTLEMENT_AMOUNT_MISMATCH",
    );

    console.log(
      "AMOUNT_GUARD=PASS",
    );

    /*
     * Wrong chain.
     */
    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              chainId:
                137,
            },
          }),

      "SETTLEMENT_CHAIN_MISMATCH",
    );

    console.log(
      "CHAIN_GUARD=PASS",
    );

    /*
     * Wrong token.
     */
    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              tokenContract:
                "0x3333333333333333333333333333333333333333",
            },
          }),

      "SETTLEMENT_TOKEN_MISMATCH",
    );

    console.log(
      "TOKEN_GUARD=PASS",
    );

    /*
     * Verified hash must equal submitted hash.
     */
    const otherHash =
      `0x${"b".repeat(64)}`;

    await expectError(
      () =>
        commerce
          .settleVerifiedUsdt({
            paymentAttemptPublicId:
              prepared.attempt.publicId,

            transfer: {
              ...baseTransfer,

              txHash:
                otherHash,
            },
          }),

      "SETTLEMENT_TX_HASH_MISMATCH",
    );

    console.log(
      "TX_HASH_BINDING=PASS",
    );

    /*
     * None of the rejected evidence may produce authority.
     */
    assert(
      count(
        db,
        "payment_settlements",
      ) === 0,
      "INVALID_EVIDENCE_CREATED_SETTLEMENT",
    );

    assert(
      count(
        db,
        "inventory_allocations",
      ) === 0,
      "INVALID_EVIDENCE_ALLOCATED_SERIAL",
    );

    assert(
      count(
        db,
        "founding_memberships",
      ) === 0,
      "INVALID_EVIDENCE_CREATED_MEMBERSHIP",
    );

    console.log(
      "INVALID_EVIDENCE_AUTHORITY=BLOCKED",
    );

    /*
     * Valid settlement.
     */
    const settled =
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            prepared.attempt.publicId,

          transfer:
            baseTransfer,
        });

    assert(
      settled
        .idempotentReplay ===
        false,
      "FIRST_SETTLEMENT_REPLAYED",
    );

    assert(
      settled.order.status ===
        "PAID",
      "ORDER_NOT_PAID",
    );

    assert(
      settled.allocation
        .serialNumber === 1,
      "FIRST_SERIAL_NOT_1",
    );

    assert(
      settled.membership
        .status ===
        "ACTIVATION_PENDING",
      "MEMBERSHIP_STATUS_INVALID",
    );

    assert(
      settled.membership
        .genesisMember ===
        true,
      "GENESIS_MEMBER_INVALID",
    );

    assert(
      count(
        db,
        "payment_settlements",
      ) === 1,
      "SETTLEMENT_COUNT_INVALID",
    );

    assert(
      count(
        db,
        "inventory_allocations",
      ) === 1,
      "ALLOCATION_COUNT_INVALID",
    );

    assert(
      count(
        db,
        "founding_memberships",
      ) === 1,
      "MEMBERSHIP_COUNT_INVALID",
    );

    console.log(
      "ATOMIC_SETTLEMENT=PASS",
    );

    /*
     * Same authoritative evidence must be safe to replay.
     */
    const replay =
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            prepared.attempt.publicId,

          transfer:
            baseTransfer,
        });

    assert(
      replay.idempotentReplay ===
        true,
      "SETTLEMENT_REPLAY_NOT_IDEMPOTENT",
    );

    assert(
      replay.allocation
        .serialNumber === 1,
      "REPLAY_CHANGED_SERIAL",
    );

    assert(
      count(
        db,
        "payment_settlements",
      ) === 1,
      "REPLAY_DUPLICATED_SETTLEMENT",
    );

    assert(
      count(
        db,
        "inventory_allocations",
      ) === 1,
      "REPLAY_DUPLICATED_SERIAL",
    );

    assert(
      count(
        db,
        "founding_memberships",
      ) === 1,
      "REPLAY_DUPLICATED_MEMBERSHIP",
    );

    console.log(
      "SETTLEMENT_REPLAY=PASS",
    );

    /*
     * Next legitimate buyer gets next unique serial.
     */
    const second =
      createPreparedPayment(
        commerce,
        "c",
        "settlement-c@example.com",
      );

    const secondSettlement =
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            second.attempt.publicId,

          transfer:
            verifiedTransfer(
              second.attempt,
              second.txHash,
            ),
        });

    assert(
      secondSettlement
        .allocation
        .serialNumber === 2,
      "SECOND_SERIAL_NOT_2",
    );

    console.log(
      "SERIAL_UNIQUENESS=PASS",
    );
  } finally {
    db.close();
  }
}

/*
 * ==========================================================
 * SCENARIO B — forced mid-transaction failure
 * ==========================================================
 */

{
  const {
    db,
    commerce,
  } =
    createHarness();

  try {
    const prepared =
      createPreparedPayment(
        commerce,
        "d",
        "rollback@example.com",
      );

    const transfer =
      verifiedTransfer(
        prepared.attempt,
        prepared.txHash,
      );

    /*
     * Force the final membership INSERT to fail after
     * settlement and inventory writes have already begun.
     */
    db.exec(`
      CREATE TRIGGER force_membership_failure
      BEFORE INSERT ON founding_memberships
      BEGIN
        SELECT RAISE(
          ABORT,
          'forced membership failure'
        );
      END;
    `);

    let failed =
      false;

    try {
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            prepared.attempt.publicId,

          transfer,
        });
    } catch {
      failed =
        true;
    }

    assert(
      failed,
      "FORCED_FAILURE_NOT_TRIGGERED",
    );

    db.exec(`
      DROP TRIGGER force_membership_failure;
    `);

    assert(
      count(
        db,
        "payment_settlements",
      ) === 0,
      "ROLLBACK_LEFT_SETTLEMENT",
    );

    assert(
      count(
        db,
        "inventory_allocations",
      ) === 0,
      "ROLLBACK_LEFT_SERIAL",
    );

    assert(
      count(
        db,
        "founding_memberships",
      ) === 0,
      "ROLLBACK_LEFT_MEMBERSHIP",
    );

    const order =
      db.prepare(`
        SELECT status
        FROM founding_orders
        WHERE public_id = ?
      `).get(
        prepared.order.publicId,
      );

    const attempt =
      db.prepare(`
        SELECT status
        FROM payment_attempts
        WHERE public_id = ?
      `).get(
        prepared.attempt.publicId,
      );

    assert(
      order.status ===
        "CREATED",
      "ROLLBACK_LEFT_ORDER_PAID",
    );

    assert(
      attempt.status ===
        "SUBMITTED",
      "ROLLBACK_LEFT_PAYMENT_VERIFIED",
    );

    console.log(
      "TRANSACTION_ROLLBACK=PASS",
    );
  } finally {
    db.close();
  }
}

/*
 * ==========================================================
 * SCENARIO C — Genesis exhaustion and phase transition
 * ==========================================================
 */

{
  const {
    db,
    commerce,
  } =
    createHarness();

  try {
    /*
     * Simulate 999 historically issued Genesis serials.
     */
    const insert =
      db.prepare(`
        INSERT INTO inventory_allocations (
          id,
          phase_id,
          order_id,
          serial_number,
          settlement_reference,
          allocated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

    for (
      let serial = 1;
      serial <= 999;
      serial += 1
    ) {
      insert.run(
        `historical-${serial}`,
        "phase-genesis",
        `historical-order-${serial}`,
        serial,
        `historical-settlement-${serial}`,
        "2026-01-01T00:00:00.000Z",
      );
    }

    const finalGenesis =
      createPreparedPayment(
        commerce,
        "e",
        "genesis-final@example.com",
      );

    assert(
      finalGenesis.order
        .referencePriceUsd ===
        50,
      "FINAL_GENESIS_PRICE_INVALID",
    );

    const finalSettlement =
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            finalGenesis
              .attempt.publicId,

          transfer:
            verifiedTransfer(
              finalGenesis.attempt,
              finalGenesis.txHash,
            ),
        });

    assert(
      finalSettlement
        .allocation
        .serialNumber ===
        1000,
      "FINAL_GENESIS_SERIAL_INVALID",
    );

    assert(
      finalSettlement
        .allocation
        .phaseTransitioned ===
        true,
      "GENESIS_PHASE_NOT_TRANSITIONED",
    );

    const phases =
      db.prepare(`
        SELECT
          code,
          active

        FROM campaign_phases

        ORDER BY position
      `).all();

    assert(
      phases[0].active === 0,
      "GENESIS_STILL_ACTIVE",
    );

    assert(
      phases[1].active === 1,
      "EARLY_ACCESS_NOT_ACTIVE",
    );

    console.log(
      "GENESIS_1000_TRANSITION=PASS",
    );

    /*
     * Next buyer must automatically receive Early Access.
     */
    const earlyOrder =
      commerce.createOrder({
        email:
          "early-access@example.com",

        idempotencyKey:
          "early-access-order-001",
      });

    assert(
      earlyOrder.order.phase.code ===
        "EARLY_ACCESS",
      "EARLY_ACCESS_PHASE_INVALID",
    );

    assert(
      earlyOrder.order
        .referencePriceUsd ===
        70,
      "EARLY_ACCESS_PRICE_INVALID",
    );

    const earlyAttempt =
      commerce.createUsdtAttempt({
        orderPublicId:
          earlyOrder.order.publicId,

        idempotencyKey:
          "early-access-attempt-001",
      });

    assert(
      earlyAttempt.attempt
        .expectedAmountUsdt ===
        "70.000000",
      "EARLY_ACCESS_USDT_AMOUNT_INVALID",
    );

    const earlyHash =
      `0x${"f".repeat(64)}`;

    commerce.submitUsdtHash({
      paymentAttemptPublicId:
        earlyAttempt.attempt.publicId,

      txHash:
        earlyHash,
    });

    const earlySettlement =
      commerce
        .settleVerifiedUsdt({
          paymentAttemptPublicId:
            earlyAttempt
              .attempt.publicId,

          transfer:
            verifiedTransfer(
              earlyAttempt.attempt,
              earlyHash,
            ),
        });

    assert(
      earlySettlement
        .allocation
        .serialNumber ===
        1001,
      "EARLY_ACCESS_SERIAL_INVALID",
    );

    assert(
      earlySettlement
        .membership
        .genesisMember ===
        false,
      "EARLY_ACCESS_FALSE_GENESIS",
    );

    assert(
      earlySettlement
        .membership
        .foundingMember ===
        true,
      "EARLY_ACCESS_NOT_FOUNDING",
    );

    console.log(
      "EARLY_ACCESS_1001=PASS",
    );
  } finally {
    db.close();
  }
}

console.log("");
console.log(
  "============================================",
);
console.log(
  " P6-B2 PART 2 TESTS = PASS",
);
console.log(
  " REAL PUBLIC PAYMENTS = STILL CLOSED",
);
console.log(
  "============================================",
);
