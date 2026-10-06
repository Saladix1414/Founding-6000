import { DurableObject } from "cloudflare:workers";

import {
  CommerceCore,
  commerceErrorStatus,
} from "./commerceCore.mjs";

const PRELAUNCH_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeEmail(value) {
  return value
    .trim()
    .toLowerCase();
}

function validEmail(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (
    trimmed.length < 3 ||
    trimmed.length > 320
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(trimmed);
}

export class FoundingCore extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;

    this.initializeSchema();

    this.commerce =
      new CommerceCore(
        state.storage,
      );

    this.commerce
      .initializeSchema();
  }

  initializeSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cloudflare_runtime_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS email_registrations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        normalized_email TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS
        idx_email_registrations_normalized_email
      ON email_registrations(
        normalized_email
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS
        idx_audit_events_entity
      ON audit_events(
        entity_type,
        entity_id
      );

      CREATE TABLE IF NOT EXISTS prelaunch_rate_limits (
        actor_hash TEXT NOT NULL,
        bucket_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL,

        PRIMARY KEY (
          actor_hash,
          bucket_start
        )
      );
    `);

    const now =
      new Date().toISOString();

    this.sql.exec(
      `
        INSERT INTO cloudflare_runtime_meta (
          key,
          value,
          updated_at
        )
        VALUES (?, ?, ?)

        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      "storage_engine",
      "durable-object-sqlite",
      now,
    );

    this.sql.exec(
      `
        INSERT INTO cloudflare_runtime_meta (
          key,
          value,
          updated_at
        )
        VALUES (?, ?, ?)

        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      "schema_version",
      "d4c-prelaunch-v1",
      now,
    );
  }

  runtimeHealth() {
    const storage =
      this.sql.exec(`
        SELECT value
        FROM cloudflare_runtime_meta
        WHERE key = 'storage_engine'
      `)
        .toArray()[0];

    const schema =
      this.sql.exec(`
        SELECT value
        FROM cloudflare_runtime_meta
        WHERE key = 'schema_version'
      `)
        .toArray()[0];

    const count =
      this.sql.exec(`
        SELECT COUNT(*) AS count
        FROM email_registrations
      `)
        .toArray()[0];

    return {
      status: "ok",

      database:
        storage?.value ===
        "durable-object-sqlite"
          ? "ok"
          : "unavailable",

      migrations:
        schema?.value ===
        "d4c-prelaunch-v1"
          ? "current"
          : "pending",

      storage:
        storage?.value ??
        "unknown",

      prelaunchRegistrations:
        Number(
          count?.count ?? 0,
        ),

      timestamp:
        new Date().toISOString(),
    };
  }

  registerPrelaunch(payload) {
    const email =
      payload?.email;

    const actorHash =
      payload?.actorHash;

    if (!validEmail(email)) {
      return {
        status: 400,
        body: {
          error: "INVALID_EMAIL",
        },
      };
    }

    if (
      typeof actorHash !== "string" ||
      actorHash.length < 32 ||
      actorHash.length > 128
    ) {
      return {
        status: 400,
        body: {
          error: "INVALID_ACTOR",
        },
      };
    }

    const now =
      new Date();

    const nowIso =
      now.toISOString();

    const bucketStart =
      Math.floor(
        now.getTime() /
        RATE_WINDOW_MS,
      ) *
      RATE_WINDOW_MS;

    return this.state.storage
      .transactionSync(() => {
        this.sql.exec(
          `
            DELETE FROM prelaunch_rate_limits
            WHERE bucket_start < ?
          `,
          bucketStart -
            5 * RATE_WINDOW_MS,
        );

        const existing =
          this.sql.exec(
            `
              SELECT
                request_count AS requestCount
              FROM prelaunch_rate_limits
              WHERE
                actor_hash = ?
                AND bucket_start = ?
            `,
            actorHash,
            bucketStart,
          )
            .toArray()[0];

        const currentCount =
          Number(
            existing?.requestCount ??
            0,
          );

        if (
          currentCount >=
          PRELAUNCH_RATE_LIMIT
        ) {
          return {
            status: 429,
            body: {
              error:
                "EMAIL_REGISTRATION_RATE_LIMITED",
            },
          };
        }

        this.sql.exec(
          `
            INSERT INTO prelaunch_rate_limits (
              actor_hash,
              bucket_start,
              request_count,
              updated_at
            )
            VALUES (?, ?, 1, ?)

            ON CONFLICT(
              actor_hash,
              bucket_start
            )
            DO UPDATE SET
              request_count =
                request_count + 1,
              updated_at =
                excluded.updated_at
          `,
          actorHash,
          bucketStart,
          nowIso,
        );

        const id =
          crypto.randomUUID();

        const trimmedEmail =
          email.trim();

        const normalizedEmail =
          normalizeEmail(email);

        this.sql.exec(
          `
            INSERT INTO email_registrations (
              id,
              email,
              normalized_email,
              source,
              created_at
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          id,
          trimmedEmail,
          normalizedEmail,
          "FOUNDING_6000_PRELAUNCH",
          nowIso,
        );

        this.sql.exec(
          `
            INSERT INTO audit_events (
              id,
              event_type,
              entity_type,
              entity_id,
              payload_json,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          crypto.randomUUID(),
          "EMAIL_REGISTERED",
          "EMAIL_REGISTRATION",
          id,
          JSON.stringify({
            source:
              "FOUNDING_6000_PRELAUNCH",
          }),
          nowIso,
        );

        return {
          status: 201,

          body: {
            registration: {
              id,
              email:
                trimmedEmail,
              createdAt:
                nowIso,
            },
          },
        };
      });
  }

  async fetch(request) {
    const url =
      new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname ===
        "/internal/health"
    ) {
      return json(
        this.runtimeHealth(),
      );
    }

    if (
      request.method === "POST" &&
      url.pathname ===
        "/internal/email-registrations"
    ) {
      let payload;

      try {
        payload =
          await request.json();
      } catch {
        return json(
          {
            error:
              "INVALID_JSON",
          },
          400,
        );
      }

      const result =
        this.registerPrelaunch(
          payload,
        );

      return json(
        result.body,
        result.status,
      );
    }

    /*
     * -----------------------------------------------------
     * P6 — internal commerce / USDT boundary
     * -----------------------------------------------------
     *
     * These routes are reachable only through the Worker.
     * Public exposure remains closed until the Worker
     * migration and Ethereum verification phases pass.
     */

    if (
      request.method === "POST" &&
      url.pathname ===
        "/internal/orders"
    ) {
      try {
        const payload =
          await request.json();

        const result =
          this.commerce
            .createOrder(
              payload,
            );

        return json(
          result,
          result.idempotentReplay
            ? 200
            : 201,
        );
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : "COMMERCE_INTERNAL_ERROR";

        return json(
          {
            error: code,
          },
          commerceErrorStatus(
            code,
          ),
        );
      }
    }

    if (
      request.method === "POST" &&
      url.pathname ===
        "/internal/payments/usdt/attempts"
    ) {
      try {
        const payload =
          await request.json();

        const result =
          this.commerce
            .createUsdtAttempt(
              payload,
            );

        return json(
          result,
          result.idempotentReplay
            ? 200
            : 201,
        );
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : "COMMERCE_INTERNAL_ERROR";

        return json(
          {
            error: code,
          },
          commerceErrorStatus(
            code,
          ),
        );
      }
    }

    const readAttemptMatch =
      url.pathname.match(
        /^\/internal\/payments\/usdt\/attempts\/(PAY-USDT-[A-F0-9]{12})$/,
      );

    if (
      request.method === "GET" &&
      readAttemptMatch
    ) {
      try {
        return json(
          this.commerce
            .getUsdtAttempt(
              readAttemptMatch[1],
            ),
        );
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : "COMMERCE_INTERNAL_ERROR";

        return json(
          {
            error: code,
          },
          commerceErrorStatus(
            code,
          ),
        );
      }
    }

    const submitAttemptMatch =
      url.pathname.match(
        /^\/internal\/payments\/usdt\/attempts\/(PAY-USDT-[A-F0-9]{12})\/submit$/,
      );

    if (
      request.method === "POST" &&
      submitAttemptMatch
    ) {
      try {
        const payload =
          await request.json();

        const result =
          this.commerce
            .submitUsdtHash({
              paymentAttemptPublicId:
                submitAttemptMatch[1],

              txHash:
                payload?.txHash,
            });

        return json(
          result,
        );
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : "COMMERCE_INTERNAL_ERROR";

        return json(
          {
            error: code,
          },
          commerceErrorStatus(
            code,
          ),
        );
      }
    }

    return json(
      {
        error:
          "DURABLE_OBJECT_ROUTE_NOT_FOUND",
      },
      404,
    );
  }
}
