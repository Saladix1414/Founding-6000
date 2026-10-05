import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolved =
  resolve(
    dbPath,
  );

for (
  const file of [
    resolved,
    `${resolved}-wal`,
    `${resolved}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

const {
  createApp,
} = await import(
  "../app.js"
);

const {
  db,
} = await import(
  "../db/database.js"
);

const app =
  createApp();

const server =
  app.listen(
    0,
    "127.0.0.1",
  );

await new Promise<void>(
  (
    resolveListening,
  ) => {
    server.once(
      "listening",
      resolveListening,
    );
  },
);

const address =
  server.address();

if (
  !address ||
  typeof address ===
    "string"
) {
  throw new Error(
    "INVALID_TEST_SERVER",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function api(
  path: string,
  init?:
    RequestInit,
) {
  const response =
    await fetch(
      `${base}${path}`,
      init,
    );

  let body:
    Record<
      string,
      any
    > =
    {};

  try {
    body =
      await response.json();
  } catch {
    body = {};
  }

  return {
    response,
    body,
  };
}

function count(
  table:
    string,
) {
  const row =
    db.prepare(
      `SELECT COUNT(*) AS count FROM "${table}"`,
    ).get() as {
      count:
        number | bigint;
    };

  return Number(
    row.count,
  );
}

try {
  console.log("");
  console.log(
    "[D2-B 1] Production health state",
  );

  const health =
    await api(
      "/api/health",
    );

  if (
    health.response.status !==
      200
  ) {
    throw new Error(
      "HEALTH_NOT_200",
    );
  }

  if (
    health.body.checkout !==
      "closed"
  ) {
    throw new Error(
      "CHECKOUT_NOT_CLOSED",
    );
  }

  if (
    health.body.payments !==
      "disabled"
  ) {
    throw new Error(
      "PAYMENTS_NOT_DISABLED",
    );
  }

  console.log(
    "[PASS] Checkout closed",
  );

  console.log(
    "[PASS] Payments disabled",
  );

  console.log("");
  console.log(
    "[D2-B 2] Prelaunch email allowed",
  );

  const registration =
    await api(
      "/api/email-registrations",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            email:
              "founder@example.com",
          }),
      },
    );

  if (
    registration.response
      .status !==
      201
  ) {
    throw new Error(
      `PRELAUNCH_EMAIL_NOT_ACCEPTED_${registration.response.status}`,
    );
  }

  if (
    registration.body
      .registration
      ?.email !==
      "founder@example.com"
  ) {
    throw new Error(
      "PRELAUNCH_EMAIL_RESPONSE_INVALID",
    );
  }

  if (
    count(
      "email_registrations",
    ) !== 1
  ) {
    throw new Error(
      "PRELAUNCH_EMAIL_NOT_PERSISTED",
    );
  }

  const stored =
    db.prepare(`
      SELECT
        source,
        normalized_email AS normalizedEmail

      FROM email_registrations

      LIMIT 1
    `).get() as {
      source: string;
      normalizedEmail:
        string;
    };

  if (
    stored.source !==
      "FOUNDING_6000_PRELAUNCH"
  ) {
    throw new Error(
      `PRELAUNCH_SOURCE_INVALID_${stored.source}`,
    );
  }

  if (
    stored.normalizedEmail !==
      "founder@example.com"
  ) {
    throw new Error(
      "PRELAUNCH_EMAIL_NORMALIZATION_INVALID",
    );
  }

  console.log(
    "[PASS] Prelaunch email stored",
  );

  console.log(
    "[PASS] Source = FOUNDING_6000_PRELAUNCH",
  );

  console.log("");
  console.log(
    "[D2-B 3] Orders remain blocked",
  );

  const order =
    await api(
      "/api/orders",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "d2b-production-order",
        },

        body:
          JSON.stringify({
            email:
              "founder@example.com",
          }),
      },
    );

  if (
    order.response.status !==
      503 ||
    order.body.error !==
      "CHECKOUT_NOT_OPEN"
  ) {
    throw new Error(
      "ORDER_GATE_BYPASSED",
    );
  }

  if (
    count(
      "founding_orders",
    ) !== 0
  ) {
    throw new Error(
      "ORDER_CREATED_DURING_PRELAUNCH",
    );
  }

  console.log(
    "[PASS] Order creation blocked",
  );

  console.log("");
  console.log(
    "[D2-B 4] USDT remains blocked",
  );

  const payment =
    await api(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "d2b-production-usdt",
        },

        body:
          JSON.stringify({
            orderPublicId:
              "F6K-AAAAAAAAAAAA",
          }),
      },
    );

  if (
    payment.response.status !==
      503 ||
    payment.body.error !==
      "PAYMENTS_NOT_OPEN"
  ) {
    throw new Error(
      "PAYMENT_GATE_BYPASSED",
    );
  }

  if (
    count(
      "payment_attempts",
    ) !== 0
  ) {
    throw new Error(
      "PAYMENT_ATTEMPT_CREATED_DURING_PRELAUNCH",
    );
  }

  if (
    count(
      "inventory_allocations",
    ) !== 0
  ) {
    throw new Error(
      "INVENTORY_CHANGED_DURING_PRELAUNCH",
    );
  }

  if (
    count(
      "founding_memberships",
    ) !== 0
  ) {
    throw new Error(
      "MEMBERSHIP_CREATED_DURING_PRELAUNCH",
    );
  }

  console.log(
    "[PASS] USDT attempt blocked",
  );

  console.log(
    "[PASS] Inventory untouched",
  );

  console.log(
    "[PASS] Memberships untouched",
  );

  console.log("");
  console.log(
    "[D2-B 5] Email abuse rate limit",
  );

  /*
   * One request was already accepted.
   * Submit nine more = ten requests total.
   */
  for (
    let index = 1;
    index <= 9;
    index += 1
  ) {
    const result =
      await api(
        "/api/email-registrations",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              email:
                `rate-${index}@example.com`,
            }),
        },
      );

    if (
      result.response.status !==
        201
    ) {
      throw new Error(
        `EXPECTED_EMAIL_201_AT_${index}_GOT_${result.response.status}`,
      );
    }
  }

  const blocked =
    await api(
      "/api/email-registrations",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            email:
              "rate-blocked@example.com",
          }),
      },
    );

  if (
    blocked.response.status !==
      429 ||
    blocked.body.error !==
      "EMAIL_REGISTRATION_RATE_LIMITED"
  ) {
    throw new Error(
      `EMAIL_RATE_LIMIT_NOT_ENFORCED_STATUS_${blocked.response.status}`,
    );
  }

  if (
    count(
      "email_registrations",
    ) !== 10
  ) {
    throw new Error(
      `EXPECTED_10_REGISTRATIONS_GOT_${count(
        "email_registrations",
      )}`,
    );
  }

  if (
    count(
      "founding_orders",
    ) !== 0 ||
    count(
      "payment_attempts",
    ) !== 0 ||
    count(
      "inventory_allocations",
    ) !== 0 ||
    count(
      "founding_memberships",
    ) !== 0
  ) {
    throw new Error(
      "PRELAUNCH_REGISTRATION_MUTATED_COMMERCE_STATE",
    );
  }

  console.log(
    "[PASS] Email registration rate limit enforced",
  );

  console.log(
    "[PASS] Commerce state remains untouched",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D2-B SAFE PUBLIC PRELAUNCH TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "PRELAUNCH_EMAIL=ENABLED",
  );

  console.log(
    "PRELAUNCH_SOURCE=PASS",
  );

  console.log(
    "EMAIL_RATE_LIMIT=PASS",
  );

  console.log(
    "CHECKOUT=CLOSED",
  );

  console.log(
    "ORDERS_CREATED=0",
  );

  console.log(
    "PAYMENT_ATTEMPTS_CREATED=0",
  );

  console.log(
    "INVENTORY_ALLOCATIONS_CREATED=0",
  );

  console.log(
    "MEMBERSHIPS_CREATED=0",
  );

  console.log(
    "REAL_PAYMENTS=DISABLED",
  );
} finally {
  await new Promise<void>(
    (
      resolveClose,
    ) => {
      server.close(
        () =>
          resolveClose(),
      );
    },
  );

  db.close();

  for (
    const file of [
      resolved,
      `${resolved}-wal`,
      `${resolved}-shm`,
    ]
  ) {
    rmSync(
      file,
      {
        force: true,
      },
    );
  }
}
