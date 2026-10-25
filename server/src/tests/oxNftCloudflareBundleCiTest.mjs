import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  ".github/workflows/originx-nft-cloudflare-bundle.yml",
  "utf8",
);

const config = readFileSync(
  "wrangler.jsonc",
  "utf8",
);

assert.match(
  workflow,
  /workflow_dispatch:/,
);

assert.match(
  workflow,
  /^  push:$/m,
);

assert.match(
  workflow,
  /deploy\/cloudflare-d4/,
);

assert.doesNotMatch(
  workflow,
  /^  (pull_request|schedule):/m,
);

console.log("CI_CONTROLLED_BRANCH_TRIGGER=PASS");

assert.match(
  workflow,
  /contents: read/,
);

assert.match(
  workflow,
  /ubuntu-24\.04/,
);

console.log("CI_READ_ONLY_REPOSITORY=PASS");

assert.match(
  workflow,
  /npm ci/,
);

assert.match(
  workflow,
  /npm run server:build/,
);

assert.match(
  workflow,
  /npm run build/,
);

console.log("CI_LOCKED_BUILD=PASS");

assert.match(
  workflow,
  /oxNftBuyerDisabledRuntimeTest\.mjs/,
);

assert.match(
  workflow,
  /oxNftBuyerWorkerGatewayTest\.mjs/,
);

console.log("CI_BUYER_SECURITY_TESTS=PASS");

assert.match(
  workflow,
  /wrangler@4\.152\.0 dev/,
);

assert.match(
  workflow,
  /wrangler@4\.152\.0 deploy/,
);

assert.match(
  workflow,
  /--dry-run/,
);

assert.match(
  workflow,
  /--outdir/,
);

console.log("CI_WRANGLER_DRY_RUN_CONFIGURED=PASS");

assert.match(
  workflow,
  /NFT_BUYER_EMAIL_ENABLED: "false"/,
);

assert.doesNotMatch(
  workflow,
  /CLOUDFLARE_API_TOKEN/,
);

assert.doesNotMatch(
  workflow,
  /\$\{\{\s*secrets\./,
);

assert.doesNotMatch(
  config,
  /"NFT_BUYER_EMAIL_ENABLED"\s*:\s*"true"/,
);

console.log("CI_NFT_EMAIL_DISABLED=PASS");
console.log("CI_NO_CLOUDFLARE_CREDENTIALS=PASS");

assert.match(
  workflow,
  /WORKER_BUNDLE_DRY_RUN=PASS/,
);

console.log("NFT_CLOUDFLARE_BUNDLE_CI_TEST=PASS");
console.log("WORKFLOW_EXECUTED=NO");
console.log("DEPLOYMENT=NO");
