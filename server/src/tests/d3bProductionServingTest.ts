import {
  rmSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const dbPath =
  process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error(
    "DATABASE_PATH_REQUIRED",
  );
}

const resolvedDb =
  resolve(
    dbPath,
  );

for (
  const file of [
    resolvedDb,
    `${resolvedDb}-wal`,
    `${resolvedDb}-shm`,
  ]
) {
  rmSync(
    file,
    {
      force: true,
    },
  );
}

const {
  createApp,
} = await import(
  "../app.js"
);

const {
  db,
} = await import(
  "../db/database.js"
);

const app =
  createApp();

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
  typeof address ===
    "string"
) {
  throw new Error(
    "INVALID_TEST_SERVER",
  );
}

const base =
  `http://127.0.0.1:${address.port}`;

async function get(
  path: string,
  accept: string,
) {
  return fetch(
    `${base}${path}`,
    {
      headers: {
        Accept:
          accept,
      },
    },
  );
}

try {
  console.log("");
  console.log(
    "[D3-B 1] React root",
  );

  const root =
    await get(
      "/",
      "text/html",
    );

  if (
    root.status !==
      200
  ) {
    throw new Error(
      `ROOT_STATUS_${root.status}`,
    );
  }

  const rootHtml =
    await root.text();

  if (
    !rootHtml.includes(
      'id="root"',
    )
  ) {
    throw new Error(
      "ROOT_NOT_REACT_FRONTEND",
    );
  }

  console.log(
    "[PASS] React served by Express",
  );

  console.log("");
  console.log(
    "[D3-B 2] Legal static file",
  );

  const terms =
    await get(
      "/legal/terms.html",
      "text/html",
    );

  if (
    terms.status !==
      200
  ) {
    throw new Error(
      `TERMS_STATUS_${terms.status}`,
    );
  }

  console.log(
    "[PASS] Legal files served",
  );

  console.log("");
  console.log(
    "[D3-B 3] Same-origin API",
  );

  const health =
    await get(
      "/api/health",
      "application/json",
    );

  if (
    health.status !==
      200
  ) {
    throw new Error(
      `HEALTH_STATUS_${health.status}`,
    );
  }

  const healthBody =
    await health.json() as
      Record<
        string,
        any
      >;

  if (
    healthBody.service !==
      "founding-6000-api"
  ) {
    throw new Error(
      "HEALTH_API_INVALID",
    );
  }

  console.log(
    "[PASS] API served on same origin",
  );

  console.log("");
  console.log(
    "[D3-B 4] API 404 boundary",
  );

  const unknownApi =
    await get(
      "/api/does-not-exist",
      "text/html",
    );

  if (
    unknownApi.status !==
      404
  ) {
    throw new Error(
      `UNKNOWN_API_STATUS_${unknownApi.status}`,
    );
  }

  const apiType =
    unknownApi.headers.get(
      "content-type",
    ) ?? "";

  if (
    !apiType.includes(
      "application/json",
    )
  ) {
    throw new Error(
      "UNKNOWN_API_RETURNED_HTML",
    );
  }

  const unknownBody =
    await unknownApi.json() as {
      error?: string;
  };

  if (
    unknownBody.error !==
      "API_ROUTE_NOT_FOUND"
  ) {
    throw new Error(
      "API_404_BOUNDARY_INVALID",
    );
  }

  console.log(
    "[PASS] Unknown API never becomes SPA HTML",
  );

  console.log("");
  console.log(
    "[D3-B 5] SPA fallback",
  );

  const deepLink =
    await get(
      "/campaign/prelaunch",
      "text/html",
    );

  if (
    deepLink.status !==
      200
  ) {
    throw new Error(
      `SPA_STATUS_${deepLink.status}`,
    );
  }

  const deepHtml =
    await deepLink.text();

  if (
    !deepHtml.includes(
      'id="root"',
    )
  ) {
    throw new Error(
      "SPA_FALLBACK_INVALID",
    );
  }

  console.log(
    "[PASS] SPA deep-link fallback",
  );

  console.log("");
  console.log(
    "============================================",
  );

  console.log(
    " D3-B PRODUCTION SERVING TEST PASS",
  );

  console.log(
    "============================================",
  );

  console.log(
    "EXPRESS_SERVES_REACT=PASS",
  );

  console.log(
    "LEGAL_STATIC_FILES=PASS",
  );

  console.log(
    "SAME_ORIGIN_API=PASS",
  );

  console.log(
    "API_404_BOUNDARY=PASS",
  );

  console.log(
    "SPA_FALLBACK=PASS",
  );
} finally {
  await new Promise<void>(
    (resolveClose) => {
      server.close(
        () =>
          resolveClose(),
      );
    },
  );

  db.close();

  for (
    const file of [
      resolvedDb,
      `${resolvedDb}-wal`,
      `${resolvedDb}-shm`,
    ]
  ) {
    rmSync(
      file,
      {
        force: true,
      },
    );
  }
}
