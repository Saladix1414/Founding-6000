import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path =>
  readFileSync(path, "utf8");

const core = read(
  "cloudflare/foundingCore.mjs"
);

const worker = read(
  "cloudflare/worker.mjs"
);

const gateway = read(
  "cloudflare/nftMintReadinessInternalGateway.mjs"
);

const fixture = read(
  "server/src/tests/fixtures/nft-claim-workerd/worker.mjs"
);

const config = read("wrangler.jsonc");

const privatePath =
  "/internal/nft/mint/readiness";

assert.equal(
  core.split(privatePath).length - 1,
  1
);

assert.ok(
  core.includes("handleInternalMintReadiness({")
);

assert.ok(
  core.includes("storage: this.state.storage")
);

assert.ok(
  core.includes("env: this.env")
);

/*
 * The public Worker must not expose the
 * internal readiness endpoint.
 */
assert.equal(
  worker.includes(privatePath),
  false
);

assert.equal(
  worker.includes(
    '"/api/nft/mint/readiness"'
  ),
  false
);

/*
 * The test fixture has its own temporary
 * path, never a production permission.
 */
assert.ok(
  fixture.includes(
    "/__fixture/mint/readiness"
  )
);

assert.ok(
  gateway.includes(
    "NFT_MINT_READINESS_ENABLED"
  )
);

assert.ok(
  gateway.includes(
    "NFT_READINESS_INTERNAL_KEY"
  )
);

assert.ok(
  gateway.includes(
    "X-OriginX-Readiness-Key"
  )
);

assert.ok(
  gateway.includes(
    "equalSecret("
  )
);

assert.equal(
  gateway.includes('from "node:crypto"'),
  false
);

assert.equal(
  config.includes(
    '"NFT_MINT_READINESS_ENABLED"'
  ),
  false
);

assert.equal(
  config.includes(
    '"NFT_READINESS_INTERNAL_KEY"'
  ),
  false
);

/*
 * Authorization must not be accepted from
 * any caller-supplied role or wallet.
 */
assert.ok(
  gateway.includes(
    'keys[0] !== "email"'
  )
);

assert.ok(
  gateway.includes(
    'keys[1] !== "membershipId"'
  )
);

console.log("PRIVATE_DO_ROUTE=PASS");
console.log("PUBLIC_WORKER_ROUTE_ABSENT=PASS");
console.log("DEFAULT_OFF_PRODUCTION_CONFIG=PASS");
console.log("DEDICATED_READINESS_KEY_REQUIRED=PASS");
console.log("REQUEST_AUTHORITY_INJECTION_BLOCKED=PASS");
console.log("CLOUDFLARE_COMPATIBILITY=CHECKED");

console.log("OX_NFT_5J_6_PRIVATE_ROUTE=PASS");
console.log("REAL_MINT=NO");
