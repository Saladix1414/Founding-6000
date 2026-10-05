import {
  Router,
} from "express";

import {
  db,
} from "../db/database.js";

import {
  env,
} from "../config/env.js";

import {
  getDatabaseMigrationStatus,
} from "../db/migrationRegistry.js";

import {
  ensureWorkerHealthSchema,
} from "../db/workerHealthSchema.js";

import {
  getWorkerHealthRows,
  type WorkerHealthRow,
  type WorkerName,
} from "../repositories/workerHealthRepository.js";

export const healthRouter =
  Router();

type PublicWorkerState =
  | "healthy"
  | "running"
  | "failed"
  | "stale"
  | "not_seen"
  | "unavailable";

const WORKER_STALE_MS:
  Record<
    WorkerName,
    number
  > = {
    email:
      2 * 60 * 1000,

    usdt:
      3 * 60 * 1000,
  };

function workerState(
  workerName:
    WorkerName,

  row:
    WorkerHealthRow
    | undefined,

  now:
    number,
): PublicWorkerState {
  if (!row) {
    return "not_seen";
  }

  const updatedAt =
    Date.parse(
      row.updatedAt,
    );

  if (
    !Number.isFinite(
      updatedAt,
    )
  ) {
    return "stale";
  }

  if (
    now -
      updatedAt >
    WORKER_STALE_MS[
      workerName
    ]
  ) {
    return "stale";
  }

  if (
    row.lastStatus ===
    "FAILED"
  ) {
    return "failed";
  }

  if (
    row.lastStatus ===
    "RUNNING"
  ) {
    return "running";
  }

  return "healthy";
}

function paymentMode() {
  if (
    env.REAL_PAYMENTS_ENABLED &&
    !env.PAYMENT_READINESS
  ) {
    return "unsafe_configuration";
  }

  if (
    env.REAL_PAYMENTS_ENABLED &&
    env.PAYMENT_READINESS
  ) {
    return "enabled";
  }

  return "disabled";
}

function operationalSnapshot() {
  let database:
    "ok"
    | "unavailable" =
      "unavailable";

  let migrations:
    "current"
    | "pending"
    | "unavailable" =
      "unavailable";

  let emailWorker:
    PublicWorkerState =
      "unavailable";

  let usdtWorker:
    PublicWorkerState =
      "unavailable";

  try {
    db.prepare(
      "SELECT 1 AS ok",
    ).get();

    database =
      "ok";

    const migrationStatus =
      getDatabaseMigrationStatus();

    migrations =
      migrationStatus.some(
        (migration) =>
          !migration.applied,
      )
        ? "pending"
        : "current";

    ensureWorkerHealthSchema();

    const workers =
      getWorkerHealthRows();

    const now =
      Date.now();

    emailWorker =
      workerState(
        "email",
        workers.find(
          (worker) =>
            worker.workerName ===
            "email",
        ),
        now,
      );

    usdtWorker =
      workerState(
        "usdt",
        workers.find(
          (worker) =>
            worker.workerName ===
            "usdt",
        ),
        now,
      );
  } catch {
    // Never expose raw operational errors publicly.
  }

  const payments =
    paymentMode();

  const coreReady =
    database ===
      "ok" &&
    migrations ===
      "current" &&
    payments !==
      "unsafe_configuration";

  const workersHealthy =
    (
      emailWorker ===
        "healthy" ||
      emailWorker ===
        "running"
    ) &&
    (
      usdtWorker ===
        "healthy" ||
      usdtWorker ===
        "running"
    );

  return {
    status:
      coreReady
        ? "ok"
        : "degraded",

    database,

    migrations,

    workers: {
      email:
        emailWorker,

      usdt:
        usdtWorker,
    },

    operations:
      workersHealthy
        ? "ok"
        : "degraded",

    payments,

    coreReady,
  };
}

healthRouter.get(
  "/",
  (_request, response) => {
    const snapshot =
      operationalSnapshot();

    response.json({
      status:
        snapshot.status,

      service:
        "founding-6000-api",

      environment:
        env.NODE_ENV,

      database:
        snapshot.database,

      migrations:
        snapshot.migrations,

      workers:
        snapshot.workers,

      operations:
        snapshot.operations,

      payments:
        snapshot.payments,

      paymentReadiness:
        env.PAYMENT_READINESS,

      realPaymentsEnabled:
        env.REAL_PAYMENTS_ENABLED,

      timestamp:
        new Date()
          .toISOString(),
    });
  },
);

healthRouter.get(
  "/ready",
  (_request, response) => {
    const snapshot =
      operationalSnapshot();

    response
      .status(
        snapshot.coreReady
          ? 200
          : 503,
      )
      .json({
        status:
          snapshot.coreReady
            ? "ready"
            : "not_ready",

        database:
          snapshot.database,

        migrations:
          snapshot.migrations,

        operations:
          snapshot.operations,

        payments:
          snapshot.payments,

        timestamp:
          new Date()
            .toISOString(),
      });
  },
);
