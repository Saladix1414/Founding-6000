import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");

const worker = read("cloudflare/worker.mjs");
const core = read("cloudflare/foundingCore.mjs");
const gateway = read("cloudflare/nftBuyerWorkerGateway.mjs");
const bridge = read("cloudflare/nftBuyerWorkerBridge.mjs");
const receiver = read("cloudflare/nftBuyerDoBridge.mjs");
const config = read("wrangler.jsonc");

/*
 * The production entrypoint and canonical
 * Durable Object must remain unchanged.
 */
assert.match(
  config,
  /"main"\s*:\s*"cloudflare\/worker\.mjs"/,
);

assert.match(
  config,
  /"name"\s*:\s*"FOUNDING_CORE"/,
);

assert.match(
  config,
  /"class_name"\s*:\s*"FoundingCore"/,
);

console.log("WORKER_ENTRYPOINT=PASS");
console.log("CANONICAL_DURABLE_OBJECT_BINDING=PASS");

/*
 * The public NFT route must remain behind
 * explicit feature enablement.
 */
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
    'import("./nftBuyerWorkerGateway.mjs")'
  ),
);

console.log("BUYER_PUBLIC_GATE=FAIL_CLOSED");

/*
 * Confirm the internal routing chain.
 */
assert.ok(
  gateway.includes("forwardBuyerEmailToCore"),
);

assert.ok(
  bridge.includes(
    "/internal/nft/buyer/email"
  ),
);

assert.ok(
  core.includes(
    'import("./nftBuyerDoBridge.mjs")'
  ),
);

assert.ok(
  receiver.includes(
    "requestBuyerEmailVerification"
  ),
);

console.log("WORKER_TO_DO_IMPORT_CHAIN=PASS");

/*
 * Resend credentials belong exclusively
 * to the Durable Object side of the flow.
 */
assert.equal(
  gateway.includes("RESEND_API_KEY"),
  false,
);

assert.equal(
  bridge.includes("RESEND_API_KEY"),
  false,
);

assert.ok(
  receiver.includes("RESEND_API_KEY"),
);

console.log("RESEND_BOUNDARY=PASS");

/*
 * No claim issuance or blockchain mint may
 * be initiated by these HTTP entrypoints.
 */
for (const source of [
  worker,
  gateway,
  bridge,
  receiver,
]) {
  assert.equal(
    source.includes("issueNftClaimGrant("),
    false,
  );

  assert.equal(
    source.includes("mintNFT("),
    false,
  );
}

console.log("HTTP_NO_DIRECT_MINT_AUTHORITY=PASS");

/*
 * Deployment configuration must not activate
 * buyer email or embed its secrets.
 */
for (const variable of [
  "NFT_BUYER_ACTOR_SECRET",
  "NFT_INTERNAL_SERVICE_KEY",
  "RESEND_API_KEY",
]) {
  const regex = new RegExp(
    `"${variable}"\\s*:`
  );

  assert.equal(
    regex.test(config),
    false,
    `SECRET_IN_WRANGLER_CONFIG:${variable}`,
  );
}

assert.equal(
  /"NFT_BUYER_EMAIL_ENABLED"\s*:\s*"true"/
    .test(config),
  false,
);

console.log("BUYER_EMAIL_CONFIG_DISABLED=PASS");
console.log("NFT_SECRETS_NOT_COMMITTED=PASS");

/*
 * The Worker and DO must share the same
 * canonical Durable Object instance.
 */
assert.ok(
  worker.includes(
    "canonical-founding-6000"
  ),
);

assert.ok(
  bridge.includes(
    "canonical-founding-6000"
  ),
);

console.log("DURABLE_OBJECT_IDENTITY_ALIGNED=PASS");

console.log("NFT_CLOUDFLARE_PREFLIGHT_TEST=PASS");
console.log("RUNTIME_DEPLOYED=NO");
console.log("REAL_EMAIL_SENT=NO");
console.log("REAL_MINT=NO");
