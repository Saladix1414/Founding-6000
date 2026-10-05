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
  resolve(dbPath);

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
  createOrder,
} = await import(
  "../services/orderService.js"
);

const {
  db,
} = await import(
  "../db/database.js"
);

const app =
  createApp();

const order1 =
  createOrder({
    email:
      "s1b-one@example.com",

    idempotencyKey:
      "s1b-order-one",
  });

const order2 =
  createOrder({
    email:
      "s1b-two@example.com",

    idempotencyKey:
      "s1b-order-two",
  });

const order3 =
  createOrder({
    email:
      "s1b-three@example.com",

    idempotencyKey:
      "s1b-order-three",
  });

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
    "INVALID_TEST_SERVER_ADDRESS",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function api(
  path: string,
  init?: Parameters<
    typeof fetch
  >[1],
) {
  const response =
    await fetch(
      `${base}${path}`,
      init,
    );

  let body:
    Record<string, any> =
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

function jsonHeaders(
  idempotencyKey?: string,
) {
  return {
    "Content-Type":
      "application/json",

    ...(idempotencyKey
      ? {
          "Idempotency-Key":
            idempotencyKey,
        }
      : {}),
  };
}

try {
  console.log("");
  console.log(
    "[TEST 1] Idempotency-Key required",
  );

  {
    const result =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              orderPublicId:
                order1.order.publicId,
            }),
        },
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "IDEMPOTENCY_KEY_REQUIRED"
    ) {
      throw new Error(
        "MISSING_IDEMPOTENCY_KEY_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Missing key blocked",
  );

  console.log("");
  console.log(
    "[TEST 2] Invalid Idempotency-Key",
  );

  {
    const result =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders("bad"),

          body:
            JSON.stringify({
              orderPublicId:
                order1.order.publicId,
            }),
        },
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "INVALID_IDEMPOTENCY_KEY"
    ) {
      throw new Error(
        "INVALID_IDEMPOTENCY_KEY_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Invalid key blocked",
  );

  console.log("");
  console.log(
    "[TEST 3] Invalid order ID",
  );

  {
    const result =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders(
              "s1b-invalid-order",
            ),

          body:
            JSON.stringify({
              orderPublicId:
                "NOT-A-FOUNDING-ORDER",
            }),
        },
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "INVALID_USDT_ATTEMPT_REQUEST"
    ) {
      throw new Error(
        "INVALID_ORDER_ID_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Invalid order ID blocked",
  );

  console.log("");
  console.log(
    "[TEST 4] Valid attempt",
  );

  const create1 =
    await api(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers:
          jsonHeaders(
            "s1b-attempt-0001",
          ),

        body:
          JSON.stringify({
            orderPublicId:
              order1.order.publicId,
          }),
      },
    );

  if (
    create1.response.status !== 201 ||
    !create1.body.attempt
      ?.publicId ||
    create1.body
      .idempotentReplay !== false
  ) {
    throw new Error(
      "VALID_ATTEMPT_CREATION_FAILED",
    );
  }

  const attempt1 =
    String(
      create1.body
        .attempt.publicId,
    );

  console.log(
    "[PASS] Valid attempt created",
  );

  console.log("");
  console.log(
    "[TEST 5] Attempt replay",
  );

  {
    const replay =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders(
              "s1b-attempt-0001",
            ),

          body:
            JSON.stringify({
              orderPublicId:
                order1.order.publicId,
            }),
        },
      );

    if (
      replay.response.status !== 200 ||
      replay.body
        .idempotentReplay !== true ||
      replay.body.attempt
        ?.publicId !== attempt1
    ) {
      throw new Error(
        "ATTEMPT_REPLAY_FAILED",
      );
    }
  }

  console.log(
    "[PASS] Same request is idempotent",
  );

  console.log("");
  console.log(
    "[TEST 6] Key cannot move to another order",
  );

  {
    const conflict =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders(
              "s1b-attempt-0001",
            ),

          body:
            JSON.stringify({
              orderPublicId:
                order2.order.publicId,
            }),
        },
      );

    if (
      conflict.response.status !== 409 ||
      conflict.body.error !==
        "IDEMPOTENCY_KEY_CONFLICT"
    ) {
      throw new Error(
        "IDEMPOTENCY_KEY_REBOUND_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Cross-order key reuse blocked",
  );

  console.log("");
  console.log(
    "[TEST 7] Invalid payment attempt ID",
  );

  {
    const result =
      await api(
        "/api/payments/usdt/attempts/not-valid",
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "INVALID_PAYMENT_ATTEMPT_ID"
    ) {
      throw new Error(
        "INVALID_ATTEMPT_ID_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Invalid attempt ID blocked",
  );

  console.log("");
  console.log(
    "[TEST 8] Invalid transaction hashes",
  );

  for (
    const txHash of [
      "0x1234",
      `0x${"z".repeat(64)}`,
    ]
  ) {
    const result =
      await api(
        `/api/payments/usdt/attempts/${attempt1}/submit`,
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              txHash,
            }),
        },
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "INVALID_TX_HASH"
    ) {
      throw new Error(
        "INVALID_TX_HASH_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Invalid hashes blocked",
  );

  const hashA =
    `0x${"a".repeat(64)}`;

  const hashB =
    `0x${"b".repeat(64)}`;

  console.log("");
  console.log(
    "[TEST 9] First hash submission",
  );

  {
    const result =
      await api(
        `/api/payments/usdt/attempts/${attempt1}/submit`,
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              txHash:
                hashA,
            }),
        },
      );

    if (
      result.response.status !== 200 ||
      result.body
        .idempotentReplay !== false ||
      result.body
        .paymentVerified !== false ||
      result.body
        .settlementCreated !== false ||
      result.body.attempt
        ?.status !== "SUBMITTED"
    ) {
      throw new Error(
        "FIRST_TX_SUBMISSION_FAILED",
      );
    }
  }

  console.log(
    "[PASS] Hash stored as evidence only",
  );

  console.log("");
  console.log(
    "[TEST 10] Same hash replay",
  );

  {
    const result =
      await api(
        `/api/payments/usdt/attempts/${attempt1}/submit`,
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              txHash:
                hashA,
            }),
        },
      );

    if (
      result.response.status !== 200 ||
      result.body
        .idempotentReplay !== true ||
      result.body
        .paymentVerified !== false ||
      result.body
        .settlementCreated !== false
    ) {
      throw new Error(
        "SAME_HASH_REPLAY_FAILED",
      );
    }
  }

  console.log(
    "[PASS] Same hash replay idempotent",
  );

  console.log("");
  console.log(
    "[TEST 11] Different hash replacement",
  );

  {
    const result =
      await api(
        `/api/payments/usdt/attempts/${attempt1}/submit`,
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              txHash:
                hashB,
            }),
        },
      );

    if (
      result.response.status !== 409 ||
      result.body.error !==
        "PAYMENT_ATTEMPT_HASH_LOCKED"
    ) {
      throw new Error(
        "HASH_REPLACEMENT_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Evidence hash immutable",
  );

  console.log("");
  console.log(
    "[TEST 12] Cross-attempt tx replay",
  );

  const create2 =
    await api(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers:
          jsonHeaders(
            "s1b-attempt-0002",
          ),

        body:
          JSON.stringify({
            orderPublicId:
              order2.order.publicId,
          }),
      },
    );

  if (
    create2.response.status !== 201
  ) {
    throw new Error(
      "SECOND_ATTEMPT_CREATION_FAILED",
    );
  }

  const attempt2 =
    String(
      create2.body
        .attempt.publicId,
    );

  {
    const result =
      await api(
        `/api/payments/usdt/attempts/${attempt2}/submit`,
        {
          method:
            "POST",

          headers:
            jsonHeaders(),

          body:
            JSON.stringify({
              txHash:
                hashA,
            }),
        },
      );

    if (
      result.response.status !== 409 ||
      result.body.error !==
        "TX_HASH_ALREADY_SUBMITTED"
    ) {
      throw new Error(
        "CROSS_ATTEMPT_TX_REPLAY_NOT_BLOCKED",
      );
    }
  }

  console.log(
    "[PASS] Cross-attempt replay blocked",
  );

  console.log("");
  console.log(
    "[TEST 13] Submit is not settlement",
  );

  const settlements =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM payment_settlements
    `).get() as {
      count: number;
    };

  const allocations =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM inventory_allocations
    `).get() as {
      count: number;
    };

  const paidOrders =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM founding_orders
      WHERE status = 'PAID'
    `).get() as {
      count: number;
    };

  if (
    Number(settlements.count) !== 0 ||
    Number(allocations.count) !== 0 ||
    Number(paidOrders.count) !== 0
  ) {
    throw new Error(
      "SUBMIT_CREATED_AUTHORITATIVE_PAYMENT",
    );
  }

  console.log(
    "[PASS] Settlements remain zero",
  );

  console.log(
    "[PASS] Inventory remains zero",
  );

  console.log(
    "[PASS] Paid orders remain zero",
  );

  console.log("");
  console.log(
    "[TEST 14] Endpoint-specific rate limit",
  );

  let rateLimited =
    false;

  for (
    let i = 0;
    i < 12;
    i += 1
  ) {
    const result =
      await api(
        "/api/payments/usdt/attempts",
        {
          method:
            "POST",

          headers:
            jsonHeaders(
              `s1b-rate-${String(i).padStart(4, "0")}`,
            ),

          body:
            JSON.stringify({
              orderPublicId:
                order3.order.publicId,
            }),
        },
      );

    if (
      result.response.status === 429
    ) {
      if (
        result.body.error !==
          "PAYMENT_RATE_LIMITED"
      ) {
        throw new Error(
          "WRONG_RATE_LIMIT_RESPONSE",
        );
      }

      if (
        !result.response.headers
          .get("x-request-id")
      ) {
        throw new Error(
          "RATE_LIMIT_REQUEST_ID_MISSING",
        );
      }

      rateLimited =
        true;

      break;
    }
  }

  if (!rateLimited) {
    throw new Error(
      "PAYMENT_RATE_LIMIT_NOT_TRIGGERED",
    );
  }

  console.log(
    "[PASS] Payment rate limit triggered",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " S1-B PAYMENT SECURITY TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "IDEMPOTENCY_KEY_REQUIRED=PASS",
  );

  console.log(
    "IDEMPOTENCY_BINDING=PASS",
  );

  console.log(
    "PUBLIC_ID_VALIDATION=PASS",
  );

  console.log(
    "TX_HASH_VALIDATION=PASS",
  );

  console.log(
    "SAME_HASH_REPLAY=PASS",
  );

  console.log(
    "HASH_IMMUTABILITY=PASS",
  );

  console.log(
    "CROSS_ATTEMPT_REPLAY=PASS",
  );

  console.log(
    "SUBMIT_IS_NOT_PAYMENT=PASS",
  );

  console.log(
    "RATE_LIMIT=PASS",
  );
} finally {
  await new Promise<void>(
    (resolveClose) => {
      server.close(
        () => resolveClose(),
      );
    },
  );

  db.close();
}
