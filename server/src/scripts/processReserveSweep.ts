import {
  initializeDatabase,
} from "../db/database.js";

import {
  applyPendingDatabaseMigrations,
} from "../db/migrationRegistry.js";

import {
  createPendingReserveSweep,
} from "../services/reserveSweepService.js";

import {
  processReserveSweepOnce,
} from "../web3/reserveSweepExecutor.js";

initializeDatabase();

applyPendingDatabaseMigrations();

const creation =
  createPendingReserveSweep();

console.log(
  JSON.stringify(
    {
      phase:
        "CREATE_SWEEP",

      result:
        creation,
    },
    (_, value) =>
      typeof value ===
        "bigint"
        ? value.toString()
        : value,
  ),
);

const execution =
  await processReserveSweepOnce();

console.log(
  JSON.stringify(
    {
      phase:
        "EXECUTE_SWEEP",

      result:
        execution,
    },
  ),
);
