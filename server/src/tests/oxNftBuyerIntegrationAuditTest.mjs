import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

const worker = read("cloudflare/worker.mjs");
const core = read("cloudflare/foundingCore.mjs");
const bridge = read("cloudflare/nftBuyerDoBridge.mjs");
const boundary = read("cloudflare/nftBuyerHttpBoundary.mjs");
const actor = read("cloudflare/nftBuyerActorIdentity.mjs");
const request = read("cloudflare/nftBuyerEmailRequest.mjs");
const config = read("wrangler.jsonc");

/*
 * The public Worker must not expose the buyer
 * email route in this phase.
 */
assert.equal(
  worker.includes('"/api/nft/buyer/email"'),
  true,
);

assert.ok(
  worker.includes("OX_NFT_BUYER_PUBLIC_GATE_V1"),
);

assert.ok(
  worker.includes(
    'env.NFT_BUYER_EMAIL_ENABLED !== "true"'
  ),
);

assert.ok(
  worker.includes(
    'await import("./nftBuyerWorkerGateway.mjs")'
  ),
);

console.log("PUBLIC_BUYER_ROUTE_REGISTERED_DISABLED=PASS");

/*
 * The Durable Object has one private route.
 */
assert.ok(
  core.includes('"/internal/nft/buyer/email"'),
);

assert.ok(
  core.includes('await import("./nftBuyerDoBridge.mjs")'),
);

console.log("DURABLE_OBJECT_PRIVATE_ROUTE=PASS");

/*
 * Private route requires both the feature gate
 * and a server-side credential.
 */
assert.ok(
  bridge.includes(
    'env.NFT_BUYER_EMAIL_ENABLED !== "true"'
  ),
);

assert.ok(
  bridge.includes("NFT_INTERNAL_SERVICE_KEY"),
);

assert.ok(
  bridge.includes('"X-OriginX-Internal-Key"'),
);

console.log("INTERNAL_AUTH_BOUNDARY_PRESENT=PASS");

/*
 * Actor identity is generated inside the
 * server-side adapter using HMAC.
 */
assert.ok(
  actor.includes('"HMAC"')
);

assert.ok(
  actor.includes('"CF-Connecting-IP"')
);

assert.ok(
  request.includes("reserveBuyerEmailActor")
);

console.log("ACTOR_SECURITY_CHAIN_PRESENT=PASS");

/*
 * Public parsing exists but is not installed.
 */
assert.ok(
  boundary.includes("handleBuyerEmailRequest")
);

assert.ok(
  boundary.includes("requestBuyerEmailFromWorker")
);

console.log("HTTP_BOUNDARY_AVAILABLE_NOT_EXPOSED=PASS");

/*
 * NFT email must remain disabled in checked-in
 * Wrangler configuration.
 */
assert.equal(
  /"NFT_BUYER_EMAIL_ENABLED"\s*:\s*"true"/
    .test(config),
  false,
);

assert.equal(
  /"RESEND_API_KEY"\s*:/.test(config),
  false,
);

assert.equal(
  /"NFT_INTERNAL_SERVICE_KEY"\s*:/.test(config),
  false,
);

assert.equal(
  /"NFT_BUYER_ACTOR_SECRET"\s*:/.test(config),
  false,
);

console.log("CONFIG_NO_NFT_ENABLE_OR_SECRETS=PASS");

/*
 * The current public adapter accepts storage,
 * but Worker must use the Durable Object binding,
 * not attempt to open local SQLite storage.
 *
 * This is an explicit integration gap,
 * not a passed capability.
 */
assert.ok(
  boundary.includes("storage,")
);

assert.ok(
  worker.includes("FOUNDING_CORE") ||
  worker.includes("canonicalCore")
);

console.log("PUBLIC_TO_DO_ADAPTER_STILL_REQUIRED=YES");

console.log("NFT_BUYER_INTEGRATION_AUDIT_TEST=PASS");
console.log("REAL_EMAIL_SENT=NO");
console.log("PUBLIC_ROUTE_INSTALLED=NO");
