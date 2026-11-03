# Founding 6000 — Cloudflare Deployment

## Deployment model

GitHub -> Cloudflare Workers Builds -> Worker + Static Assets + SQLite Durable Object.

Local Wrangler is intentionally not installed because workerd does not support native Termux Android ARM64.

## Git repository

Saladix1414/Founding-6000

## Initial Cloudflare production branch

deploy/cloudflare-d4

Do not use main until the Cloudflare deployment has passed public smoke tests.

## Root directory

Repository root.

## Build command

```sh
npm run build
```

## Deploy command

```sh
npx wrangler@latest deploy
```

## Public prelaunch API

- GET /api/health
- GET /api/visits
- GET /api/health/ready
- POST /api/email-registrations

All other /api/* routes fail closed with HTTP 503.

## Storage

FOUNDING_CORE uses a SQLite-backed Durable Object.

Current persisted scope:
- prelaunch email registrations
- audit events
- rate-limit buckets
- runtime metadata
- cumulative landing document loads

The visit badge refreshes every 15 seconds while the landing is visible. The counter starts at deployment and counts successful document loads of `/`, including reloads. It skips prefetches and stores a single aggregate total without cookies or visitor identifiers. `GET /api/visits` is read-only and responds with an uncached `{ "total": number }`.

## Commerce safety

PUBLIC_CHECKOUT_ENABLED=false
PAYMENT_READINESS=false
REAL_PAYMENTS_ENABLED=false

Orders, inventory, settlements, memberships and live payments are not migrated or enabled in this deployment.
