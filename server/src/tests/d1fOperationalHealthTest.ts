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

const expectUnsafe =
  process.env
    .D1F_EXPECT_UNSAFE ===
  "true";

const {
  db,
} = await import(
  "../db/database.js"
);

const {
  applyPendingDatabaseMigrations,
} = await import(
  "../db/migrationRegistry.js"
);

const {
  recordWorkerCycleStarted,
  recordWorkerCycleCompleted,
} = await import(
  "../repositories/workerHealthRepository.js"
);

const {
  createApp,
} = await import(
  "../app.js"
);

applyPendingDatabaseMigrations();

recordWorkerCycleStarted(
  "email",
);

recordWorkerCycleCompleted(
  "email",
);

recordWorkerCycleStarted(
  "usdt",
);

recordWorkerCycleCompleted(
  "usdt",
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
    "INVALID_SERVER_ADDRESS",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function getJson(
  path: string,
) {
  const response =
    await fetch(
      `${base}${path}`,
    );

  const body =
    await response.json() as
      Record<
        string,
        any
      >;

  return {
    response,
    body,
  };
}

function assertNoSensitiveLeak(
  body:
    Record<
      string,
      any
    >,
) {
  const serialized =
    JSON.stringify(
      body,
    );

  const forbiddenValues = [
    process.env
      .ADMIN_API_TOKEN,

    process.env
      .ETHEREUM_RPC_URL,

    process.env
      .DATABASE_PATH,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(
        value,
      ),
  );

  for (
    const value of
      forbiddenValues
  ) {
    if (
      serialized.includes(
        value,
      )
    ) {
      throw new Error(
        "HEALTH_ENDPOINT_LEAKED_SENSITIVE_VALUE",
      );
    }
  }

  const forbiddenKeys = [
    "adminApiToken",
    "ethereumRpcUrl",
    "databasePath",
    "privateKey",
    "seedPhrase",
  ];

  for (
    const key of
      forbiddenKeys
  ) {
    if (
      serialized.includes(
        `"${key}"`,
      )
    ) {
      throw new Error(
        `HEALTH_ENDPOINT_LEAKED_KEY_${key}`,
      );
    }
  }
}

try {
  console.log("");
  console.log(
    "[D1-F 1] Fresh operational state",
  );

  const fresh =
    await getJson(
      "/api/health",
    );

  if (
    fresh.response.status !==
      200
  ) {
    throw new Error(
      "HEALTH_HTTP_NOT_200",
    );
  }

  assertNoSensitiveLeak(
    fresh.body,
  );

  if (
    fresh.body.database !==
      "ok"
  ) {
    throw new Error(
      "DATABASE_HEALTH_NOT_OK",
    );
  }

  if (
    fresh.body.migrations !==
      "current"
  ) {
    throw new Error(
      "MIGRATIONS_NOT_CURRENT",
    );
  }

  if (
    fresh.body.workers
      ?.email !==
      "healthy"
  ) {
    throw new Error(
      "EMAIL_WORKER_NOT_HEALTHY",
    );
  }

  if (
    fresh.body.workers
      ?.usdt !==
      "healthy"
  ) {
    throw new Error(
      "USDT_WORKER_NOT_HEALTHY",
    );
  }

  if (
    fresh.body.operations !==
      "ok"
  ) {
    throw new Error(
      "OPERATIONS_NOT_OK",
    );
  }

  console.log(
    "[PASS] Fresh worker heartbeats recognized",
  );

  console.log(
    "[PASS] Sensitive values not exposed",
  );

  const ready =
    await getJson(
      "/api/health/ready",
    );

  assertNoSensitiveLeak(
    ready.body,
  );

  if (expectUnsafe) {
    if (
      fresh.body.payments !==
        "unsafe_configuration"
    ) {
      throw new Error(
        "UNSAFE_PAYMENT_CONFIGURATION_NOT_DETECTED",
      );
    }

    if (
      fresh.body.status !==
        "degraded"
    ) {
      throw new Error(
        "UNSAFE_PAYMENT_HEALTH_NOT_DEGRADED",
      );
    }

    if (
      ready.response.status !==
        503 ||
      ready.body.status !==
        "not_ready"
    ) {
      throw new Error(
        "UNSAFE_PAYMENT_READY_NOT_BLOCKED",
      );
    }

    console.log(
      "[PASS] Unsafe payment configuration detected",
    );

    console.log(
      "[PASS] Readiness blocked with HTTP 503",
    );

    console.log("");
    console.log(
      "============================================",
    );

    console.log(
      " D1-F UNSAFE PAYMENT TEST PASS",
    );

    console.log(
      "============================================",
    );

    console.log(
      "UNSAFE_CONFIGURATION=DETECTED",
    );

    console.log(
      "READY_ENDPOINT=503",
    );

    console.log(
      "REAL_PAYMENT_EXECUTION=NOT_INVOKED",
    );
  } else {
    if (
      fresh.body.payments !==
        "disabled"
    ) {
      throw new Error(
        "SAFE_PRELAUNCH_PAYMENT_MODE_INVALID",
      );
    }

    if (
      fresh.body.status !==
        "ok"
    ) {
      throw new Error(
        "SAFE_HEALTH_STATUS_NOT_OK",
      );
    }

    if (
      ready.response.status !==
        200 ||
      ready.body.status !==
        "ready"
    ) {
      throw new Error(
        "SAFE_READY_ENDPOINT_NOT_READY",
      );
    }

    console.log(
      "[PASS] Safe prelaunch payment mode recognized",
    );

    console.log(
      "[PASS] Ready endpoint = 200",
    );

    /*
     * Stale worker must degrade operations,
     * but it must not claim that the core API
     * or database is unavailable.
     */
    const staleAt =
      new Date(
        Date.now() -
          10 * 60 * 1000,
      ).toISOString();

    db.prepare(`
      UPDATE worker_health

      SET
        updated_at = ?,
        last_completed_at = ?

      WHERE worker_name = 'email'
    `).run(
      staleAt,
      staleAt,
    );

    const stale =
      await getJson(
        "/api/health",
      );

    if (
      stale.body.workers
        ?.email !==
        "stale"
    ) {
      throw new Error(
        "STALE_EMAIL_WORKER_NOT_DETECTED",
      );
    }

    if (
      stale.body.operations !==
        "degraded"
    ) {
      throw new Error(
        "STALE_WORKER_DID_NOT_DEGRADE_OPERATIONS",
      );
    }

    if (
      stale.body.database !==
        "ok" ||
      stale.body.migrations !==
        "current"
    ) {
      throw new Error(
        "STALE_WORKER_CORRUPTED_CORE_HEALTH_STATE",
      );
    }

    const staleReady =
      await getJson(
        "/api/health/ready",
      );

    if (
      staleReady.response.status !==
        200
    ) {
      throw new Error(
        "STALE_WORKER_SHOULD_NOT_BLOCK_PRELAUNCH_CORE_READY",
      );
    }

    console.log(
      "[PASS] Stale worker detected",
    );

    console.log(
      "[PASS] Worker degradation separated from core readiness",
    );

    /*
     * A missing migration is different:
     * core readiness must fail.
     */
    db.prepare(`
      DELETE FROM database_migrations
      WHERE id = ?
    `).run(
      "004_worker_health_schema",
    );

    const pending =
      await getJson(
        "/api/health",
      );

    if (
      pending.body.migrations !==
        "pending"
    ) {
      throw new Error(
        "PENDING_MIGRATION_NOT_DETECTED",
      );
    }

    if (
      pending.body.status !==
        "degraded"
    ) {
      throw new Error(
        "PENDING_MIGRATION_HEALTH_NOT_DEGRADED",
      );
    }

    const pendingReady =
      await getJson(
        "/api/health/ready",
      );

    if (
      pendingReady.response.status !==
        503 ||
      pendingReady.body.status !==
        "not_ready"
    ) {
      throw new Error(
        "PENDING_MIGRATION_READY_NOT_BLOCKED",
      );
    }

    console.log(
      "[PASS] Pending migration detected",
    );

    console.log(
      "[PASS] Pending migration blocks readiness",
    );

    console.log("");
    console.log(
      "============================================",
    );

    console.log(
      " D1-F OPERATIONAL HEALTH TEST PASS",
    );

    console.log(
      "============================================",
    );

    console.log(
      "DATABASE_HEALTH=PASS",
    );

    console.log(
      "MIGRATION_HEALTH=PASS",
    );

    console.log(
      "FRESH_HEARTBEATS=PASS",
    );

    console.log(
      "STALE_HEARTBEAT=PASS",
    );

    console.log(
      "OPERATIONS_DEGRADATION=PASS",
    );

    console.log(
      "CORE_READINESS_SEPARATION=PASS",
    );

    console.log(
      "PENDING_MIGRATION_READY_BLOCK=PASS",
    );

    console.log(
      "SECRET_DISCLOSURE=BLOCKED",
    );
  }
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
