import {
  db,
} from "../db/database.js";

import {
  getDatabaseMigrationStatus,
} from "../db/migrationRegistry.js";

try {
  const status =
    getDatabaseMigrationStatus();

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " DATABASE MIGRATION STATUS",
  );

  console.log(
    "============================================",
  );

  for (
    const migration of
      status
  ) {
    console.log(
      `${
        migration.applied
          ? "PASS"
          : "PENDING"
      } — ${migration.id} — ${migration.description}`,
    );
  }

  const pending =
    status.filter(
      (migration) =>
        !migration.applied,
    );

  console.log("");

  if (
    pending.length > 0
  ) {
    console.log(
      `PENDING_MIGRATIONS=${pending.length}`,
    );

    process.exitCode =
      1;
  } else {
    console.log(
      "DATABASE_MIGRATIONS=PASS",
    );

    console.log(
      "PENDING_MIGRATIONS=0",
    );
  }
} finally {
  db.close();
}
