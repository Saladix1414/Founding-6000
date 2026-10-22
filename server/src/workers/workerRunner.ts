import {
  env,
} from "../config/env.js";

import {
  assertProductionRuntime,
} from "../config/productionRuntime.js";

import {
  initializeDatabase,
} from "../db/database.js";

import {
  ensureMembershipSchema,
} from "../db/membershipSchema.js";

import {
  ensureEmailOutboxSchema,
} from "../db/emailOutboxSchema.js";

import {
  ensureWorkerHealthSchema,
} from "../db/workerHealthSchema.js";

import {
  recordWorkerCycleStarted,
  recordWorkerCycleCompleted,
  recordWorkerCycleFailed,
} from "../repositories/workerHealthRepository.js";

import {
  dispatchEmailOutbox,
} from "../services/emailDispatcher.js";

import {
  processPendingUsdtVerifications,
} from "../services/usdtVerificationPipeline.js";

import {
  runReserveAutomationCycle,
} from "../services/reserveAutomationService.js";

import {
  captureEconomicReconciliationEvidence,
} from "../services/economicReconciliationEvidenceService.js";

const EMAIL_INTERVAL_MS =
  30_000;

const USDT_INTERVAL_MS =
  60_000;

/*
 * Reserve sweeps are intentionally less frequent
 * than payment verification.
 */
const RESERVE_INTERVAL_MS =
  5 * 60_000;

/*
 * Economic reconciliation is independent from reserve
 * sweep enablement. It is read-only and should continue
 * even when automated treasury movement is disabled.
 */
const RECONCILIATION_INTERVAL_MS =
  5 * 60_000;

const EMAIL_BATCH_SIZE =
  25;

const USDT_BATCH_SIZE =
  20;

let stopping =
  false;

let emailRunning =
  false;

let usdtRunning =
  false;

let reserveRunning =
  false;

let reconciliationRunning =
  false;

let emailTimer:
  NodeJS.Timeout | null =
    null;

let usdtTimer:
  NodeJS.Timeout | null =
    null;

let reserveTimer:
  NodeJS.Timeout | null =
    null;

let reconciliationTimer:
  NodeJS.Timeout | null =
    null;

function logEvent(
  event: string,
  payload?: Record<
    string,
    unknown
  >,
) {
  const record = {
    timestamp:
      new Date().toISOString(),

    event,

    ...(payload ?? {}),
  };

  console.log(
    JSON.stringify(
      record,
    ),
  );
}

function logError(
  event: string,
  error: unknown,
) {
  const errorType =
    error instanceof Error
      ? error.name
      : "UnknownError";

  logEvent(
    event,
    {
      errorType,
    },
  );
}

async function runEmailCycle() {
  if (
    stopping ||
    emailRunning
  ) {
    return;
  }

  emailRunning =
    true;

  recordWorkerCycleStarted(
    "email",
  );

  try {
    const result =
      await dispatchEmailOutbox({
        limit:
          EMAIL_BATCH_SIZE,
      });

    recordWorkerCycleCompleted(
      "email",
    );

    logEvent(
      "EMAIL_WORKER_CYCLE_COMPLETE",
      {
        processed:
          Array.isArray(result)
            ? result.length
            : undefined,
      },
    );
  } catch (error) {
    recordWorkerCycleFailed(
      "email",
    );

    logError(
      "EMAIL_WORKER_CYCLE_FAILED",
      error,
    );
  } finally {
    emailRunning =
      false;
  }
}

async function runUsdtCycle() {
  if (
    stopping ||
    usdtRunning
  ) {
    return;
  }

  usdtRunning =
    true;

  recordWorkerCycleStarted(
    "usdt",
  );

  try {
    const results =
      await processPendingUsdtVerifications({
        limit:
          USDT_BATCH_SIZE,
      });

    recordWorkerCycleCompleted(
      "usdt",
    );

    logEvent(
      "USDT_WORKER_CYCLE_COMPLETE",
      {
        processed:
          results.length,
      },
    );
  } catch (error) {
    recordWorkerCycleFailed(
      "usdt",
    );

    logError(
      "USDT_WORKER_CYCLE_FAILED",
      error,
    );
  } finally {
    usdtRunning =
      false;
  }
}

async function runReserveCycle() {
  if (
    stopping ||
    reserveRunning ||
    !env.RESERVE_SWEEP_ENABLED
  ) {
    return;
  }

  reserveRunning =
    true;

  recordWorkerCycleStarted(
    "reserve",
  );

  try {
    const result =
      await runReserveAutomationCycle();

    recordWorkerCycleCompleted(
      "reserve",
    );

    logEvent(
      "RESERVE_WORKER_CYCLE_COMPLETE",
      {
        status:
          result.status,
      },
    );
  } catch (error) {
    recordWorkerCycleFailed(
      "reserve",
    );

    logError(
      "RESERVE_WORKER_CYCLE_FAILED",
      error,
    );
  } finally {
    reserveRunning =
      false;
  }
}

async function runReconciliationCycle() {
  if (
    stopping ||
    reconciliationRunning
  ) {
    return;
  }

  reconciliationRunning =
    true;

  try {
    const result =
      captureEconomicReconciliationEvidence();

    logEvent(
      "ECONOMIC_RECONCILIATION_CYCLE_COMPLETE",
      {
        status:
          result.report.status,

        criticalFailures:
          result
            .report
            .summary
            .criticalFailures,

        warnings:
          result
            .report
            .summary
            .warnings,

        reportHash:
          result.reportHash,
      },
    );
  } catch (error) {
    /*
     * Reconciliation never repairs or mutates
     * economic authority. Failure is surfaced
     * operationally and the previous evidence
     * will eventually become stale.
     */
    logError(
      "ECONOMIC_RECONCILIATION_CYCLE_FAILED",
      error,
    );
  } finally {
    reconciliationRunning =
      false;
  }
}

function scheduleWorkers() {
  emailTimer =
    setInterval(
      () => {
        void runEmailCycle();
      },
      EMAIL_INTERVAL_MS,
    );

  usdtTimer =
    setInterval(
      () => {
        void runUsdtCycle();
      },
      USDT_INTERVAL_MS,
    );

  reconciliationTimer =
    setInterval(
      () => {
        void runReconciliationCycle();
      },
      RECONCILIATION_INTERVAL_MS,
    );

  if (
    env.RESERVE_SWEEP_ENABLED
  ) {
    reserveTimer =
      setInterval(
        () => {
          void runReserveCycle();
        },
        RESERVE_INTERVAL_MS,
      );
  }

  void runEmailCycle();
  void runUsdtCycle();

  if (
    env.RESERVE_SWEEP_ENABLED
  ) {
    void runReserveCycle();
  }
}

async function shutdown(
  signal: string,
) {
  if (stopping) {
    return;
  }

  stopping =
    true;

  logEvent(
    "WORKER_SHUTDOWN_REQUESTED",
    {
      signal,
    },
  );

  if (emailTimer) {
    clearInterval(
      emailTimer,
    );
  }

  if (usdtTimer) {
    clearInterval(
      usdtTimer,
    );
  }

  if (reserveTimer) {
    clearInterval(
      reserveTimer,
    );
  }

  if (reconciliationTimer) {
    clearInterval(
      reconciliationTimer,
    );
  }

  const deadline =
    Date.now() +
    10_000;

  while (
    (
      emailRunning ||
      usdtRunning ||
      reserveRunning ||
      reconciliationRunning
    ) &&
    Date.now() <
      deadline
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          100,
        ),
    );
  }

  logEvent(
    "WORKER_STOPPED",
    {
      emailStillRunning:
        emailRunning,

      usdtStillRunning:
        usdtRunning,

      reserveStillRunning:
        reserveRunning,

      reconciliationStillRunning:
        reconciliationRunning,
    },
  );

  process.exit(0);
}

async function main() {
  assertProductionRuntime(
    env,
  );

  initializeDatabase();
  ensureMembershipSchema();
  ensureEmailOutboxSchema();
  ensureWorkerHealthSchema();

  logEvent(
    "WORKER_STARTING",
    {
      emailIntervalMs:
        EMAIL_INTERVAL_MS,

      usdtIntervalMs:
        USDT_INTERVAL_MS,

      reserveIntervalMs:
        RESERVE_INTERVAL_MS,

      reconciliationIntervalMs:
        RECONCILIATION_INTERVAL_MS,

      reserveEnabled:
        env.RESERVE_SWEEP_ENABLED,

      emailBatchSize:
        EMAIL_BATCH_SIZE,

      usdtBatchSize:
        USDT_BATCH_SIZE,
    },
  );

  process.once(
    "SIGTERM",
    () => {
      void shutdown(
        "SIGTERM",
      );
    },
  );

  process.once(
    "SIGINT",
    () => {
      void shutdown(
        "SIGINT",
      );
    },
  );

  process.on(
    "unhandledRejection",
    (error) => {
      logError(
        "WORKER_UNHANDLED_REJECTION",
        error,
      );
    },
  );

  process.on(
    "uncaughtException",
    (error) => {
      logError(
        "WORKER_UNCAUGHT_EXCEPTION",
        error,
      );

      process.exitCode =
        1;
    },
  );

  scheduleWorkers();

  logEvent(
    "WORKER_STARTED",
  );
}

await main();
