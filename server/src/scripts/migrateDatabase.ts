import {
  existsSync,
  mkdirSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  db,
} from "../db/database.js";

import {
  applyPendingDatabaseMigrations,
} from "../db/migrationRegistry.js";

const databasePath =
  resolve(
    process.env.DATABASE_PATH ??
      "./server/data/founding-6000.sqlite",
  );

const backupDirectory =
  resolve(
    process.env
      .DATABASE_PRE_MIGRATION_BACKUP_DIR ??
      "./server/backups/pre-migration",
  );

mkdirSync(
  backupDirectory,
  {
    recursive: true,
  },
);

function sqlString(
  value: string,
) {
  return (
    "'" +
    value.replace(
      /'/g,
      "''",
    ) +
    "'"
  );
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(
      /[-:]/g,
      "",
    )
    .replace(
      "T",
      "-",
    )
    .replace(
      "Z",
      "",
    )
    .replace(
      ".",
      "-",
    );
}

/*
 * Verify the source before migration.
 */
const before =
  db.prepare(`
    PRAGMA integrity_check;
  `).all() as Array<
    Record<string, unknown>
  >;

if (
  before.length !== 1 ||
  Object.values(
    before[0] ?? {},
  )[0] !== "ok"
) {
  throw new Error(
    "DATABASE_INTEGRITY_FAILED_BEFORE_MIGRATION",
  );
}

/*
 * Every migration run gets a consistent
 * pre-migration recovery snapshot.
 */
const backupPath =
  resolve(
    backupDirectory,
    `founding-6000-pre-migration-${timestamp()}.sqlite`,
  );

db.exec(
  `VACUUM INTO ${sqlString(
    backupPath,
  )};`,
);

if (
  !existsSync(
    backupPath,
  )
) {
  throw new Error(
    "PRE_MIGRATION_BACKUP_NOT_CREATED",
  );
}

const result =
  applyPendingDatabaseMigrations();

const after =
  db.prepare(`
    PRAGMA integrity_check;
  `).all() as Array<
    Record<string, unknown>
  >;

if (
  after.length !== 1 ||
  Object.values(
    after[0] ?? {},
  )[0] !== "ok"
) {
  throw new Error(
    "DATABASE_INTEGRITY_FAILED_AFTER_MIGRATION",
  );
}

const foreignKeys =
  db.prepare(`
    PRAGMA foreign_key_check;
  `).all();

if (
  foreignKeys.length !==
    0
) {
  throw new Error(
    "DATABASE_FOREIGN_KEY_CHECK_FAILED_AFTER_MIGRATION",
  );
}

const pending =
  result.status.filter(
    (migration) =>
      !migration.applied,
  );

if (
  pending.length !== 0
) {
  throw new Error(
    "DATABASE_MIGRATIONS_REMAIN_PENDING",
  );
}

console.log("");
console.log(
  "============================================",
);

console.log(
  " DATABASE MIGRATION = PASS",
);

console.log(
  "============================================",
);

console.log(
  "PRE_MIGRATION_BACKUP=PASS",
);

console.log(
  `NEW_MIGRATIONS_APPLIED=${result.newlyApplied.length}`,
);

for (
  const id of
    result.newlyApplied
) {
  console.log(
    `APPLIED=${id}`,
  );
}

console.log(
  "PENDING_MIGRATIONS=0",
);

console.log(
  "INTEGRITY_CHECK=PASS",
);

console.log(
  "FOREIGN_KEY_CHECK=PASS",
);

db.close();
