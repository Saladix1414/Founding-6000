import {
  FoundingCore,
} from "./foundingCore.mjs";

export {
  FoundingCore,
};

const MAX_JSON_BYTES =
  32 * 1024;

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "base-uri 'self'; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "form-action 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "worker-src 'self'; " +
    "manifest-src 'self';",

  "Strict-Transport-Security":
    "max-age=31536000",

  "X-Content-Type-Options":
    "nosniff",

  "X-Frame-Options":
    "DENY",

  "Referrer-Policy":
    "strict-origin-when-cross-origin",

  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=()",
};

function secureResponse(
  request,
  response,
) {
  const secured =
    new Response(
      response.body,
      response,
    );

  for (
    const [
      name,
      value,
    ] of Object.entries(
      SECURITY_HEADERS,
    )
  ) {
    secured.headers.set(
      name,
      value,
    );
  }

  const pathname =
    new URL(
      request.url,
    ).pathname;

  if (
    pathname.startsWith(
      "/assets/",
    )
  ) {
    secured.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  }

  return secured;
}

function json(
  payload,
  status = 200,
  requestId = null,
) {
  return Response.json(
    payload,
    {
      status,

      headers: {
        ...SECURITY_HEADERS,

        "Cache-Control":
          "no-store",

        ...(requestId
          ? {
              "X-Request-Id":
                requestId,
            }
          : {}),
      },
    },
  );
}

function canonicalCore(env) {
  const id =
    env.FOUNDING_CORE
      .idFromName(
        "canonical-founding-6000",
      );

  return env.FOUNDING_CORE
    .get(id);
}

async function actorHash(
  request,
) {
  const source =
    [
      request.headers.get(
        "CF-Connecting-IP",
      ) ??
        "unknown-ip",

      request.headers.get(
        "User-Agent",
      ) ??
        "unknown-agent",
    ].join("|");

  const bytes =
    new TextEncoder()
      .encode(source);

  const digest =
    await crypto.subtle
      .digest(
        "SHA-256",
        bytes,
      );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0",
          ),
    )
    .join("");
}

async function parseEmailBody(
  request,
) {
  const declaredLength =
    Number(
      request.headers.get(
        "Content-Length",
      ) ??
      "0",
    );

  if (
    Number.isFinite(
      declaredLength,
    ) &&
    declaredLength >
      MAX_JSON_BYTES
  ) {
    return {
      error:
        "REQUEST_BODY_TOO_LARGE",
      status:
        413,
    };
  }

  const text =
    await request.text();

  const byteLength =
    new TextEncoder()
      .encode(text)
      .byteLength;

  if (
    byteLength >
      MAX_JSON_BYTES
  ) {
    return {
      error:
        "REQUEST_BODY_TOO_LARGE",
      status:
        413,
    };
  }

  let body;

  try {
    body =
      JSON.parse(text);
  } catch {
    return {
      error:
        "INVALID_JSON",
      status:
        400,
    };
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      error:
        "INVALID_REQUEST_BODY",
      status:
        400,
    };
  }

  const keys =
    Object.keys(body);

  if (
    keys.length !== 1 ||
    keys[0] !== "email"
  ) {
    return {
      error:
        "INVALID_REQUEST_BODY",
      status:
        400,
    };
  }

  if (
    typeof body.email !==
    "string"
  ) {
    return {
      error:
        "INVALID_EMAIL",
      status:
        400,
    };
  }

  const email =
    body.email.trim();

  if (
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {
    return {
      error:
        "INVALID_EMAIL",
      status:
        400,
    };
  }

  return {
    email,
  };
}

function runtimeFlagEnabled(
  env,
  name,
) {
  return (
    String(
      env?.[name] ?? "",
    ).toLowerCase() ===
    "true"
  );
}

/*
 * Fourth production gate.
 *
 * Even if the legacy checkout/payment flags are enabled,
 * Cloudflare commerce remains closed until this explicit
 * migration gate is also enabled.
 */
function publicUsdtApiEnabled(
  env,
) {
  return (
    runtimeFlagEnabled(
      env,
      "PUBLIC_CHECKOUT_ENABLED",
    ) &&
    runtimeFlagEnabled(
      env,
      "PAYMENT_READINESS",
    ) &&
    runtimeFlagEnabled(
      env,
      "REAL_PAYMENTS_ENABLED",
    ) &&
    runtimeFlagEnabled(
      env,
      "CLOUDFLARE_USDT_API_ENABLED",
    )
  );
}

function readIdempotencyKey(
  request,
) {
  const value =
    request.headers
      .get(
        "Idempotency-Key",
      )
      ?.trim() ?? "";

  if (!value) {
    return {
      error:
        "IDEMPOTENCY_KEY_REQUIRED",
      status:
        400,
    };
  }

  if (
    value.length < 8 ||
    value.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/
      .test(value)
  ) {
    return {
      error:
        "INVALID_IDEMPOTENCY_KEY",
      status:
        400,
    };
  }

  return {
    value,
  };
}

async function parseStrictJsonBody(
  request,
  allowedKeys,
) {
  const contentType =
    request.headers.get(
      "Content-Type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith(
        "application/json",
      )
  ) {
    return {
      error:
        "UNSUPPORTED_MEDIA_TYPE",
      status:
        415,
    };
  }

  const declaredLength =
    Number(
      request.headers.get(
        "Content-Length",
      ) ?? "0",
    );

  if (
    Number.isFinite(
      declaredLength,
    ) &&
    declaredLength >
      MAX_JSON_BYTES
  ) {
    return {
      error:
        "REQUEST_BODY_TOO_LARGE",
      status:
        413,
    };
  }

  const text =
    await request.text();

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
    MAX_JSON_BYTES
  ) {
    return {
      error:
        "REQUEST_BODY_TOO_LARGE",
      status:
        413,
    };
  }

  let body;

  try {
    body =
      JSON.parse(text);
  } catch {
    return {
      error:
        "INVALID_JSON",
      status:
        400,
    };
  }

  if (
    !body ||
    typeof body !==
      "object" ||
    Array.isArray(body)
  ) {
    return {
      error:
        "INVALID_REQUEST_BODY",
      status:
        400,
    };
  }

  const keys =
    Object.keys(body)
      .sort();

  const expected =
    [...allowedKeys]
      .sort();

  if (
    keys.length !==
      expected.length ||
    keys.some(
      (key, index) =>
        key !==
        expected[index],
    )
  ) {
    return {
      error:
        "INVALID_REQUEST_BODY",
      status:
        400,
    };
  }

  return {
    body,
  };
}

async function callCommerceCore(
  env,
  path,
  options = {},
) {
  const core =
    canonicalCore(env);

  const requestOptions = {
    method:
      options.method ??
      "GET",
  };

  if (
    options.body !==
    undefined
  ) {
    requestOptions.headers = {
      "Content-Type":
        "application/json",
    };

    requestOptions.body =
      JSON.stringify(
        options.body,
      );
  }

  const response =
    await core.fetch(
      new Request(
        `https://founding-core.internal${path}`,
        requestOptions,
      ),
    );

  let payload;

  try {
    payload =
      await response.json();
  } catch {
    payload = {
      error:
        "INVALID_CORE_RESPONSE",
    };
  }

  return {
    status:
      response.status,

    payload,
  };
}

async function coreHealth(env) {
  const core =
    canonicalCore(env);

  const response =
    await core.fetch(
      new Request(
        "https://founding-core.internal/internal/health",
        {
          method: "GET",
        },
      ),
    );

  if (!response.ok) {
    throw new Error(
      "FOUNDING_CORE_HEALTH_FAILED",
    );
  }

  return response.json();
}

export default {
  async fetch(
    request,
    env,
  ) {
    const url =
      new URL(request.url);

    const requestId =
      crypto.randomUUID();

    if (
      request.method === "GET" &&
      (
        url.pathname ===
          "/api/health" ||
        url.pathname ===
          "/api/cloudflare/health"
      )
    ) {
      try {
        const core =
          await coreHealth(env);

        return json(
          {
            status:
              core.status,

            service:
              "founding-6000-cloudflare-prelaunch",

            environment:
              "production",

            database:
              core.database,

            migrations:
              core.migrations,

            workers: {
              email:
                "not_required",
              usdt:
                "disabled",
            },

            operations:
              "ok",

            checkout:
              "closed",

            payments:
              "disabled",

            paymentReadiness:
              false,

            realPaymentsEnabled:
              false,

            timestamp:
              new Date()
                .toISOString(),
          },
          200,
          requestId,
        );
      } catch {
        return json(
          {
            status:
              "degraded",

            database:
              "unavailable",

            checkout:
              "closed",

            payments:
              "disabled",
          },
          503,
          requestId,
        );
      }
    }

    if (
      request.method === "GET" &&
      url.pathname ===
        "/api/health/ready"
    ) {
      try {
        const core =
          await coreHealth(env);

        const ready =
          core.database === "ok" &&
          core.migrations ===
            "current";

        return json(
          {
            status:
              ready
                ? "ready"
                : "not_ready",

            database:
              core.database,

            migrations:
              core.migrations,

            operations:
              ready
                ? "ok"
                : "degraded",

            payments:
              "disabled",

            timestamp:
              new Date()
                .toISOString(),
          },
          ready
            ? 200
            : 503,
          requestId,
        );
      } catch {
        return json(
          {
            status:
              "not_ready",

            database:
              "unavailable",

            migrations:
              "unavailable",

            payments:
              "disabled",
          },
          503,
          requestId,
        );
      }
    }

    /*
     * -----------------------------------------------------
     * P6-A3 — Cloudflare Commerce / USDT bridge
     * -----------------------------------------------------
     *
     * Route code is migrated, but remains fail-closed
     * unless ALL production gates are explicitly enabled.
     */

    if (
      request.method === "POST" &&
      url.pathname ===
        "/api/orders"
    ) {
      if (
        !publicUsdtApiEnabled(
          env,
        )
      ) {
        return json(
          {
            error:
              "PUBLIC_COMMERCE_DISABLED",
          },
          503,
          requestId,
        );
      }

      const key =
        readIdempotencyKey(
          request,
        );

      if (key.error) {
        return json(
          {
            error:
              key.error,
          },
          key.status,
          requestId,
        );
      }

      const parsed =
        await parseStrictJsonBody(
          request,
          [
            "email",
          ],
        );

      if (parsed.error) {
        return json(
          {
            error:
              parsed.error,
          },
          parsed.status,
          requestId,
        );
      }

      const result =
        await callCommerceCore(
          env,
          "/internal/orders",
          {
            method:
              "POST",

            body: {
              email:
                parsed.body.email,

              idempotencyKey:
                key.value,
            },
          },
        );

      return json(
        result.payload,
        result.status,
        requestId,
      );
    }

    if (
      request.method === "POST" &&
      url.pathname ===
        "/api/payments/usdt/attempts"
    ) {
      if (
        !publicUsdtApiEnabled(
          env,
        )
      ) {
        return json(
          {
            error:
              "PUBLIC_COMMERCE_DISABLED",
          },
          503,
          requestId,
        );
      }

      const key =
        readIdempotencyKey(
          request,
        );

      if (key.error) {
        return json(
          {
            error:
              key.error,
          },
          key.status,
          requestId,
        );
      }

      const parsed =
        await parseStrictJsonBody(
          request,
          [
            "orderPublicId",
          ],
        );

      if (parsed.error) {
        return json(
          {
            error:
              parsed.error,
          },
          parsed.status,
          requestId,
        );
      }

      const result =
        await callCommerceCore(
          env,
          "/internal/payments/usdt/attempts",
          {
            method:
              "POST",

            body: {
              orderPublicId:
                parsed.body
                  .orderPublicId,

              idempotencyKey:
                key.value,
            },
          },
        );

      return json(
        result.payload,
        result.status,
        requestId,
      );
    }

    const publicReadAttemptMatch =
      url.pathname.match(
        /^\/api\/payments\/usdt\/attempts\/(PAY-USDT-[A-F0-9]{12})$/,
      );

    if (
      request.method === "GET" &&
      publicReadAttemptMatch
    ) {
      if (
        !publicUsdtApiEnabled(
          env,
        )
      ) {
        return json(
          {
            error:
              "PUBLIC_COMMERCE_DISABLED",
          },
          503,
          requestId,
        );
      }

      const result =
        await callCommerceCore(
          env,
          `/internal/payments/usdt/attempts/${publicReadAttemptMatch[1]}`,
        );

      return json(
        result.payload,
        result.status,
        requestId,
      );
    }

    const publicSubmitAttemptMatch =
      url.pathname.match(
        /^\/api\/payments\/usdt\/attempts\/(PAY-USDT-[A-F0-9]{12})\/submit$/,
      );

    if (
      request.method === "POST" &&
      publicSubmitAttemptMatch
    ) {
      if (
        !publicUsdtApiEnabled(
          env,
        )
      ) {
        return json(
          {
            error:
              "PUBLIC_COMMERCE_DISABLED",
          },
          503,
          requestId,
        );
      }

      const parsed =
        await parseStrictJsonBody(
          request,
          [
            "txHash",
          ],
        );

      if (parsed.error) {
        return json(
          {
            error:
              parsed.error,
          },
          parsed.status,
          requestId,
        );
      }

      const result =
        await callCommerceCore(
          env,
          `/internal/payments/usdt/attempts/${publicSubmitAttemptMatch[1]}/submit`,
          {
            method:
              "POST",

            body: {
              txHash:
                parsed.body.txHash,
            },
          },
        );

      return json(
        result.payload,
        result.status,
        requestId,
      );
    }

    if (
      request.method === "POST" &&
      url.pathname ===
        "/api/email-registrations"
    ) {
      const parsed =
        await parseEmailBody(
          request,
        );

      if (parsed.error) {
        return json(
          {
            error:
              parsed.error,
          },
          parsed.status,
          requestId,
        );
      }

      const hash =
        await actorHash(
          request,
        );

      const core =
        canonicalCore(env);

      const response =
        await core.fetch(
          new Request(
            "https://founding-core.internal/internal/email-registrations",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  email:
                    parsed.email,

                  actorHash:
                    hash,
                }),
            },
          ),
        );

      const payload =
        await response.json();

      return json(
        payload,
        response.status,
        requestId,
      );
    }

    if (
      url.pathname.startsWith(
        "/api/",
      )
    ) {
      return json(
        {
          error:
            "CLOUDFLARE_API_NOT_MIGRATED",
        },
        503,
        requestId,
      );
    }

    const assetResponse =
      await env.ASSETS.fetch(
        request,
      );

    return secureResponse(
      request,
      assetResponse,
    );
  },
};
