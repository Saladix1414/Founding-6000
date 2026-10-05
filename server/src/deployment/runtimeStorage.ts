import {
  accessSync,
  constants,
  mkdirSync,
  statSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";

export type RuntimeStorageInput = {
  databasePath:
    string;

  backupDirectory:
    string;
};

function ensureWritableDirectory(
  path:
    string,
) {
  mkdirSync(
    path,
    {
      recursive:
        true,
    },
  );

  const stat =
    statSync(
      path,
    );

  if (
    !stat.isDirectory()
  ) {
    throw new Error(
      "RUNTIME_STORAGE_NOT_DIRECTORY",
    );
  }

  accessSync(
    path,
    constants.W_OK,
  );
}

export function ensureRuntimeStorage(
  input:
    RuntimeStorageInput,
) {
  const databasePath =
    resolve(
      input.databasePath,
    );

  const databaseDirectory =
    dirname(
      databasePath,
    );

  const backupDirectory =
    resolve(
      input.backupDirectory,
    );

  ensureWritableDirectory(
    databaseDirectory,
  );

  ensureWritableDirectory(
    backupDirectory,
  );

  return {
    databaseDirectory,
    backupDirectory,
  };
}
