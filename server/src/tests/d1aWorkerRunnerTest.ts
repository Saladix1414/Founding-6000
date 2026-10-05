import {
  rmSync,
} from "node:fs";

import {
  spawn,
} from "node:child_process";

import {
  resolve,
} from "node:path";

const dbPath =
  resolve(
    process.env.TEST_WORKER_DATABASE_PATH ??
      "./d1a-worker-test.sqlite",
  );

for (
  const file of [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

const child =
  spawn(
    "npx",
    [
      "tsx",
      "server/src/workers/workerRunner.ts",
    ],
    {
      cwd:
        process.cwd(),

      env: {
        ...process.env,

        DATABASE_PATH:
          dbPath,

        NODE_ENV:
          "test",

        FRONTEND_ORIGIN:
          "http://localhost:5173",

        TRUST_PROXY:
          "false",

        REAL_PAYMENTS_ENABLED:
          "false",

        PAYMENT_READINESS:
          "false",

        USDT_NETWORK:
          "ethereum-mainnet",

        USDT_CHAIN_ID:
          "1",

        USDT_TOKEN_CONTRACT:
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",

        USDT_DECIMALS:
          "6",

        USDT_RECEIVER_ADDRESS:
          "0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840",

        USDT_CONFIRMATIONS_REQUIRED:
          "12",
      },

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

let stdout =
  "";

let stderr =
  "";

child.stdout.on(
  "data",
  (chunk) => {
    stdout +=
      chunk.toString();
  },
);

child.stderr.on(
  "data",
  (chunk) => {
    stderr +=
      chunk.toString();
  },
);

function waitFor(
  token: string,
  timeoutMs:
    number,
) {
  return new Promise<void>(
    (
      resolveWait,
      rejectWait,
    ) => {
      const started =
        Date.now();

      const timer =
        setInterval(
          () => {
            if (
              stdout.includes(
                token,
              )
            ) {
              clearInterval(
                timer,
              );

              resolveWait();

              return;
            }

            if (
              Date.now() -
                started >
              timeoutMs
            ) {
              clearInterval(
                timer,
              );

              rejectWait(
                new Error(
                  `TIMEOUT_WAITING_FOR_${token}`,
                ),
              );
            }
          },
          50,
        );
    },
  );
}

try {
  await waitFor(
    '"event":"WORKER_STARTED"',
    10_000,
  );

  console.log(
    "[PASS] Worker process started",
  );

  await waitFor(
    '"event":"EMAIL_WORKER_CYCLE_COMPLETE"',
    10_000,
  );

  console.log(
    "[PASS] Initial email cycle completed",
  );

  await waitFor(
    '"event":"USDT_WORKER_CYCLE_COMPLETE"',
    10_000,
  );

  console.log(
    "[PASS] Initial USDT cycle completed",
  );

  child.kill(
    "SIGTERM",
  );

  await waitFor(
    '"event":"WORKER_STOPPED"',
    10_000,
  );

  const exitCode =
    await new Promise<
      number | null
    >(
      (resolveExit) => {
        child.once(
          "exit",
          resolveExit,
        );
      },
    );

  if (
    exitCode !== 0
  ) {
    throw new Error(
      `WORKER_EXIT_CODE_${exitCode}`,
    );
  }

  if (
    stderr.trim()
  ) {
    throw new Error(
      "WORKER_STDERR_NOT_EMPTY",
    );
  }

  if (
    !stdout.includes(
      '"signal":"SIGTERM"',
    )
  ) {
    throw new Error(
      "SIGTERM_NOT_RECORDED",
    );
  }

  console.log(
    "[PASS] SIGTERM handled cleanly",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D1-A WORKER RUNNER TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "WORKER_START=PASS",
  );

  console.log(
    "EMAIL_INITIAL_CYCLE=PASS",
  );

  console.log(
    "USDT_INITIAL_CYCLE=PASS",
  );

  console.log(
    "SIGTERM_SHUTDOWN=PASS",
  );

  console.log(
    "EXIT_CODE=0",
  );

  console.log(
    "REAL_PAYMENTS_ENABLED=false",
  );

  console.log(
    "PAYMENT_READINESS=false",
  );
} finally {
  if (
    child.exitCode === null &&
    !child.killed
  ) {
    child.kill(
      "SIGKILL",
    );
  }

  for (
    const file of [
      dbPath,
      `${dbPath}-wal`,
      `${dbPath}-shm`,
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
