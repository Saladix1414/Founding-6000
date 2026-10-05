import {
  randomUUID,
} from "node:crypto";

import {
  copyFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";

import {
  join,
  resolve,
} from "node:path";

import {
  DatabaseSync,
} from "node:sqlite";

const backupDirectory =
  resolve(
    process.env.DATABASE_BACKUP_DIR ??
      "./server/backups",
  );

const restorePath =
  resolve(
    process.env.DATABASE_RESTORE_TEST_PATH ??
      "./server/data/restore-test.sqlite",
  );

const candidates =
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

const latestBackup =
  candidates.at(
    -1,
  );

if (!latestBackup) {
  throw new Error(
    "NO_DATABASE_BACKUP_AVAILABLE",
  );
}

const backupPath =
  join(
    backupDirectory,
    latestBackup,
  );

for (
  const file of [
    restorePath,
    `${restorePath}-wal`,
    `${restorePath}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

copyFileSync(
  backupPath,
  restorePath,
);

if (
  !existsSync(
    restorePath,
  )
) {
  throw new Error(
    "RESTORE_COPY_NOT_CREATED",
  );
}

function integrityOk(
  db: DatabaseSync,
) {
  const result =
    db.prepare(`
      PRAGMA integrity_check;
    `).all() as Array<
      Record<string, unknown>
    >;

  return (
    result.length === 1 &&
    Object.values(
      result[0] ?? {},
    )[0] === "ok"
  );
}

function tableNames(
  db: DatabaseSync,
) {
  return new Set(
    (
      db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `).all() as Array<{
        name: string;
      }>
    ).map(
      (row) =>
        row.name,
    ),
  );
}

function countRows(
  db: DatabaseSync,
  table: string,
) {
  const row =
    db.prepare(
      `SELECT COUNT(*) AS count FROM "${table}"`,
    ).get() as {
      count:
        number | bigint;
    };

  return Number(
    row.count,
  );
}

const requiredTables = [
  "campaigns",
  "campaign_phases",
  "email_registrations",
  "founding_orders",
  "audit_events",
  "inventory_allocations",
  "payment_quotes",
  "payment_attempts",
  "payment_settlements",
  "founding_memberships",
  "email_outbox",
  "database_migrations",
  "worker_health",
];

const source =
  new DatabaseSync(
    backupPath,
  );

const restored =
  new DatabaseSync(
    restorePath,
  );

try {
  source.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  restored.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  if (
    !integrityOk(
      source,
    )
  ) {
    throw new Error(
      "SOURCE_BACKUP_INTEGRITY_FAILED",
    );
  }

  if (
    !integrityOk(
      restored,
    )
  ) {
    throw new Error(
      "RESTORED_DATABASE_INTEGRITY_FAILED",
    );
  }

  const fkProblems =
    restored.prepare(`
      PRAGMA foreign_key_check;
    `).all();

  if (
    fkProblems.length !==
      0
  ) {
    throw new Error(
      "RESTORED_DATABASE_FOREIGN_KEYS_FAILED",
    );
  }

  const sourceTables =
    tableNames(
      source,
    );

  const restoredTables =
    tableNames(
      restored,
    );

  for (
    const table of
      requiredTables
  ) {
    if (
      !sourceTables.has(
        table,
      )
    ) {
      throw new Error(
        `SOURCE_TABLE_MISSING_${table}`,
      );
    }

    if (
      !restoredTables.has(
        table,
      )
    ) {
      throw new Error(
        `RESTORED_TABLE_MISSING_${table}`,
      );
    }
  }

  /*
   * A restore must reproduce exactly the same
   * authoritative row counts as the backup.
   */
  for (
    const table of
      requiredTables
  ) {
    const sourceCount =
      countRows(
        source,
        table,
      );

    const restoredCount =
      countRows(
        restored,
        table,
      );

    if (
      sourceCount !==
        restoredCount
    ) {
      throw new Error(
        `RESTORE_COUNT_MISMATCH_${table}_${sourceCount}_${restoredCount}`,
      );
    }
  }

  /*
   * Controlled write test.
   *
   * The INSERT is deliberately rolled back.
   * This proves that the recovered DB is writable
   * without permanently changing the restored copy.
   */
  const auditCountBefore =
    countRows(
      restored,
      "audit_events",
    );

  restored.exec(
    "BEGIN IMMEDIATE;",
  );

  try {
    restored.prepare(`
      INSERT INTO audit_events (
        id,
        event_type,
        entity_type,
        entity_id,
        payload_json,
        created_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `).run(
      randomUUID(),
      "RESTORE_WRITE_TEST",
      "SYSTEM",
      null,
      JSON.stringify({
        test:
          true,
      }),
      new Date()
        .toISOString(),
    );

    const during =
      countRows(
        restored,
        "audit_events",
      );

    if (
      during !==
        auditCountBefore + 1
    ) {
      throw new Error(
        "RESTORE_DATABASE_NOT_WRITABLE",
      );
    }

    restored.exec(
      "ROLLBACK;",
    );
  } catch (error) {
    try {
      restored.exec(
        "ROLLBACK;",
      );
    } catch {
      // Best effort.
    }

    throw error;
  }

  const auditCountAfter =
    countRows(
      restored,
      "audit_events",
    );

  if (
    auditCountAfter !==
      auditCountBefore
  ) {
    throw new Error(
      "RESTORE_WRITE_TEST_DID_NOT_ROLLBACK",
    );
  }

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " DATABASE RESTORE TEST = PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    `SOURCE_BACKUP=${latestBackup}`,
  );

  console.log(
    "BACKUP_INTEGRITY=PASS",
  );

  console.log(
    "RESTORE_INTEGRITY=PASS",
  );

  console.log(
    "FOREIGN_KEY_CHECK=PASS",
  );

  console.log(
    "REQUIRED_TABLES=PASS",
  );

  console.log(
    "ROW_COUNTS_MATCH=PASS",
  );

  console.log(
    "RESTORED_DATABASE_WRITABLE=PASS",
  );

  console.log(
    "CONTROLLED_WRITE_ROLLBACK=PASS",
  );

  console.log(
    "ACTIVE_DATABASE_TOUCHED=NO",
  );
} finally {
  source.close();
  restored.close();
}

for (
  const file of [
    restorePath,
    `${restorePath}-wal`,
    `${restorePath}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}
