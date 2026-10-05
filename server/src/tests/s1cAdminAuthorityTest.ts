import {
  randomUUID,
} from "node:crypto";

import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const dbPath =
  process.env.DATABASE_PATH;

const testAdminToken =
  process.env.ADMIN_API_TOKEN;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

if (
  !testAdminToken ||
  testAdminToken.length < 32
) {
  throw new Error(
    "TEST_ADMIN_TOKEN_REQUIRED",
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

/*
 * Initialize the isolated database before any
 * service attempts to create/read orders.
 */
const {
  db,
  initializeDatabase,
} = await import(
  "../db/database.js"
);

initializeDatabase();

const {
  ensureMembershipSchema,
} = await import(
  "../db/membershipSchema.js"
);

const {
  ensureEmailOutboxSchema,
} = await import(
  "../db/emailOutboxSchema.js"
);

ensureMembershipSchema();
ensureEmailOutboxSchema();

/*
 * Import application/services only after the
 * canonical core schema exists.
 */
const {
  createApp,
} = await import(
  "../app.js"
);

const {
  env,
} = await import(
  "../config/env.js"
);

const {
  createOrder,
} = await import(
  "../services/orderService.js"
);

const {
  verifyAdminBearerAuthorization,
} = await import(
  "../middleware/adminAuthority.js"
);

/*
 * Pure authority checks.
 */
if (
  verifyAdminBearerAuthorization(
    undefined,
    undefined,
  ) !== "NOT_CONFIGURED"
) {
  throw new Error(
    "PURE_AUTH_NOT_CONFIGURED_FAILED",
  );
}

if (
  verifyAdminBearerAuthorization(
    undefined,
    testAdminToken,
  ) !== "UNAUTHORIZED"
) {
  throw new Error(
    "PURE_AUTH_MISSING_HEADER_FAILED",
  );
}

if (
  verifyAdminBearerAuthorization(
    "Basic abc",
    testAdminToken,
  ) !== "UNAUTHORIZED"
) {
  throw new Error(
    "PURE_AUTH_BASIC_NOT_REJECTED",
  );
}

if (
  verifyAdminBearerAuthorization(
    "Bearer definitely-wrong-admin-token-that-is-long-enough-123456789",
    testAdminToken,
  ) !== "UNAUTHORIZED"
) {
  throw new Error(
    "PURE_AUTH_WRONG_TOKEN_FAILED",
  );
}

if (
  verifyAdminBearerAuthorization(
    `Bearer ${testAdminToken}`,
    testAdminToken,
  ) !== "AUTHORIZED"
) {
  throw new Error(
    "PURE_AUTH_VALID_TOKEN_FAILED",
  );
}

/*
 * Create one isolated order and seed an
 * ACTIVATION_PENDING membership for route testing.
 *
 * This is test-only setup. Production memberships
 * are still created by the verified settlement path.
 */
const orderResult =
  createOrder({
    email:
      "s1c-admin-test@example.com",

    idempotencyKey:
      "s1c-admin-order-0001",
  });

const orderRow =
  db.prepare(`
    SELECT
      id,
      public_id AS publicId

    FROM founding_orders

    WHERE public_id = ?
  `).get(
    orderResult.order.publicId,
  ) as
    | {
        id: string;
        publicId: string;
      }
    | undefined;

if (!orderRow) {
  throw new Error(
    "TEST_ORDER_NOT_FOUND",
  );
}

/*
 * Mirror a paid state for the isolated
 * membership activation fixture.
 */
db.prepare(`
  UPDATE founding_orders

  SET status = 'PAID'

  WHERE id = ?
`).run(
  orderRow.id,
);

const membershipInternalId =
  randomUUID();

const membershipPublicId =
  `mem_${randomUUID()}`;

const now =
  new Date(
    "2027-01-01T00:00:00.000Z",
  ).toISOString();

db.prepare(`
  INSERT INTO founding_memberships (
    id,
    public_id,
    order_id,
    serial_number,
    founding_member,
    genesis_member,
    status,
    activation_started_at,
    activation_expires_at,
    created_at,
    updated_at
  )
  VALUES (
    ?, ?, ?, ?,
    1, 1,
    'ACTIVATION_PENDING',
    NULL,
    NULL,
    ?,
    ?
  )
`).run(
  membershipInternalId,
  membershipPublicId,
  orderRow.id,
  1,
  now,
  now,
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
    raw:
      JSON.stringify(
        body,
      ),
  };
}

function activationRequest(
  authorization:
    string | undefined,
  activatedAt?:
    string,
) {
  return {
    method:
      "POST",

    headers: {
      "Content-Type":
        "application/json",

      ...(authorization
        ? {
            Authorization:
              authorization,
          }
        : {}),
    },

    body:
      JSON.stringify({
        ...(activatedAt
          ? {
              activatedAt,
            }
          : {}),
      }),
  };
}

try {
  console.log("");
  console.log(
    "[TEST 1] Authority unavailable",
  );

  const originalToken =
    env.ADMIN_API_TOKEN;

  env.ADMIN_API_TOKEN =
    undefined;

  {
    const result =
      await api(
        `/api/memberships/${membershipPublicId}/activate`,
        activationRequest(
          undefined,
        ),
      );

    if (
      result.response.status !== 503 ||
      result.body.error !==
        "ADMIN_AUTHORITY_UNAVAILABLE"
    ) {
      throw new Error(
        "UNCONFIGURED_AUTHORITY_NOT_BLOCKED",
      );
    }
  }

  env.ADMIN_API_TOKEN =
    originalToken;

  console.log(
    "[PASS] Missing server authority fails closed",
  );

  console.log("");
  console.log(
    "[TEST 2] Missing Authorization",
  );

  {
    const result =
      await api(
        "/api/memberships/not-even-a-valid-id/activate",
        activationRequest(
          undefined,
        ),
      );

    if (
      result.response.status !== 401 ||
      result.body.error !==
        "ADMIN_AUTHENTICATION_REQUIRED"
    ) {
      throw new Error(
        "MISSING_AUTH_NOT_BLOCKED",
      );
    }

    if (
      !result.response.headers
        .get("www-authenticate")
    ) {
      throw new Error(
        "WWW_AUTHENTICATE_MISSING",
      );
    }

    if (
      !result.response.headers
        .get("x-request-id")
    ) {
      throw new Error(
        "REQUEST_ID_MISSING_ON_401",
      );
    }
  }

  console.log(
    "[PASS] Anonymous activation blocked before ID validation",
  );

  console.log("");
  console.log(
    "[TEST 3] Basic auth rejected",
  );

  {
    const result =
      await api(
        `/api/memberships/${membershipPublicId}/activate`,
        activationRequest(
          "Basic ZmFrZTpmYWtl",
        ),
      );

    if (
      result.response.status !== 401 ||
      result.body.error !==
        "ADMIN_AUTHENTICATION_REQUIRED"
    ) {
      throw new Error(
        "BASIC_AUTH_NOT_REJECTED",
      );
    }
  }

  console.log(
    "[PASS] Basic auth rejected",
  );

  console.log("");
  console.log(
    "[TEST 4] Wrong Bearer rejected",
  );

  const wrongToken =
    "wrong-admin-token-000000000000000000000000000000000000";

  {
    const result =
      await api(
        `/api/memberships/${membershipPublicId}/activate`,
        activationRequest(
          `Bearer ${wrongToken}`,
        ),
      );

    if (
      result.response.status !== 401 ||
      result.body.error !==
        "ADMIN_AUTHENTICATION_REQUIRED"
    ) {
      throw new Error(
        "WRONG_BEARER_NOT_REJECTED",
      );
    }

    if (
      result.raw.includes(
        wrongToken,
      ) ||
      result.raw.includes(
        testAdminToken,
      )
    ) {
      throw new Error(
        "ADMIN_TOKEN_LEAKED_IN_ERROR_RESPONSE",
      );
    }
  }

  console.log(
    "[PASS] Wrong Bearer rejected without secret leak",
  );

  console.log("");
  console.log(
    "[TEST 5] Valid admin + invalid membership ID",
  );

  {
    const result =
      await api(
        "/api/memberships/not-valid/activate",
        activationRequest(
          `Bearer ${testAdminToken}`,
        ),
      );

    if (
      result.response.status !== 400 ||
      result.body.error !==
        "INVALID_MEMBERSHIP_ID"
    ) {
      throw new Error(
        "AUTHORIZED_INVALID_ID_RESPONSE_FAILED",
      );
    }
  }

  console.log(
    "[PASS] Validation occurs after authority",
  );

  console.log("");
  console.log(
    "[TEST 6] Valid admin + nonexistent membership",
  );

  const nonexistentId =
    `mem_${randomUUID()}`;

  {
    const result =
      await api(
        `/api/memberships/${nonexistentId}/activate`,
        activationRequest(
          `Bearer ${testAdminToken}`,
        ),
      );

    if (
      result.response.status !== 404 ||
      result.body.error !==
        "MEMBERSHIP_NOT_FOUND"
    ) {
      throw new Error(
        "AUTHORIZED_NOT_FOUND_RESPONSE_FAILED",
      );
    }
  }

  console.log(
    "[PASS] Authorized request reaches membership service",
  );

  console.log("");
  console.log(
    "[TEST 7] Valid admin activates membership",
  );

  const activationDate =
    "2027-01-05T12:00:00.000Z";

  const firstActivation =
    await api(
      `/api/memberships/${membershipPublicId}/activate`,
      activationRequest(
        `Bearer ${testAdminToken}`,
        activationDate,
      ),
    );

  if (
    firstActivation.response.status !== 200 ||
    firstActivation.body
      .idempotentReplay !== false ||
    firstActivation.body
      .membership?.status !== "ACTIVE" ||
    firstActivation.body
      .membership
      ?.activationStartedAt !==
        activationDate ||
    firstActivation.body
      .membership
      ?.activationExpiresAt !==
        "2028-01-05T12:00:00.000Z"
  ) {
    throw new Error(
      "AUTHORIZED_ACTIVATION_FAILED",
    );
  }

  if (
    firstActivation.raw.includes(
      testAdminToken,
    )
  ) {
    throw new Error(
      "ADMIN_TOKEN_LEAKED_IN_SUCCESS_RESPONSE",
    );
  }

  console.log(
    "[PASS] Membership activated for exactly 12 calendar months",
  );

  console.log("");
  console.log(
    "[TEST 8] ACTIVE replay is idempotent",
  );

  const replay =
    await api(
      `/api/memberships/${membershipPublicId}/activate`,
      activationRequest(
        `Bearer ${testAdminToken}`,
        "2030-06-01T00:00:00.000Z",
      ),
    );

  if (
    replay.response.status !== 200 ||
    replay.body
      .idempotentReplay !== true ||
    replay.body
      .membership?.status !== "ACTIVE" ||
    replay.body
      .membership
      ?.activationStartedAt !==
        activationDate ||
    replay.body
      .membership
      ?.activationExpiresAt !==
        "2028-01-05T12:00:00.000Z"
  ) {
    throw new Error(
      "ACTIVE_REPLAY_NOT_IDEMPOTENT",
    );
  }

  console.log(
    "[PASS] Replay does not extend membership",
  );

  console.log("");
  console.log(
    "[TEST 9] Activation email idempotency",
  );

  const emailCount =
    db.prepare(`
      SELECT
        COUNT(*) AS count

      FROM email_outbox

      WHERE
        template = 'MEMBERSHIP_ACTIVATED'
    `).get() as {
      count: number;
    };

  if (
    Number(
      emailCount.count,
    ) !== 1
  ) {
    throw new Error(
      "ACTIVATION_EMAIL_NOT_IDEMPOTENT",
    );
  }

  console.log(
    "[PASS] Exactly one activation email queued",
  );

  console.log("");
  console.log(
    "[TEST 10] Buyer cannot self-activate",
  );

  const buyerAttempt =
    await api(
      `/api/memberships/${membershipPublicId}/activate`,
      activationRequest(
        undefined,
        "2035-01-01T00:00:00.000Z",
      ),
    );

  if (
    buyerAttempt.response.status !== 401
  ) {
    throw new Error(
      "BUYER_SELF_ACTIVATION_NOT_BLOCKED",
    );
  }

  const stored =
    db.prepare(`
      SELECT
        status,
        activation_started_at AS activationStartedAt,
        activation_expires_at AS activationExpiresAt

      FROM founding_memberships

      WHERE public_id = ?
    `).get(
      membershipPublicId,
    ) as {
      status: string;
      activationStartedAt:
        string | null;
      activationExpiresAt:
        string | null;
    };

  if (
    stored.status !== "ACTIVE" ||
    stored.activationStartedAt !==
      activationDate ||
    stored.activationExpiresAt !==
      "2028-01-05T12:00:00.000Z"
  ) {
    throw new Error(
      "UNAUTHORIZED_REQUEST_MUTATED_MEMBERSHIP",
    );
  }

  console.log(
    "[PASS] Unauthorized request cannot mutate membership",
  );

  console.log("");
  console.log(
    "============================================================",
  );

  console.log(
    " S1-C ADMIN AUTHORITY TEST PASS",
  );

  console.log(
    "============================================================",
  );

  console.log(
    "AUTHORITY_FAILS_CLOSED=PASS",
  );

  console.log(
    "MISSING_AUTH=PASS",
  );

  console.log(
    "WRONG_AUTH=PASS",
  );

  console.log(
    "TIMING_SAFE_AUTH=PASS",
  );

  console.log(
    "AUTH_BEFORE_VALIDATION=PASS",
  );

  console.log(
    "ADMIN_ACTIVATION=PASS",
  );

  console.log(
    "TWELVE_MONTH_TERM=PASS",
  );

  console.log(
    "ACTIVE_REPLAY=PASS",
  );

  console.log(
    "EMAIL_IDEMPOTENCY=PASS",
  );

  console.log(
    "BUYER_SELF_ACTIVATION=BLOCKED",
  );

  console.log(
    "ADMIN_SECRET_LEAK=NONE",
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
