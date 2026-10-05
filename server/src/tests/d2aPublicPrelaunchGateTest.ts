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
  (resolveListening) => {
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
  typeof address === "string"
) {
  throw new Error(
    "INVALID_TEST_SERVER",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function request(
  path: string,
  init?: RequestInit,
) {
  const response =
    await fetch(
      `${base}${path}`,
      init,
    );

  const body =
    await response.json() as
      Record<string, any>;

  return {
    response,
    body,
  };
}

try {
  const health =
    await request(
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
      "CHECKOUT_NOT_REPORTED_CLOSED",
    );
  }

  if (
    health.body.payments !==
      "disabled"
  ) {
    throw new Error(
      "PAYMENTS_NOT_REPORTED_DISABLED",
    );
  }

  const order =
    await request(
      "/api/orders",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "d2a-production-order",
        },

        body:
          JSON.stringify({
            email:
              "d2a@example.com",
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
      "PRODUCTION_ORDER_CREATION_NOT_BLOCKED",
    );
  }

  const attempt =
    await request(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "d2a-production-usdt",
        },

        body:
          JSON.stringify({
            orderPublicId:
              "F6K-AAAAAAAAAAAA",
          }),
      },
    );

  if (
    attempt.response.status !==
      503 ||
    attempt.body.error !==
      "PAYMENTS_NOT_OPEN"
  ) {
    throw new Error(
      "PRODUCTION_USDT_ATTEMPT_NOT_BLOCKED",
    );
  }

  const orderCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM founding_orders
    `).get() as {
      count:
        number | bigint;
    };

  if (
    Number(
      orderCount.count,
    ) !== 0
  ) {
    throw new Error(
      "BLOCKED_REQUEST_CREATED_ORDER",
    );
  }

  const paymentCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM payment_attempts
    `).get() as {
      count:
        number | bigint;
    };

  if (
    Number(
      paymentCount.count,
    ) !== 0
  ) {
    throw new Error(
      "BLOCKED_REQUEST_CREATED_PAYMENT_ATTEMPT",
    );
  }

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D2-A PUBLIC PRELAUNCH GATE TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "CHECKOUT_STATE=CLOSED",
  );

  console.log(
    "PAYMENTS_STATE=DISABLED",
  );

  console.log(
    "ORDER_CREATION=BLOCKED",
  );

  console.log(
    "USDT_ATTEMPT_CREATION=BLOCKED",
  );

  console.log(
    "ORDERS_CREATED=0",
  );

  console.log(
    "PAYMENT_ATTEMPTS_CREATED=0",
  );
} finally {
  await new Promise<void>(
    (resolveClose) => {
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
