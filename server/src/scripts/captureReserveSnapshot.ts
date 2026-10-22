import {
  initializeDatabase,
} from "../db/database.js";

import {
  applyPendingDatabaseMigrations,
} from "../db/migrationRegistry.js";

import {
  captureReserveProofSnapshot,
} from "../services/reserveProofService.js";

initializeDatabase();

applyPendingDatabaseMigrations();

const snapshot =
  await captureReserveProofSnapshot();

console.log(
  JSON.stringify(
    snapshot,
    null,
    2,
  ),
);
