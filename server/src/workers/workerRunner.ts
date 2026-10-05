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

const EMAIL_INTERVAL_MS =
  30_000;

const USDT_INTERVAL_MS =
  60_000;

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

let emailTimer:
  NodeJS.Timeout | null =
    null;

let usdtTimer:
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

  void runEmailCycle();
  void runUsdtCycle();
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

  const deadline =
    Date.now() +
    10_000;

  while (
    (
      emailRunning ||
      usdtRunning
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
