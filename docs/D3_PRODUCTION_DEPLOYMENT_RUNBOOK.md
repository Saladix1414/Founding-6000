# Founding 6000 — Production Deployment Runbook

## Initial deployment mode

The first public deployment is SAFE PRELAUNCH only.

Required gates:

PUBLIC_CHECKOUT_ENABLED=false
PAYMENT_READINESS=false
REAL_PAYMENTS_ENABLED=false
VITE_PUBLIC_CHECKOUT_ENABLED=false

The public site may accept prelaunch email registrations.
Orders and payment attempts must remain blocked.

## Production processes

Web process:
./deploy/web.sh

Worker process:
./deploy/worker.sh

Both processes must use the same production environment and persistent SQLite database.

## Persistent storage

Production DATABASE_PATH and DATABASE_BACKUP_DIR must be absolute persistent paths.

Example:
DATABASE_PATH=/var/lib/founding-6000/founding-6000.sqlite
DATABASE_BACKUP_DIR=/var/lib/founding-6000/backups
DATABASE_BACKUP_RETENTION=14

Never deploy the authoritative SQLite database to ephemeral build storage.

## Build

Frontend safe-prelaunch build:
env -u VITE_API_URL VITE_PUBLIC_CHECKOUT_ENABLED=false npm run build

Backend build:
npm run server:build

## Preflight

Run before public deployment:
npm run deploy:preflight

The preflight validates production mode, closed payment gates, compiled artifacts, runtime configuration, and absence of localhost API addresses from the browser bundle.

## Release

Run:
./deploy/release.sh

Release validates runtime storage and applies pending database migrations.
The release operation must remain repeatable.

## Health

GET /api/health
GET /api/health/ready

Expected safe-prelaunch state:
status=ok
database=ok
migrations=current
workers.email=healthy
workers.usdt=healthy
operations=ok
checkout=closed
payments=disabled

## Backups

Create backup:
./deploy/backup.sh

Verify restore:
npm run prod:restore-test

Backups must remain on persistent storage.

## Secrets

ADMIN_API_TOKEN and ETHEREUM_RPC_URL are backend-only.
Never expose secrets through VITE variables, frontend JavaScript, public API responses, logs, or Git.
Never store wallet seed phrases or private keys.

## HTTPS and reverse proxy

D4 will select the actual public hosting provider.
FRONTEND_ORIGIN must eventually be the canonical public HTTPS origin.
TRUST_PROXY must only be enabled after the trusted proxy architecture is known.

## Payment activation boundary

Public deployment does not mean payment activation.

DO NOT OPEN CHECKOUT during D4 prelaunch.
DO NOT ENABLE REAL PAYMENTS during D4 prelaunch.

Payment activation is a separate verified operation after public infrastructure, legal URLs, RPC connectivity, and payment verification are ready.

## Canonical deployment sequence

clone/update repository
-> npm ci
-> configure private environment
-> build frontend
-> build backend
-> prelaunch preflight
-> release/migrations
-> start web
-> start worker
-> verify health/readiness
-> verify backup/restore
-> enable public HTTPS traffic

## Failure rule

If preflight, migration, readiness, worker, backup, or restore verification fails:

DO NOT OPEN CHECKOUT
DO NOT ENABLE REAL PAYMENTS
DO NOT BYPASS THE FAILED CHECK
