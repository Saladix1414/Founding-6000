import {
  db,
} from "../db/database.js";

export type WorkerName =
  | "email"
  | "usdt";

export type WorkerHealthRow = {
  workerName:
    WorkerName;

  lastStartedAt:
    string | null;

  lastCompletedAt:
    string | null;

  lastFailedAt:
    string | null;

  lastStatus:
    "RUNNING"
    | "OK"
    | "FAILED";

  updatedAt:
    string;
};

export function recordWorkerCycleStarted(
  workerName:
    WorkerName,
) {
  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO worker_health (
      worker_name,
      last_started_at,
      last_completed_at,
      last_failed_at,
      last_status,
      updated_at
    )
    VALUES (
      ?,
      ?,
      NULL,
      NULL,
      'RUNNING',
      ?
    )

    ON CONFLICT(worker_name)
    DO UPDATE SET
      last_started_at =
        excluded.last_started_at,

      last_status =
        'RUNNING',

      updated_at =
        excluded.updated_at
  `).run(
    workerName,
    now,
    now,
  );
}

export function recordWorkerCycleCompleted(
  workerName:
    WorkerName,
) {
  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO worker_health (
      worker_name,
      last_started_at,
      last_completed_at,
      last_failed_at,
      last_status,
      updated_at
    )
    VALUES (
      ?,
      ?,
      ?,
      NULL,
      'OK',
      ?
    )

    ON CONFLICT(worker_name)
    DO UPDATE SET
      last_completed_at =
        excluded.last_completed_at,

      last_status =
        'OK',

      updated_at =
        excluded.updated_at
  `).run(
    workerName,
    now,
    now,
    now,
  );
}

export function recordWorkerCycleFailed(
  workerName:
    WorkerName,
) {
  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO worker_health (
      worker_name,
      last_started_at,
      last_completed_at,
      last_failed_at,
      last_status,
      updated_at
    )
    VALUES (
      ?,
      ?,
      NULL,
      ?,
      'FAILED',
      ?
    )

    ON CONFLICT(worker_name)
    DO UPDATE SET
      last_failed_at =
        excluded.last_failed_at,

      last_status =
        'FAILED',

      updated_at =
        excluded.updated_at
  `).run(
    workerName,
    now,
    now,
    now,
  );
}

export function getWorkerHealthRows() {
  return db.prepare(`
    SELECT
      worker_name AS workerName,
      last_started_at AS lastStartedAt,
      last_completed_at AS lastCompletedAt,
      last_failed_at AS lastFailedAt,
      last_status AS lastStatus,
      updated_at AS updatedAt

    FROM worker_health

    ORDER BY worker_name
  `).all() as
    WorkerHealthRow[];
}
