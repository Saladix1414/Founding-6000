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

import {
  recordEconomicIntegrityObservation,
} from "../services/economicIntegrityIncidentService.js";

import {
  syncEconomicIncidentAlerts,
} from "../services/economicAlertOutboxService.js";

import {
  dispatchEconomicAlerts,
} from "../services/economicAlertDeliveryService.js";

import {
  createEconomicAlertWebhookAdapter,
} from "../services/economicAlertWebhookAdapter.js";


import {
  evaluateEconomicReconciliationStaleness,
} from "../services/economicIntegrityStaleService.js";

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

const ECONOMIC_ALERT_DELIVERY_INTERVAL_MS =
  60_000;

const ECONOMIC_ALERT_DELIVERY_BATCH_SIZE =
  25;

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

let economicAlertDeliveryRunning =
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

let economicAlertDeliveryTimer:
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

    const failingCodes =
      result
        .report
        .checks
        .filter(
          (check) =>
            !check.passed,
        )
        .map(
          (check) =>
            check.code,
        );

    const incidentResult =
      recordEconomicIntegrityObservation({
        state:
          result.report.status,

        reportHash:
          result.reportHash,

        failingCodes,

        evidence: {
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

          reconciledAt:
            result
              .report
              .reconciledAt,
        },
      });

    /*
     * Synchronize durable incident history into the
     * informational alert outbox.
     *
     * This does NOT deliver alerts.
     * This does NOT mutate reserve state.
     * This does NOT execute blockchain transactions.
     */
    const alertSync =
      syncEconomicIncidentAlerts();

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

        incidentAction:
          incidentResult.action,

        incidentEventType:
          incidentResult
            .event
            ?.eventType,

        alertSyncScanned:
          alertSync.scanned,

        alertSyncCreated:
          alertSync.created,

        alertSyncReplayed:
          alertSync.replayed,
      },
    );
  } catch (error) {
    /*
     * Reconciliation never repairs or mutates
     * economic authority.
     *
     * On failure, evaluate whether the most recent
     * durable reconciliation evidence has crossed
     * the STALE threshold.
     *
     * If so:
     *   STALE -> incident ledger -> alert outbox
     *
     * No alert delivery, reserve mutation,
     * auto-repair or blockchain transaction occurs.
     */
    try {
      const staleResult =
        evaluateEconomicReconciliationStaleness();

      const staleAlertSync =
        staleResult.stale
          ? syncEconomicIncidentAlerts()
          : {
              scanned:
                0,

              created:
                0,

              replayed:
                0,
            };

      logEvent(
        "ECONOMIC_RECONCILIATION_FAILURE_STALE_EVALUATION",
        {
          stale:
            staleResult.stale,

          staleState:
            staleResult.state,

          staleAgeMs:
            staleResult.ageMs,

          staleIncidentAction:
            staleResult
              .incidentResult
              ?.action,

          staleIncidentEventType:
            staleResult
              .incidentResult
              ?.event
              ?.eventType,

          alertSyncScanned:
            staleAlertSync.scanned,

          alertSyncCreated:
            staleAlertSync.created,

          alertSyncReplayed:
            staleAlertSync.replayed,
        },
      );
    } catch (staleError) {
      logError(
        "ECONOMIC_RECONCILIATION_STALE_EVALUATION_FAILED",
        staleError,
      );
    }

    logError(
      "ECONOMIC_RECONCILIATION_CYCLE_FAILED",
      error,
    );
  } finally {
    reconciliationRunning =
      false;
  }
}

async function runEconomicAlertDeliveryCycle() {
  if (
    stopping ||
    economicAlertDeliveryRunning ||
    !env.ECONOMIC_ALERT_DELIVERY_ENABLED
  ) {
    return;
  }

  economicAlertDeliveryRunning =
    true;

  recordWorkerCycleStarted(
    "economic_alert_delivery",
  );

  try {
    const adapter =
      createEconomicAlertWebhookAdapter();

    const result =
      await dispatchEconomicAlerts({
        limit:
          ECONOMIC_ALERT_DELIVERY_BATCH_SIZE,

        adapter,
      });

    recordWorkerCycleCompleted(
      "economic_alert_delivery",
    );

    logEvent(
      "ECONOMIC_ALERT_DELIVERY_CYCLE_COMPLETE",
      {
        processed:
          result.processed,

        delivered:
          result.delivered,

        retrying:
          result.retrying,

        failed:
          result.failed,
      },
    );
  } catch (error) {
    recordWorkerCycleFailed(
      "economic_alert_delivery",
    );

    logError(
      "ECONOMIC_ALERT_DELIVERY_CYCLE_FAILED",
      error,
    );
  } finally {
    economicAlertDeliveryRunning =
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
    env.ECONOMIC_ALERT_DELIVERY_ENABLED
  ) {
    economicAlertDeliveryTimer =
      setInterval(
        () => {
          void runEconomicAlertDeliveryCycle();
        },
        ECONOMIC_ALERT_DELIVERY_INTERVAL_MS,
      );
  }

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
  void runReconciliationCycle();

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

  if (
    economicAlertDeliveryTimer
  ) {
    clearInterval(
      economicAlertDeliveryTimer,
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
      reconciliationRunning ||
      economicAlertDeliveryRunning
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

      economicAlertDeliveryStillRunning:
        economicAlertDeliveryRunning,
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

      economicAlertDeliveryIntervalMs:
        ECONOMIC_ALERT_DELIVERY_INTERVAL_MS,

      economicAlertDeliveryEnabled:
        env.ECONOMIC_ALERT_DELIVERY_ENABLED,

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
