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

    /*
     * Verified settlement must create exactly one
     * NFT delivery job, without minting anything.
     */
    const nftMintJobs =
      db.prepare(`
        SELECT
          membership_id AS membershipId,
          serial_number AS serialNumber,
          recipient_address AS recipientAddress,
          status
        FROM nft_mint_jobs
      `).all();

    assert(
      nftMintJobs.length === 1,
      "NFT_MINT_JOB_COUNT_INVALID",
    );

    assert(
      nftMintJobs[0].serialNumber === 1,
      "NFT_MINT_JOB_SERIAL_INVALID",
    );

    assert(
      nftMintJobs[0].status === "AWAITING_WALLET",
      "NFT_MINT_JOB_STATUS_INVALID",
    );

    assert(
      nftMintJobs[0].recipientAddress === null,
      "NFT_MINT_RECIPIENT_NOT_EMPTY",
    );

    console.log(
      "NFT_MINT_JOB_PERSISTED=PASS",
    );
    /*
     * Re-reading the verified payment must not
     * duplicate or change the NFT mint job.
     */
    const nftJobBeforeReplay =
      db.prepare(`
        SELECT
          id,
          membership_id AS membershipId,
          serial_number AS serialNumber,
          status
        FROM nft_mint_jobs
      `).get();

    const replayVerification =
      await callCommerce(
        `/api/payments/usdt/attempts/${publicAttemptBody.attempt.publicId}`,
      );

    assert(
      replayVerification.status === 200,
      "NFT_REPLAY_REQUEST_FAILED",
    );

    const nftJobsAfterReplay =
      db.prepare(`
        SELECT
          id,
          membership_id AS membershipId,
          serial_number AS serialNumber,
          status
        FROM nft_mint_jobs
      `).all();

    assert(
      nftJobsAfterReplay.length === 1,
      "NFT_REPLAY_DUPLICATED_JOB",
    );

    assert(
      nftJobsAfterReplay[0].id === nftJobBeforeReplay.id &&
      nftJobsAfterReplay[0].membershipId ===
        nftJobBeforeReplay.membershipId &&
      nftJobsAfterReplay[0].serialNumber ===
        nftJobBeforeReplay.serialNumber &&
      nftJobsAfterReplay[0].status ===
        "AWAITING_WALLET",
      "NFT_REPLAY_MUTATED_JOB",
    );

    console.log(
      "NFT_MINT_JOB_REPLAY=PASS",
    );
    /*
     * Invoke the actual settlement method again using
     * stored verified blockchain evidence.
     * No network request or real transaction.
     */
    const existingPayment =
      db.prepare(`
        SELECT evidence_json AS evidenceJson
        FROM payment_settlements
        LIMIT 1
      `).get();

    assert(
      existingPayment?.evidenceJson,
      "NFT_SETTLEMENT_EVIDENCE_MISSING",
    );

    const internalReplay =
      core.commerce.settleVerifiedUsdt({
        paymentAttemptPublicId:
          publicAttemptBody.attempt.publicId,
        transfer:
          JSON.parse(existingPayment.evidenceJson),
      });

    assert(
      internalReplay.idempotentReplay === true,
      "NFT_INTERNAL_REPLAY_NOT_IDEMPOTENT",
    );

    const replayCounts =
      db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM payment_settlements)
            AS settlements,
          (SELECT COUNT(*) FROM inventory_allocations)
            AS allocations,
          (SELECT COUNT(*) FROM founding_memberships)
            AS memberships,
          (SELECT COUNT(*) FROM nft_mint_jobs)
            AS jobs
      `).get();

    assert(
      replayCounts.settlements === 1 &&
      replayCounts.allocations === 1 &&
      replayCounts.memberships === 1 &&
      replayCounts.jobs === 1,
      "NFT_INTERNAL_REPLAY_DUPLICATED_STATE",
    );

    console.log(
      "NFT_INTERNAL_SETTLEMENT_REPLAY=PASS",
    );
    /*
     * Simulate another paid order. Trigger failure
     * precisely at NFT job insertion, proving that
     * SQLite reverses the entire settlement.
     */
    const rollbackOrderResponse =
      await callCommerce("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "nft-rollback-order-001",
        },
        body: JSON.stringify({
          email: "nft-rollback@example.com",
        }),
      });

    assert(
      rollbackOrderResponse.status === 201,
      "NFT_ROLLBACK_ORDER_CREATION_FAILED",
    );

    const rollbackOrder =
      await rollbackOrderResponse.json();

    const rollbackAttemptResponse =
      await callCommerce("/api/payments/usdt/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "nft-rollback-attempt-001",
        },
        body: JSON.stringify({
          orderPublicId: rollbackOrder.order.publicId,
        }),
      });

    assert(
      rollbackAttemptResponse.status === 201,
      "NFT_ROLLBACK_ATTEMPT_CREATION_FAILED",
    );

    const rollbackAttempt =
      await rollbackAttemptResponse.json();

    const rollbackHash =
      `0x${"d".repeat(64)}`;

    const rollbackSubmission =
      await callCommerce(
        `/api/payments/usdt/attempts/${rollbackAttempt.attempt.publicId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txHash: rollbackHash,
          }),
        },
      );

    assert(
      rollbackSubmission.status === 200,
      "NFT_ROLLBACK_HASH_SUBMISSION_FAILED",
    );

    const rollbackTransfer = {
      ...JSON.parse(existingPayment.evidenceJson),
      txHash: rollbackHash,
      receiverAddress:
        rollbackAttempt.attempt.receiverAddress,
    };

    const countsBeforeFailure = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM payment_settlements) AS settlements,
        (SELECT COUNT(*) FROM inventory_allocations) AS allocations,
        (SELECT COUNT(*) FROM founding_memberships) AS memberships,
        (SELECT COUNT(*) FROM nft_mint_jobs) AS jobs
    `).get();

    db.exec(`
      CREATE TRIGGER nft_test_reject_insert
      BEFORE INSERT ON nft_mint_jobs
      BEGIN
        SELECT RAISE(ABORT, 'NFT_TEST_FORCED_FAILURE');
      END;
    `);

    let rollbackRejected = false;

    try {
      core.commerce.settleVerifiedUsdt({
        paymentAttemptPublicId:
          rollbackAttempt.attempt.publicId,
        transfer: rollbackTransfer,
      });
    } catch (error) {
      rollbackRejected =
        String(error).includes("NFT_TEST_FORCED_FAILURE");

      if (!rollbackRejected) {
        throw error;
      }
    } finally {
      db.exec("DROP TRIGGER nft_test_reject_insert");
    }

    assert(
      rollbackRejected,
      "NFT_MINT_FAILURE_NOT_PROPAGATED",
    );

    const countsAfterFailure = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM payment_settlements) AS settlements,
        (SELECT COUNT(*) FROM inventory_allocations) AS allocations,
        (SELECT COUNT(*) FROM founding_memberships) AS memberships,
        (SELECT COUNT(*) FROM nft_mint_jobs) AS jobs
    `).get();

    assert(
      JSON.stringify(countsAfterFailure) ===
        JSON.stringify(countsBeforeFailure),
      "NFT_SETTLEMENT_PARTIAL_COMMIT",
    );

    const rollbackOrderState = db.prepare(`
      SELECT status
      FROM founding_orders
      WHERE public_id = ?
    `).get(rollbackOrder.order.publicId);

    assert(
      rollbackOrderState?.status === "CREATED",
      "NFT_ROLLBACK_ORDER_BECAME_PAID",
    );

    const recoveredSettlement =
      core.commerce.settleVerifiedUsdt({
        paymentAttemptPublicId:
          rollbackAttempt.attempt.publicId,
        transfer: rollbackTransfer,
      });

    assert(
      recoveredSettlement.idempotentReplay === false &&
      recoveredSettlement.order.status === "PAID",
      "NFT_SETTLEMENT_RECOVERY_FAILED",
    );

    const countsAfterRecovery = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM payment_settlements) AS settlements,
        (SELECT COUNT(*) FROM inventory_allocations) AS allocations,
        (SELECT COUNT(*) FROM founding_memberships) AS memberships,
        (SELECT COUNT(*) FROM nft_mint_jobs) AS jobs
    `).get();

    assert(
      countsAfterRecovery.settlements ===
        countsBeforeFailure.settlements + 1 &&
      countsAfterRecovery.allocations ===
        countsBeforeFailure.allocations + 1 &&
      countsAfterRecovery.memberships ===
        countsBeforeFailure.memberships + 1 &&
      countsAfterRecovery.jobs ===
        countsBeforeFailure.jobs + 1,
      "NFT_SETTLEMENT_RECOVERY_INCOMPLETE",
    );

    console.log("NFT_MINT_SETTLEMENT_ROLLBACK=PASS");
    console.log("NFT_MINT_SETTLEMENT_RECOVERY=PASS");


    /*
     * The database must reject duplicate membership
     * and serial jobs, independently of API behavior.
     */
    const insertDuplicateJob =
      db.prepare(`
        INSERT INTO nft_mint_jobs (
          id,
          membership_id,
          order_id,
          serial_number,
          recipient_address,
          status,
          mint_tx_hash,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, NULL, 'AWAITING_WALLET', NULL, ?, ?)
      `);

    const jobTime =
      new Date().toISOString();

    let duplicateMembershipBlocked =
      false;

    try {
      insertDuplicateJob.run(
        "test_duplicate_membership",
        nftJobBeforeReplay.membershipId,
        "test_other_order_membership",
        6000,
        jobTime,
        jobTime,
      );
    } catch (error) {
      duplicateMembershipBlocked =
        /UNIQUE|constraint/i.test(String(error));
      if (!duplicateMembershipBlocked) throw error;
    }

    assert(
      duplicateMembershipBlocked,
      "NFT_DUPLICATE_MEMBERSHIP_ALLOWED",
    );

    let duplicateSerialBlocked =
      false;

    try {
      insertDuplicateJob.run(
        "test_duplicate_serial",
        "test_other_membership_serial",
        "test_other_order_serial",
        nftJobBeforeReplay.serialNumber,
        jobTime,
        jobTime,
      );
    } catch (error) {
      duplicateSerialBlocked =
        /UNIQUE|constraint/i.test(String(error));
      if (!duplicateSerialBlocked) throw error;
    }

    assert(
      duplicateSerialBlocked,
      "NFT_DUPLICATE_SERIAL_ALLOWED",
    );

    const finalJobCount =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM nft_mint_jobs
      `).get().count;

    assert(
      finalJobCount === countsAfterRecovery.jobs,
      "NFT_UNIQUENESS_CHANGED_JOB_COUNT",
    );

    console.log(
      "NFT_MINT_JOB_UNIQUENESS=PASS",
    );



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


    /*
     * A later GET must recover the authoritative result,
     * not only the VERIFIED status.
     */
    const reread =
      await callCommerce(
        `/api/payments/usdt/attempts/${publicAttemptBody.attempt.publicId}`,
      );

    assert(
      reread.status === 200,
      "VERIFIED_REREAD_FAILED",
    );

    const rereadBody =
      await reread.json();

    assert(
      rereadBody
        .paymentVerified ===
        true,
      "VERIFIED_REREAD_PAYMENT_FALSE",
    );

    assert(
      rereadBody
        .allocation
        ?.serialNumber ===
        1,
      "VERIFIED_REREAD_SERIAL_MISSING",
    );

    assert(
      rereadBody
        .membership
        ?.status ===
        "ACTIVATION_PENDING",
      "VERIFIED_REREAD_MEMBERSHIP_MISSING",
    );

    console.log(
      "VERIFIED_RESULT_REREAD=PASS",
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
