/*
 * ORIGINX NFT — LOCAL TEST FIXTURE ONLY.
 *
 * Never deploy this Worker.
 * Never copy its credentials to production.
 *
 * Uses the real FoundingCore implementation,
 * real buyer-claim gateway and SQLite DO.
 */
import {
  FoundingCore,
} from "../../../../../cloudflare/foundingCore.mjs";

import {
  issueBuyerEmailCode,
} from "../../../../../cloudflare/nftBuyerEmailAuth.mjs";

import {
  handleBuyerClaimHttp,
} from "../../../../../cloudflare/nftBuyerClaimHttpGateway.mjs";

const KEY = "originx-fixture-internal-key-2026-test-only";
const ACTOR_SECRET =
  "originx-fixture-actor-secret-2026-local-only";

const LOCAL_HOST = "127.0.0.1";

function localOnly(request) {
  const url = new URL(request.url);

  return (
    url.hostname === LOCAL_HOST &&
    request.headers.get("X-OriginX-Fixture-Key") === KEY
  );
}

function reply(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export class FixtureCore extends FoundingCore {
  async fetch(request) {
    const path = new URL(request.url).pathname;

    if (path === "/__fixture/seed") {
      if (
        request.method !== "POST" ||
        request.headers.get("X-OriginX-Fixture-Key") !== KEY
      ) {
        return reply(403, { error: "FORBIDDEN" });
      }

      const orderId = crypto.randomUUID();
      const membershipId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      const publicId = (
        "F6K-" +
        crypto.randomUUID().replaceAll("-", "")
          .slice(0, 12).toUpperCase()
      );

      const stamp = new Date().toISOString();

      const result = this.state.storage.transactionSync(
        () => {
          this.sql.exec(`
            INSERT INTO founding_orders (
              id, public_id, phase_id, email,
              normalized_email, reference_price_usd,
              status, created_at, updated_at
            )
            VALUES (?, ?, 'fixture',
              'buyer@example.org',
              'buyer@example.org',
              50, 'PAID', ?, ?)
          `, orderId, publicId, stamp, stamp);

          this.sql.exec(`
            INSERT INTO founding_memberships (
              id, public_id, order_id,
              serial_number, founding_member,
              genesis_member, status,
              created_at, updated_at
            )
            VALUES (?, ?, ?, 51, 1, 1,
              'ACTIVATION_PENDING', ?, ?)
          `,
            membershipId,
            "mem_" + crypto.randomUUID(),
            orderId,
            stamp,
            stamp,
          );

          this.sql.exec(`
            INSERT INTO nft_mint_jobs (
              id, membership_id, order_id,
              serial_number, status,
              created_at, updated_at
            )
            VALUES (?, ?, ?, 51,
              'AWAITING_WALLET', ?, ?)
          `,
            jobId,
            membershipId,
            orderId,
            stamp,
            stamp,
          );

          const challenge = issueBuyerEmailCode({
            storage: this.state.storage,
            membershipId,
          });

          return {
            orderPublicId: publicId,
            membershipId,
            challengeId: challenge.challengeId,
            code: challenge.code,
            email: "buyer@example.org",
          };
        }
      );

      return reply(200, result);
    }

    if (path === "/__fixture/inspect") {
      if (
        request.method !== "POST" ||
        request.headers.get("X-OriginX-Fixture-Key") !== KEY
      ) {
        return reply(403, { error: "FORBIDDEN" });
      }

      const { membershipId } = await request.json();

      const grants = this.sql.exec(`
        SELECT status
        FROM nft_claim_grants
        WHERE membership_id = ?
      `, membershipId).toArray();

      const jobs = this.sql.exec(`
        SELECT status
        FROM nft_mint_jobs
        WHERE membership_id = ?
      `, membershipId).toArray();

      return reply(200, {
        issuedGrants: grants.filter(
          row => row.status === "ISSUED"
        ).length,
        totalGrants: grants.length,
        mintJobStatus: jobs[0]?.status ?? null,
      });
    }

    return super.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Fixture never operates on an external hostname.
    if (url.hostname !== LOCAL_HOST) {
      return reply(403, { error: "LOCAL_ONLY" });
    }

    const core = env.FOUNDING_CORE.get(
      env.FOUNDING_CORE.idFromName(
        "canonical-founding-6000"
      )
    );

    if (
      url.pathname === "/__fixture/seed" ||
      url.pathname === "/__fixture/inspect"
    ) {
      if (!localOnly(request)) {
        return reply(403, { error: "FORBIDDEN" });
      }

      return core.fetch(request);
    }

    if (url.pathname === "/__fixture/health") {
      return core.fetch(
        new Request(
          "https://founding-core.internal/internal/health"
        )
      );
    }

    if (url.pathname === "/api/nft/buyer/claim") {
      // In this isolated fixture only, the test
      // provides a canonical simulated client IP.
      // Production must rely on Cloudflare.
      const headers = new Headers(request.headers);
      headers.set("CF-Connecting-IP", "127.0.0.1");

      return handleBuyerClaimHttp({
        request: new Request(request, { headers }),
        env: {
          ...env,
          NFT_BUYER_CLAIM_ENABLED: "true",
          NFT_BUYER_CLAIM_HTTP_ENABLED: "true",
          NFT_BUYER_ACTOR_SECRET: ACTOR_SECRET,
          NFT_INTERNAL_SERVICE_KEY: KEY,
        },
      });
    }

    return reply(404, { error: "NOT_FOUND" });
  },
};
