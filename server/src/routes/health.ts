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

import {
  getLatestEconomicReconciliationEvidence,
} from "../services/economicReconciliationEvidenceService.js";

import {
  getLatestEconomicIntegrityIncidentEvent,
} from "../services/economicIntegrityIncidentService.js";

export const healthRouter =
  Router();

type PublicWorkerState =
  | "healthy"
  | "running"
  | "failed"
  | "stale"
  | "not_seen"
  | "unavailable"
  | "disabled";

const ECONOMIC_RECONCILIATION_STALE_MS =
  15 * 60 * 1000;

const WORKER_STALE_MS:
  Record<
    WorkerName,
    number
  > = {
    email:
      2 * 60 * 1000,

    usdt:
      3 * 60 * 1000,

    /*
     * Reserve worker runs every 5 minutes.
     * Allow two missed cycles before stale.
     */
    reserve:
      10 * 60 * 1000,
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

  let reserveWorker:
    PublicWorkerState =
      env.RESERVE_SWEEP_ENABLED
        ? "unavailable"
        : "disabled";

  let economicIntegrity:
    "ok" |
    "warning" |
    "critical" |
    "not_seen" |
    "stale" |
    "unavailable" =
      "unavailable";

  let economicReconciledAt:
    string | null =
      null;

  let economicReportHash:
    string | null =
      null;

  let economicIncidentState:
    "none" |
    "open" |
    "resolved" =
      "none";

  let economicIncidentSeverity:
    "WARNING" |
    "CRITICAL" |
    null =
      null;

  let economicIncidentUpdatedAt:
    string | null =
      null;

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

    const economicEvidence =
      getLatestEconomicReconciliationEvidence();

    const latestIncident =
      getLatestEconomicIntegrityIncidentEvent();

    if (latestIncident) {
      economicIncidentState =
        latestIncident.eventType ===
          "RESOLVED"
          ? "resolved"
          : "open";

      economicIncidentSeverity =
        latestIncident.severity;

      economicIncidentUpdatedAt =
        latestIncident.createdAt;
    }

    if (!economicEvidence) {
      economicIntegrity =
        "not_seen";
    } else {
      const reconciliationAgeMs =
        now -
        Date.parse(
          economicEvidence
            .reconciledAt,
        );

      const reconciliationStale =
        !Number.isFinite(
          reconciliationAgeMs,
        ) ||
        reconciliationAgeMs >
          ECONOMIC_RECONCILIATION_STALE_MS;

      economicIntegrity =
        reconciliationStale
          ? "stale"
          : economicEvidence.status ===
              "OK"
            ? "ok"
            : economicEvidence.status ===
                "WARNING"
              ? "warning"
              : "critical";

      economicReconciledAt =
        economicEvidence
          .reconciledAt;

      economicReportHash =
        economicEvidence
          .reportHash;
    }

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


    if (
      env.RESERVE_SWEEP_ENABLED
    ) {
      reserveWorker =
        workerState(
          "reserve",
          workers.find(
            (worker) =>
              worker.workerName ===
              "reserve",
          ),
          now,
        );
    }
  } catch {
    // Never expose raw operational errors publicly.
  }

  const checkout =
    env.PUBLIC_CHECKOUT_ENABLED
      ? "open"
      : "closed";

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

  const economicIntegrityReady =
    economicIntegrity !==
      "critical" &&
    economicIntegrity !==
      "stale";

  const overallReady =
    coreReady &&
    economicIntegrityReady;

  return {
    status:
      overallReady
        ? "ok"
        : "degraded",

    database,

    migrations,

    workers: {
      email:
        emailWorker,

      usdt:
        usdtWorker,

      reserve:
        reserveWorker,
    },

    operations:
      workersHealthy
        ? "ok"
        : "degraded",

    checkout,

    payments,

    economicIntegrity,

    economicReconciledAt,

    economicReportHash,

    economicIncidentState,

    economicIncidentSeverity,

    economicIncidentUpdatedAt,

    economicIntegrityReady,

    coreReady:
      overallReady,
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

      checkout:
        snapshot.checkout,

      payments:
        snapshot.payments,

      economicIntegrity:
        snapshot.economicIntegrity,

      economicReconciledAt:
        snapshot.economicReconciledAt,

      economicReportHash:
        snapshot.economicReportHash,

      economicIncidentState:
        snapshot.economicIncidentState,

      economicIncidentSeverity:
        snapshot.economicIncidentSeverity,

      economicIncidentUpdatedAt:
        snapshot.economicIncidentUpdatedAt,

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

        economicIntegrity:
          snapshot.economicIntegrity,

        economicReconciledAt:
          snapshot.economicReconciledAt,

        economicReportHash:
          snapshot.economicReportHash,

        economicIncidentState:
          snapshot.economicIncidentState,

        economicIncidentSeverity:
          snapshot.economicIncidentSeverity,

        economicIncidentUpdatedAt:
          snapshot.economicIncidentUpdatedAt,

        timestamp:
          new Date()
            .toISOString(),
      });
  },
);
