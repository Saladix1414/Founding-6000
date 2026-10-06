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

export {
  FoundingCore,
};

`,
      "",
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

  const forbiddenTables = [
    "founding_orders",
    "inventory_allocations",
    "founding_memberships",
    "usdt_payment_attempts",
  ];

  for (
    const table of
      forbiddenTables
  ) {
    assert(
      !tables.includes(
        table,
      ),
      `FORBIDDEN_TABLE_PRESENT_${table}`,
    );
  }

  console.log(
    "COMMERCE_TABLES_MIGRATED=NO",
  );

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
