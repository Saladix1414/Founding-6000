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
      assetResponse,
    );
  },
};
