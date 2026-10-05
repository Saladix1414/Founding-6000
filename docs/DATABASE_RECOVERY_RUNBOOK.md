# Founding 6000 — Database Recovery Runbook

## Normal safety model

The authoritative SQLite database must live on persistent storage.

Never restore while the API or worker process is writing to the database.

## Create a backup

Command:

    npm run db:backup

A successful backup must report:

    SQLITE_SNAPSHOT=CONSISTENT
    INTEGRITY_CHECK=PASS
    FOREIGN_KEY_CHECK=PASS

## Test backups regularly

Command:

    npm run db:restore-test

Required:

    RESTORE_INTEGRITY=PASS
    ROW_COUNTS_MATCH=PASS
    RESTORED_DATABASE_WRITABLE=PASS

## Before schema changes

Run:

    npm run db:migrate

The migration command creates a pre-migration SQLite snapshot before applying pending migrations.

Then verify:

    npm run db:migrations:status

Required:

    DATABASE_MIGRATIONS=PASS
    PENDING_MIGRATIONS=0

## Emergency recovery procedure

1. Stop the API service.
2. Stop the Founding worker service.
3. Preserve the current database and its WAL/SHM files.
4. Select a previously verified backup.
5. Copy the verified backup to a new recovery location.
6. Run SQLite integrity and foreign-key checks.
7. Point DATABASE_PATH to the recovered copy.
8. Run npm run db:migrate.
9. Run npm run db:migrations:status.
10. Start the API.
11. Start the workers.
12. Verify /api/health.
13. Verify campaign inventory and order counts before accepting traffic.

Never overwrite the only copy of a damaged database before preserving it.

## Production rule

Backups stored only on the same server are not sufficient disaster recovery.

At least one backup copy must eventually be stored outside the production server.
