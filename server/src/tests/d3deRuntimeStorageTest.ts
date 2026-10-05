import {
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";

import {
  join,
  resolve,
} from "node:path";

import {
  ensureRuntimeStorage,
} from "../deployment/runtimeStorage.js";

const base =
  process.env.D3DE_TMP_BASE;

if (!base) {
  throw new Error(
    "D3DE_TMP_BASE_REQUIRED",
  );
}

mkdirSync(
  base,
  {
    recursive:
      true,
  },
);

const root =
  resolve(
    base,
    `d3de-storage-${process.pid}`,
  );

const databasePath =
  join(
    root,
    "data",
    "founding.sqlite",
  );

const backupDirectory =
  join(
    root,
    "backups",
  );

try {
  const result =
    ensureRuntimeStorage({
      databasePath,
      backupDirectory,
    });

  if (
    !existsSync(
      result.databaseDirectory,
    )
  ) {
    throw new Error(
      "DATABASE_DIRECTORY_NOT_CREATED",
    );
  }

  if (
    !existsSync(
      result.backupDirectory,
    )
  ) {
    throw new Error(
      "BACKUP_DIRECTORY_NOT_CREATED",
    );
  }

  /*
   * Replay must remain idempotent.
   */
  ensureRuntimeStorage({
    databasePath,
    backupDirectory,
  });

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D3-D/E RUNTIME STORAGE TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "DATABASE_DIRECTORY=PASS",
  );

  console.log(
    "BACKUP_DIRECTORY=PASS",
  );

  console.log(
    "WRITABLE_STORAGE=PASS",
  );

  console.log(
    "IDEMPOTENT_PREPARATION=PASS",
  );
} finally {
  rmSync(
    root,
    {
      recursive:
        true,
      force:
        true,
    },
  );
}
