const {
  createApp,
} = await import(
  "../app.js"
);

const app =
  createApp();

/*
 * TRUST_PROXY=false must remain the safe default
 * for local/direct deployment.
 */
if (
  app.get("trust proxy") !==
    false
) {
  throw new Error(
    "TRUST_PROXY_NOT_FALSE",
  );
}

const server =
  app.listen(
    0,
    "127.0.0.1",
  );

await new Promise<void>(
  (resolveListening) => {
    server.once(
      "listening",
      resolveListening,
    );
  },
);

const address =
  server.address();

if (
  !address ||
  typeof address === "string"
) {
  throw new Error(
    "INVALID_TEST_SERVER_ADDRESS",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function api(
  path: string,
  init?: Parameters<
    typeof fetch
  >[1],
) {
  const response =
    await fetch(
      `${base}${path}`,
      init,
    );

  let body:
    Record<string, any> =
    {};

  try {
    body =
      await response.json();
  } catch {
    body = {};
  }

  return {
    response,
    body,
  };
}

try {
  console.log("");
  console.log(
    "[S1-A 1] Health + security headers",
  );

  const health =
    await api(
      "/api/health",
    );

  if (
    health.response.status !==
      200
  ) {
    throw new Error(
      "HEALTH_NOT_200",
    );
  }

  if (
    !health.response.headers
      .get("x-request-id")
  ) {
    throw new Error(
      "REQUEST_ID_MISSING",
    );
  }

  if (
    health.response.headers
      .get("x-powered-by")
  ) {
    throw new Error(
      "X_POWERED_BY_EXPOSED",
    );
  }

  if (
    health.response.headers
      .get(
        "x-content-type-options",
      ) !== "nosniff"
  ) {
    throw new Error(
      "HELMET_HEADER_MISSING",
    );
  }

  if (
    !health.response.headers
      .get("cache-control")
      ?.includes("no-store")
  ) {
    throw new Error(
      "API_CACHE_CONTROL_MISSING",
    );
  }

  console.log(
    "[PASS] Security headers",
  );

  console.log("");
  console.log(
    "[S1-A 2] Allowed CORS origin",
  );

  const allowed =
    await api(
      "/api/health",
      {
        headers: {
          Origin:
            "http://localhost:5173",
        },
      },
    );

  if (
    allowed.response.headers
      .get(
        "access-control-allow-origin",
      ) !==
        "http://localhost:5173"
  ) {
    throw new Error(
      "ALLOWED_CORS_FAILED",
    );
  }

  console.log(
    "[PASS] Exact frontend origin allowed",
  );

  console.log("");
  console.log(
    "[S1-A 3] Evil CORS origin",
  );

  const forbidden =
    await api(
      "/api/health",
      {
        headers: {
          Origin:
            "https://evil.example",
        },
      },
    );

  if (
    forbidden.response.status !==
      403 ||
    forbidden.body.error !==
      "FORBIDDEN" ||
    !forbidden.body.requestId
  ) {
    throw new Error(
      "EVIL_CORS_NOT_SANITIZED",
    );
  }

  console.log(
    "[PASS] Foreign origin blocked",
  );

  console.log("");
  console.log(
    "[S1-A 4] API 404 sanitized",
  );

  const missing =
    await api(
      "/api/definitely-not-real",
    );

  if (
    missing.response.status !==
      404 ||
    !missing.body.requestId
  ) {
    throw new Error(
      "API_404_NOT_SANITIZED",
    );
  }

  console.log(
    "[PASS] 404 includes request ID",
  );

  console.log("");
  console.log(
    "[S1-A 5] Malformed JSON",
  );

  const malformed =
    await api(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "s1e-malformed-json",
        },

        body:
          '{"broken":',
      },
    );

  if (
    malformed.response.status !==
      400 ||
    malformed.body.error !==
      "INVALID_REQUEST" ||
    !malformed.body.requestId
  ) {
    throw new Error(
      "MALFORMED_JSON_NOT_SANITIZED",
    );
  }

  console.log(
    "[PASS] Malformed JSON rejected",
  );

  console.log("");
  console.log(
    "[S1-A 6] Oversized JSON",
  );

  const oversized =
    await api(
      "/api/payments/usdt/attempts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            "s1e-oversized-json",
        },

        body:
          JSON.stringify({
            payload:
              "x".repeat(
                40 * 1024,
              ),
          }),
      },
    );

  if (
    oversized.response.status !==
      413 ||
    oversized.body.error !==
      "PAYLOAD_TOO_LARGE" ||
    !oversized.body.requestId
  ) {
    throw new Error(
      "OVERSIZED_PAYLOAD_NOT_BLOCKED",
    );
  }

  console.log(
    "[PASS] Oversized payload rejected",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " S1-A HTTP SECURITY TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "REQUEST_ID=PASS",
  );

  console.log(
    "HELMET=PASS",
  );

  console.log(
    "X_POWERED_BY=HIDDEN",
  );

  console.log(
    "CORS=PASS",
  );

  console.log(
    "ERROR_SANITIZATION=PASS",
  );

  console.log(
    "PAYLOAD_LIMIT=PASS",
  );

  console.log(
    "TRUST_PROXY_DEFAULT=SAFE",
  );
} finally {
  await new Promise<void>(
    (resolveClose) => {
      server.close(
        () => resolveClose(),
      );
    },
  );
}
