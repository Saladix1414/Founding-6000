import assert from "node:assert/strict";

/*
 * Runs only against an explicitly selected
 * loopback-local Cloudflare workerd instance.
 *
 * No payments, email, blockchain or mint
 * operations are performed.
 */

const BASE = "http://127.0.0.1:8791";

async function request(path, options = {}) {
  return fetch(BASE + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    ...options,
  });
}

let ready = false;
let lastError = "";

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await request(
      "/api/cloudflare/health"
    );

    if (response.status === 200) {
      const data = await response.json();

      assert.equal(data.database, "ok");
      assert.equal(data.migrations, "current");

      ready = true;
      break;
    }

    lastError = `HEALTH_STATUS_${response.status}`;
  } catch (error) {
    lastError = error instanceof Error
      ? error.name
      : "NETWORK_ERROR";
  }

  await new Promise(resolve =>
    setTimeout(resolve, 1000)
  );
}

assert.ok(
  ready,
  `WORKER_DO_HEALTH_NOT_READY:${lastError}`,
);

console.log("WORKER_LOCAL_RUNTIME=PASS");
console.log("DURABLE_OBJECT_SQLITE_HEALTH=PASS");

const data = {
  orderPublicId: "F6K-ABCDEF123456",
  email: "buyer@example.org",
  challengeId:
    "11111111-2222-4333-8444-555555555555",
  code: "a".repeat(32),
};

const claimOptions = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: BASE,
  },
  body: JSON.stringify(data),
};

for (const method of ["GET", "POST"]) {
  const response = await request(
    "/api/nft/buyer/claim",
    method === "POST"
      ? claimOptions
      : { method: "GET" }
  );

  assert.equal(response.status, 503);

  const body = await response.json();

  assert.equal(
    body.error,
    "NFT_BUYER_CLAIM_DISABLED"
  );

  assert.equal(
    response.headers.get("Cache-Control"),
    "no-store",
  );

  assert.equal(
    JSON.stringify(body).includes("claimToken"),
    false,
  );
}

console.log("WORKER_CLAIM_DISABLED=PASS");
console.log("WORKER_CLAIM_NO_TOKEN=PASS");

const email = await request(
  "/api/nft/buyer/email",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      orderPublicId: data.orderPublicId,
      email: data.email,
    }),
  },
);

assert.equal(email.status, 503);

assert.equal(
  (await email.json()).error,
  "NFT_BUYER_SERVICE_DISABLED"
);

console.log("WORKER_EMAIL_DISABLED=PASS");
console.log("WORKER_PAYMENT_ENDPOINTS_NOT_CALLED=YES");
console.log("REAL_EMAIL_SENT=NO");
console.log("REAL_MINT=NO");
console.log("REAL_FUNDS_MOVED=NO");
console.log("CLOUDFLARE_LOCAL_RUNTIME_SMOKE=PASS");
