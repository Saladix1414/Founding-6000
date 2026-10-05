import {
  DatabaseSync,
} from "node:sqlite";

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";

import {
  basename,
  join,
  resolve,
} from "node:path";

const databasePath =
  resolve(
    process.env.DATABASE_PATH ??
      "./server/data/founding-6000.sqlite",
  );

const backupDirectory =
  resolve(
    process.env.DATABASE_BACKUP_DIR ??
      "./server/backups",
  );

const requestedRetention =
  Number(
    process.env.DATABASE_BACKUP_RETENTION ??
      "14",
  );

const retention =
  Number.isInteger(
    requestedRetention,
  ) &&
  requestedRetention >= 1 &&
  requestedRetention <= 100
    ? requestedRetention
    : 14;

if (
  !existsSync(
    databasePath,
  )
) {
  throw new Error(
    "DATABASE_SOURCE_NOT_FOUND",
  );
}

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

function backupTimestamp(
  date: Date,
) {
  return date
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

function verifyDatabase(
  path: string,
) {
  const checkDb =
    new DatabaseSync(
      path,
    );

  try {
    checkDb.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `);

    const integrity =
      checkDb.prepare(`
        PRAGMA integrity_check;
      `).all() as Array<
        Record<
          string,
          unknown
        >
      >;

    if (
      integrity.length !== 1 ||
      Object.values(
        integrity[0] ?? {},
      )[0] !== "ok"
    ) {
      throw new Error(
        "BACKUP_INTEGRITY_CHECK_FAILED",
      );
    }

    const foreignKeyProblems =
      checkDb.prepare(`
        PRAGMA foreign_key_check;
      `).all();

    if (
      foreignKeyProblems.length !==
      0
    ) {
      throw new Error(
        "BACKUP_FOREIGN_KEY_CHECK_FAILED",
      );
    }

    const tables =
      checkDb.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
      `).all() as Array<{
        name: string;
      }>;

    const tableNames =
      new Set(
        tables.map(
          (table) =>
            table.name,
        ),
      );

    const requiredTables = [
      "campaigns",
      "campaign_phases",
      "founding_orders",
      "inventory_allocations",
      "payment_attempts",
      "payment_settlements",
      "founding_memberships",
      "email_outbox",
      "audit_events",
    ];

    const missing =
      requiredTables.filter(
        (name) =>
          !tableNames.has(
            name,
          ),
      );

    if (
      missing.length > 0
    ) {
      throw new Error(
        "BACKUP_REQUIRED_TABLES_MISSING:" +
          missing.join(","),
      );
    }

    const counts:
      Record<
        string,
        number
      > =
      {};

    for (
      const table of
        requiredTables
    ) {
      const row =
        checkDb.prepare(
          `SELECT COUNT(*) AS count FROM "${table}"`,
        ).get() as {
          count:
            number | bigint;
        };

      counts[table] =
        Number(
          row.count,
        );
    }

    return counts;
  } finally {
    checkDb.close();
  }
}

const timestamp =
  backupTimestamp(
    new Date(),
  );

const backupFilename =
  `founding-6000-${timestamp}.sqlite`;

const backupPath =
  join(
    backupDirectory,
    backupFilename,
  );

if (
  existsSync(
    backupPath,
  )
) {
  throw new Error(
    "BACKUP_ALREADY_EXISTS",
  );
}

/*
 * VACUUM INTO produces a new consistent SQLite
 * database snapshot.
 *
 * This is intentionally used instead of blindly
 * copying the main .sqlite file while WAL mode is active.
 */
const sourceDb =
  new DatabaseSync(
    databasePath,
  );

try {
  sourceDb.exec(`
    PRAGMA busy_timeout = 5000;
  `);

  sourceDb.exec(
    `VACUUM INTO ${sqlString(
      backupPath,
    )};`,
  );
} finally {
  sourceDb.close();
}

if (
  !existsSync(
    backupPath,
  )
) {
  throw new Error(
    "BACKUP_FILE_NOT_CREATED",
  );
}

const counts =
  verifyDatabase(
    backupPath,
  );

const backupSize =
  statSync(
    backupPath,
  ).size;

/*
 * Retention:
 * filenames sort chronologically because the
 * timestamp format is lexicographically sortable.
 */
const backupFiles =
  readdirSync(
    backupDirectory,
  )
    .filter(
      (name) =>
        /^founding-6000-\d{8}-\d{6}-\d{3}\.sqlite$/.test(
          name,
        ),
    )
    .sort();

const excess =
  Math.max(
    0,
    backupFiles.length -
      retention,
  );

const removed:
  string[] =
  [];

for (
  const oldName of
    backupFiles.slice(
      0,
      excess,
    )
) {
  const oldPath =
    join(
      backupDirectory,
      oldName,
    );

  /*
   * Never remove the backup that was just created.
   */
  if (
    resolve(
      oldPath,
    ) ===
    resolve(
      backupPath,
    )
  ) {
    continue;
  }

  unlinkSync(
    oldPath,
  );

  removed.push(
    oldName,
  );
}

console.log("");
console.log(
  "============================================",
);

console.log(
  " DATABASE BACKUP = PASS",
);

console.log(
  "============================================",
);

console.log(
  `BACKUP_FILE=${basename(
    backupPath,
  )}`,
);

console.log(
  `BACKUP_SIZE_BYTES=${backupSize}`,
);

console.log(
  "SQLITE_SNAPSHOT=CONSISTENT",
);

console.log(
  "INTEGRITY_CHECK=PASS",
);

console.log(
  "FOREIGN_KEY_CHECK=PASS",
);

console.log(
  `RETENTION_LIMIT=${retention}`,
);

console.log(
  `OLD_BACKUPS_REMOVED=${removed.length}`,
);

console.log(
  `CAMPAIGNS=${counts.campaigns}`,
);

console.log(
  `ORDERS=${counts.founding_orders}`,
);

console.log(
  `ALLOCATIONS=${counts.inventory_allocations}`,
);

console.log(
  `PAYMENT_ATTEMPTS=${counts.payment_attempts}`,
);

console.log(
  `SETTLEMENTS=${counts.payment_settlements}`,
);

console.log(
  `MEMBERSHIPS=${counts.founding_memberships}`,
);

console.log(
  `EMAIL_OUTBOX=${counts.email_outbox}`,
);
