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

import {
  issueEmailBoundWalletChallenge,
} from "../../../../../cloudflare/nftWalletChallengeRequest.mjs";

import {
  verifyEmailBoundWalletChallenge,
} from "../../../../../cloudflare/nftWalletChallengeVerification.mjs";

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

    /*
     * Test-only wallet challenge and verification.
     *
     * These routes never enter the production
     * Worker or FoundingCore public API.
     */
    if (
      path === "/__fixture/wallet/challenge" ||
      path === "/__fixture/wallet/verify"
    ) {
      if (
        request.method !== "POST" ||
        request.headers.get("X-OriginX-Fixture-Key")
          !== KEY
      ) {
        return reply(403, { error: "FORBIDDEN" });
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return reply(400, { error: "INVALID_REQUEST" });
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return reply(400, { error: "INVALID_REQUEST" });
      }

      try {
        if (path === "/__fixture/wallet/challenge") {
          const result = issueEmailBoundWalletChallenge({
            storage: this.state.storage,
            claimToken: body.claimToken,
            email: body.email,
            walletAddress: body.walletAddress,
            domain: "originx.example",
            uri: "https://originx.example",
            chainId: 8453,
          });

          return reply(200, result);
        }

        const result = verifyEmailBoundWalletChallenge({
          storage: this.state.storage,
          challengeId: body.challengeId,
          claimToken: body.claimToken,
          email: body.email,
          signature: body.signature,
          expectedOrigin: "https://originx.example",
          expectedChainId: 8453,
        });

        return reply(200, {
          verified: result.verified,
          walletAddress: result.walletAddress,
          chainId: result.chainId,
        });
      } catch {
        return reply(403, {
          error: "NFT_WALLET_VERIFICATION_UNAVAILABLE",
        });
      }
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
        SELECT status, recipient_address AS recipient
        FROM nft_mint_jobs
        WHERE membership_id = ?
      `, membershipId).toArray();

      const walletChallenges = this.sql.exec(`
        SELECT status
        FROM nft_wallet_challenges
        WHERE membership_id = ?
      `, membershipId).toArray();

      const codes = this.sql.exec(`
        SELECT status, attempts
        FROM nft_buyer_email_codes
        WHERE membership_id = ?
      `, membershipId).toArray();

      const actorReservations = this.sql.exec(`
        SELECT COUNT(*) AS total
        FROM nft_email_actor_limits
      `).toArray();

      return reply(200, {
        issuedGrants: grants.filter(
          row => row.status === "ISSUED"
        ).length,
        totalGrants: grants.length,
        mintJobStatus: jobs[0]?.status ?? null,
        challengeStatus: codes[0]?.status ?? null,
        challengeAttempts: codes[0]?.attempts ?? null,
        actorBuckets: actorReservations[0]?.total ?? 0,
        verifiedWalletChallenges:
          walletChallenges.filter(
            row => row.status === "VERIFIED"
          ).length,
        consumedGrants:
          grants.filter(
            row => row.status === "CONSUMED"
          ).length,
        walletRecipient: jobs[0]?.recipient ?? null,
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
      url.pathname === "/__fixture/inspect" ||
      url.pathname === "/__fixture/wallet/challenge" ||
      url.pathname === "/__fixture/wallet/verify"
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
