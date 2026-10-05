import {
  env,
} from "../config/env.js";

import {
  assertProductionRuntime,
} from "../config/productionRuntime.js";

import {
  ensureRuntimeStorage,
} from "../deployment/runtimeStorage.js";

assertProductionRuntime(
  env,
);

ensureRuntimeStorage({
  databasePath:
    env.DATABASE_PATH,

  backupDirectory:
    env.DATABASE_BACKUP_DIR,
});

/*
 * Import database-backed modules only after the persistent
 * directories exist.
 */
const {
  applyPendingDatabaseMigrations,
} =
  await import(
    "../db/migrationRegistry.js"
  );

const {
  db,
} =
  await import(
    "../db/database.js"
  );

try {
  const result =
    applyPendingDatabaseMigrations();

  const pending =
    result.status.filter(
      (
        migration,
      ) =>
        !migration.applied,
    );

  if (
    pending.length >
      0
  ) {
    throw new Error(
      "PRODUCTION_MIGRATIONS_REMAIN_PENDING",
    );
  }

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " PRODUCTION PREPARE = PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "RUNTIME_STORAGE=PASS",
  );

  console.log(
    "DATABASE_DIRECTORY=READY",
  );

  console.log(
    "BACKUP_DIRECTORY=READY",
  );

  console.log(
    `MIGRATIONS_APPLIED_NOW=${result.newlyApplied.length}`,
  );

  console.log(
    "MIGRATIONS_CURRENT=PASS",
  );

  console.log(
    `PUBLIC_CHECKOUT_ENABLED=${env.PUBLIC_CHECKOUT_ENABLED}`,
  );

  console.log(
    `PAYMENT_READINESS=${env.PAYMENT_READINESS}`,
  );

  console.log(
    `REAL_PAYMENTS_ENABLED=${env.REAL_PAYMENTS_ENABLED}`,
  );
} finally {
  db.close();
}
