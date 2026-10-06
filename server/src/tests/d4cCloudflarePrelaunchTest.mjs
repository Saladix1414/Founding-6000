import {
  DatabaseSync,
} from "node:sqlite";

import {
  readFileSync,
} from "node:fs";

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
  constructor(
    rows = [],
  ) {
    this.rows = rows;
    this.index = 0;
  }

  next() {
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

    if (
      rows.length !== 1
    ) {
      throw new Error(
        "CURSOR_EXPECTED_ONE_ROW",
      );
    }

    return rows[0];
  }

  [Symbol.iterator]() {
    return this;
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

async function loadFoundingCore() {
  const commerceSource =
    readFileSync(
      "cloudflare/commerceCore.mjs",
      "utf8",
    );

  const commerceEncoded =
    Buffer
      .from(
        commerceSource,
      )
      .toString(
        "base64",
      );

  const commerceUrl =
    `data:text/javascript;base64,${commerceEncoded}`;

  let source =
    readFileSync(
      "cloudflare/foundingCore.mjs",
      "utf8",
    );

  source =
    source.replace(
      'import { DurableObject } from "cloudflare:workers";',
      `
class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
`,
    );

  source =
    source.replace(
      `import {
  CommerceCore,
  commerceErrorStatus,
} from "./commerceCore.mjs";`,
      `import {
  CommerceCore,
  commerceErrorStatus,
} from "${commerceUrl}";`,
    );

  const encoded =
    Buffer
      .from(source)
      .toString(
        "base64",
      );

  const module =
    await import(
      `data:text/javascript;base64,${encoded}`
    );

  return module.FoundingCore;
}

async function loadWorker() {
  let verifierSource =
    readFileSync(
      "cloudflare/usdtRpcVerifier.mjs",
      "utf8",
    );

  verifierSource =
    verifierSource.replace(
      "export async function verifyUsdtOnEthereum(",
      "async function verifyUsdtOnEthereum(",
    );

  let source =
    readFileSync(
      "cloudflare/worker.mjs",
      "utf8",
    );

  source =
    source.replace(
      `import {
  FoundingCore,
} from "./foundingCore.mjs";

`,
      "",
    );

  source =
    source.replace(
      `export {
  FoundingCore,
};

`,
      "",
    );

  source =
    source.replace(
      `import {
  verifyUsdtOnEthereum,
} from "./usdtRpcVerifier.mjs";

`,
      "",
    );

  source =
    `${verifierSource}

${source}`;

  const encoded =
    Buffer
      .from(source)
      .toString(
        "base64",
      );

  const module =
    await import(
      `data:text/javascript;base64,${encoded}`
    );

  return module.default;
}

const db =
  new DatabaseSync(
    ":memory:",
  );

const storage =
  new NodeStorage(
    db,
  );

const FoundingCore =
  await loadFoundingCore();

const core =
  new FoundingCore(
    {
      storage,
    },
    {},
  );

const worker =
  await loadWorker();

const env = {
  FOUNDING_CORE: {
    idFromName(name) {
      return name;
    },

    get() {
      return core;
    },
  },

  ASSETS: {
    async fetch() {
      return new Response(
        "STATIC_ASSET_OK",
        {
          status: 200,
        },
      );
    },
  },
};

async function call(
  path,
  options = {},
) {
  const request =
    new Request(
      `https://founding.test${path}`,
      options,
    );

  return worker.fetch(
    request,
    env,
  );
}

/*
 * Freeze time so the rate-limit test cannot cross
 * into another minute bucket while it runs.
 */
const RealDate =
  globalThis.Date;

const fixedTime =
  RealDate.parse(
    "2026-10-06T03:30:00.000Z",
  );

class FixedDate extends RealDate {
  constructor(
    ...args
  ) {
    if (
      args.length === 0
    ) {
      super(
        fixedTime,
      );

      return;
    }

    super(
      ...args,
    );
  }

  static now() {
    return fixedTime;
  }
}

globalThis.Date =
  FixedDate;

try {
  const health =
    await call(
      "/api/health",
    );

  assert(
    health.status === 200,
    "HEALTH_STATUS_INVALID",
  );

  const healthBody =
    await health.json();

  assert(
    healthBody.database ===
      "ok",
    "HEALTH_DATABASE_NOT_OK",
  );

  assert(
    healthBody.checkout ===
      "closed",
    "CHECKOUT_NOT_CLOSED",
  );

  assert(
    healthBody.payments ===
      "disabled",
    "PAYMENTS_NOT_DISABLED",
  );

  console.log(
    "HEALTH=PASS",
  );

  const ready =
    await call(
      "/api/health/ready",
    );

  assert(
    ready.status === 200,
    "READINESS_STATUS_INVALID",
  );

  console.log(
    "READINESS=PASS",
  );

  const invalidEmail =
    await call(
      "/api/email-registrations",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "CF-Connecting-IP":
            "198.51.100.1",
        },

        body:
          JSON.stringify({
            email:
              "invalid",
          }),
      },
    );

  assert(
    invalidEmail.status ===
      400,
    "INVALID_EMAIL_NOT_REJECTED",
  );

  console.log(
    "INVALID_EMAIL=PASS",
  );

  const registration =
    await call(
      "/api/email-registrations",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "CF-Connecting-IP":
            "198.51.100.10",

          "User-Agent":
            "D4C-PERSISTENCE",
        },

        body:
          JSON.stringify({
            email:
              "Founder@Test.Example",
          }),
      },
    );

  assert(
    registration.status ===
      201,
    "EMAIL_REGISTRATION_FAILED",
  );

  const stored =
    db.prepare(`
      SELECT
        email,
        normalized_email AS normalizedEmail,
        source
      FROM email_registrations
      WHERE normalized_email = ?
    `)
      .get(
        "founder@test.example",
      );

  assert(
    stored,
    "EMAIL_NOT_PERSISTED",
  );

  assert(
    stored.source ===
      "FOUNDING_6000_PRELAUNCH",
    "EMAIL_SOURCE_INVALID",
  );

  assert(
    stored.normalizedEmail ===
      "founder@test.example",
    "EMAIL_NORMALIZATION_INVALID",
  );

  console.log(
    "EMAIL_PERSISTENCE=PASS",
  );

  const audit =
    db.prepare(`
      SELECT
        event_type AS eventType,
        entity_type AS entityType
      FROM audit_events
      ORDER BY rowid DESC
      LIMIT 1
    `)
      .get();

  assert(
    audit?.eventType ===
      "EMAIL_REGISTERED",
    "AUDIT_EVENT_MISSING",
  );

  assert(
    audit?.entityType ===
      "EMAIL_REGISTRATION",
    "AUDIT_ENTITY_INVALID",
  );

  console.log(
    "AUDIT_EVENT=PASS",
  );

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    const response =
      await call(
        "/api/email-registrations",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "CF-Connecting-IP":
              "203.0.113.50",

            "User-Agent":
              "D4C-RATE-LIMIT",
          },

          body:
            JSON.stringify({
              email:
                `rate-${index}@example.com`,
            }),
        },
      );

    assert(
      response.status ===
        201,
      `RATE_REQUEST_${index + 1}_FAILED`,
    );
  }

  const limited =
    await call(
      "/api/email-registrations",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "CF-Connecting-IP":
            "203.0.113.50",

          "User-Agent":
            "D4C-RATE-LIMIT",
        },

        body:
          JSON.stringify({
            email:
              "rate-11@example.com",
          }),
      },
    );

  assert(
    limited.status ===
      429,
    "RATE_LIMIT_NOT_ENFORCED",
  );

  console.log(
    "RATE_LIMIT_10_PER_MINUTE=PASS",
  );

  const rateRows =
    db.prepare(`
      SELECT actor_hash AS actorHash
      FROM prelaunch_rate_limits
    `)
      .all();

  assert(
    rateRows.length > 0,
    "RATE_HASHES_MISSING",
  );

  assert(
    rateRows.every(
      (row) =>
        /^[a-f0-9]{64}$/
          .test(
            row.actorHash,
          ),
    ),
    "RAW_IP_OR_INVALID_HASH_STORED",
  );

  console.log(
    "RAW_IP_PERSISTENCE=NO",
  );

  const beforeRollback =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM email_registrations
    `)
      .get()
      .count;

  db.exec(`
    CREATE TRIGGER force_audit_failure
    BEFORE INSERT ON audit_events
    BEGIN
      SELECT RAISE(
        ABORT,
        'forced audit failure'
      );
    END;
  `);

  let rollbackTriggered =
    false;

  try {
    core.registerPrelaunch({
      email:
        "rollback@example.com",

      actorHash:
        "f".repeat(64),
    });
  } catch {
    rollbackTriggered =
      true;
  }

  db.exec(`
    DROP TRIGGER force_audit_failure;
  `);

  assert(
    rollbackTriggered,
    "ROLLBACK_FAILURE_NOT_TRIGGERED",
  );

  const afterRollback =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM email_registrations
    `)
      .get()
      .count;

  assert(
    afterRollback ===
      beforeRollback,
    "TRANSACTION_DID_NOT_ROLL_BACK",
  );

  console.log(
    "TRANSACTION_ROLLBACK=PASS",
  );

  const order =
    await call(
      "/api/orders",
      {
        method:
          "POST",
      },
    );

  assert(
    order.status === 503,
    "ORDER_ROUTE_NOT_CLOSED",
  );

  console.log(
    "ORDERS_FAIL_CLOSED=PASS",
  );

  const usdt =
    await call(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",
      },
    );

  assert(
    usdt.status === 503,
    "USDT_ROUTE_NOT_CLOSED",
  );

  console.log(
    "USDT_FAIL_CLOSED=PASS",
  );

  const tables =
    db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `)
      .all()
      .map(
        (row) =>
          row.name,
      );

  const expectedCommerceTables = [
    "campaign_phases",
    "founding_orders",
    "payment_attempts",
    "payment_settlements",
    "inventory_allocations",
    "founding_memberships",
  ];

  for (
    const table of
      expectedCommerceTables
  ) {
    assert(
      tables.includes(
        table,
      ),
      `EXPECTED_COMMERCE_TABLE_MISSING_${table}`,
    );
  }

  console.log(
    "COMMERCE_TABLES_MIGRATED=YES",
  );

  console.log(
    "PUBLIC_COMMERCE_GATE=CLOSED",
  );

  /*
   * -------------------------------------------------------
   * P6-A3 bridge simulation
   * -------------------------------------------------------
   *
   * This does NOT change Wrangler production flags.
   * We enable the gates only inside this in-memory test.
   */

  const commerceEnv = {
    ...env,

    PUBLIC_CHECKOUT_ENABLED:
      "true",

    PAYMENT_READINESS:
      "true",

    REAL_PAYMENTS_ENABLED:
      "true",

    CLOUDFLARE_USDT_API_ENABLED:
      "true",
  };

  async function callCommerce(
    path,
    options = {},
  ) {
    const request =
      new Request(
        `https://founding.test${path}`,
        options,
      );

    return worker.fetch(
      request,
      commerceEnv,
    );
  }

  const publicOrder =
    await callCommerce(
      "/api/orders",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "p6a3-public-order-001",
        },

        body:
          JSON.stringify({
            email:
              "p6a3@example.com",
          }),
      },
    );

  assert(
    publicOrder.status === 201,
    "PUBLIC_ORDER_BRIDGE_FAILED",
  );

  const publicOrderBody =
    await publicOrder.json();

  assert(
    publicOrderBody.order
      ?.referencePriceUsd === 50,
    "PUBLIC_ORDER_PRICE_INVALID",
  );

  console.log(
    "PUBLIC_ORDER_BRIDGE=PASS",
  );

  const publicAttempt =
    await callCommerce(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "p6a3-public-attempt-001",
        },

        body:
          JSON.stringify({
            orderPublicId:
              publicOrderBody
                .order.publicId,
          }),
      },
    );

  assert(
    publicAttempt.status ===
      201,
    "PUBLIC_USDT_ATTEMPT_BRIDGE_FAILED",
  );

  const publicAttemptBody =
    await publicAttempt.json();

  assert(
    publicAttemptBody.attempt
      ?.expectedAmountUsdt ===
      "50.000000",
    "PUBLIC_USDT_AMOUNT_INVALID",
  );

  assert(
    publicAttemptBody.attempt
      ?.receiverAddress
      ?.toLowerCase() ===
      "0xe695bc03a11d5de3f5e38b4acb66d13aede3b840",
    "PUBLIC_USDT_RECEIVER_INVALID",
  );

  console.log(
    "PUBLIC_USDT_ATTEMPT_BRIDGE=PASS",
  );

  const dummyHash =
    `0x${"c".repeat(64)}`;

  const publicSubmission =
    await callCommerce(
      `/api/payments/usdt/attempts/${publicAttemptBody.attempt.publicId}/submit`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            txHash:
              dummyHash,
          }),
      },
    );

  assert(
    publicSubmission.status ===
      200,
    "PUBLIC_TX_SUBMISSION_BRIDGE_FAILED",
  );

  const submissionBody =
    await publicSubmission.json();

  assert(
    submissionBody.attempt
      ?.status ===
      "SUBMITTED",
    "PUBLIC_TX_STATUS_INVALID",
  );

  assert(
    submissionBody
      .paymentVerified ===
      false,
    "PUBLIC_HASH_FALSELY_VERIFIED",
  );

  assert(
    submissionBody
      .settlementCreated ===
      false,
    "PUBLIC_HASH_CREATED_SETTLEMENT",
  );

  const settlementCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM payment_settlements
    `).get().count;

  const allocationCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM inventory_allocations
    `).get().count;

  const membershipCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM founding_memberships
    `).get().count;

  assert(
    settlementCount === 0,
    "BRIDGE_UNVERIFIED_SETTLEMENT_CREATED",
  );

  assert(
    allocationCount === 0,
    "BRIDGE_UNVERIFIED_SERIAL_CREATED",
  );

  assert(
    membershipCount === 0,
    "BRIDGE_UNVERIFIED_MEMBERSHIP_CREATED",
  );

  console.log(
    "PUBLIC_TX_SUBMISSION_BRIDGE=PASS",
  );

  console.log(
    "PUBLIC_UNVERIFIED_AUTHORITY=BLOCKED",
  );


  /*
   * -------------------------------------------------------
   * P6-B3 deterministic Ethereum verification
   * -------------------------------------------------------
   *
   * No public RPC or real blockchain transaction is used.
   */

  commerceEnv.ETHEREUM_RPC_URL =
    "https://rpc.example.test";

  const originalFetch =
    globalThis.fetch;

  globalThis.fetch =
    async (
      rpcUrl,
      init,
    ) => {
      assert(
        rpcUrl ===
          "https://rpc.example.test",
        "RPC_SECRET_TARGET_INVALID",
      );

      const rpcRequest =
        JSON.parse(
          init.body,
        );

      let result;

      if (
        rpcRequest.method ===
          "eth_chainId"
      ) {
        result =
          "0x1";
      } else if (
        rpcRequest.method ===
          "eth_getTransactionReceipt"
      ) {
        const receiver =
          publicAttemptBody
            .attempt
            .receiverAddress
            .slice(2)
            .toLowerCase()
            .padStart(
              64,
              "0",
            );

        const sender =
          "1"
            .repeat(40)
            .padStart(
              64,
              "0",
            );

        const amount =
          BigInt(
            50_000_000,
          )
            .toString(16)
            .padStart(
              64,
              "0",
            );

        result = {
          transactionHash:
            dummyHash,

          status:
            "0x1",

          blockNumber:
            "0x64",

          transactionIndex:
            "0x0",

          logs: [
            {
              address:
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",

              topics: [
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",

                `0x${sender}`,

                `0x${receiver}`,
              ],

              data:
                `0x${amount}`,
            },
          ],
        };
      } else if (
        rpcRequest.method ===
          "eth_blockNumber"
      ) {
        /*
         * Receipt block 100 → current block 111 =
         * exactly 12 confirmations.
         */
        result =
          "0x6f";
      } else {
        throw new Error(
          `UNEXPECTED_RPC_METHOD_${rpcRequest.method}`,
        );
      }

      return new Response(
        JSON.stringify({
          jsonrpc:
            "2.0",

          id:
            1,

          result,
        }),
        {
          status:
            200,

          headers: {
            "Content-Type":
              "application/json",
          },
        },
      );
    };

  try {
    const verification =
      await callCommerce(
        `/api/payments/usdt/attempts/${publicAttemptBody.attempt.publicId}`,
      );

    assert(
      verification.status ===
        200,
      "PUBLIC_ETHEREUM_VERIFICATION_FAILED",
    );

    const verifiedBody =
      await verification.json();

    assert(
      verifiedBody
        .paymentVerified ===
        true,
      "PAYMENT_NOT_VERIFIED",
    );

    assert(
      verifiedBody
        .verificationStatus ===
        "VERIFIED",
      "VERIFICATION_STATUS_INVALID",
    );

    assert(
      verifiedBody
        .order
        ?.status ===
        "PAID",
      "ORDER_NOT_PAID_AFTER_VERIFICATION",
    );

    assert(
      verifiedBody
        .allocation
        ?.serialNumber ===
        1,
      "VERIFIED_SERIAL_INVALID",
    );

    assert(
      verifiedBody
        .membership
        ?.status ===
        "ACTIVATION_PENDING",
      "VERIFIED_MEMBERSHIP_INVALID",
    );

    const verifiedSettlements =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM payment_settlements
      `).get().count;

    const verifiedAllocations =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM inventory_allocations
      `).get().count;

    const verifiedMemberships =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM founding_memberships
      `).get().count;

    assert(
      verifiedSettlements === 1,
      "VERIFIED_SETTLEMENT_NOT_PERSISTED",
    );

    assert(
      verifiedAllocations === 1,
      "VERIFIED_SERIAL_NOT_PERSISTED",
    );

    assert(
      verifiedMemberships === 1,
      "VERIFIED_MEMBERSHIP_NOT_PERSISTED",
    );

    console.log(
      "ETHEREUM_RPC_PIPELINE=PASS",
    );

    console.log(
      "VERIFIED_ORDER_PAID=PASS",
    );

    console.log(
      "VERIFIED_SERIAL_1=PASS",
    );

    console.log(
      "VERIFIED_MEMBERSHIP=PASS",
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }

  const asset =
    await call(
      "/",
    );

  assert(
    asset.status === 200,
    "STATIC_ASSET_FALLBACK_FAILED",
  );

  assert(
    await asset.text() ===
      "STATIC_ASSET_OK",
    "STATIC_ASSET_RESPONSE_INVALID",
  );

  console.log(
    "STATIC_ASSETS=PASS",
  );

  console.log("");
  console.log(
    "================================",
  );
  console.log(
    " D4-C PART 2 TESTS = PASS",
  );
  console.log(
    "================================",
  );
} finally {
  globalThis.Date =
    RealDate;

  db.close();
}
