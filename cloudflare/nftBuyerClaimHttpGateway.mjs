import {
  deriveBuyerActorHash,
} from "./nftBuyerActorIdentity.mjs";

import {
  forwardBuyerClaimToCore,
} from "./nftBuyerClaimWorkerBridge.mjs";

/*
 * OriginX NFT — HTTP claim security boundary.
 *
 * NOT ROUTED PUBLICLY in this phase.
 *
 * Email proof is mandatory and verified
 * by the canonical Durable Object.
 *
 * A feature flag is NOT authentication.
 * A claim token is NOT minting authority.
 */

const ROUTE = "/api/nft/buyer/claim";
const MAX_BYTES = 2048;

const ORDER = /^F6K-[A-F0-9]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[0-9a-f]{32}$/;
const TOKEN = /^0x[a-f0-9]{64}$/;

function respond(status, data) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'; frame-ancestors 'none'",
      "Vary": "Origin",
    },
  });
}

function unavailable() {
  return respond(503, {
    error: "NFT_BUYER_CLAIM_UNAVAILABLE",
  });
}

function invalid(status = 400) {
  return respond(status, {
    error: "INVALID_REQUEST",
  });
}

export async function handleBuyerClaimHttp({
  request,
  env,
  forward = forwardBuyerClaimToCore,
  deriveActor = deriveBuyerActorHash,
}) {
  /*
   * Validate configuration BEFORE reading
   * the HTTP body or contacting the DO.
   */
  if (
    !(request instanceof Request) ||
    env?.NFT_BUYER_CLAIM_HTTP_ENABLED !== "true" ||
    env?.NFT_BUYER_CLAIM_ENABLED !== "true" ||
    typeof env.NFT_BUYER_ACTOR_SECRET !== "string" ||
    env.NFT_BUYER_ACTOR_SECRET.length < 32 ||
    typeof env.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    typeof env.FOUNDING_CORE?.idFromName !== "function" ||
    typeof env.FOUNDING_CORE?.get !== "function"
  ) {
    return unavailable();
  }

  let url;

  try {
    url = new URL(request.url);
  } catch {
    return invalid();
  }

  if (url.pathname !== ROUTE) {
    return respond(404, { error: "NOT_FOUND" });
  }

  if (request.method !== "POST") {
    return respond(405, {
      error: "METHOD_NOT_ALLOWED",
    });
  }

  /*
   * Same-origin browser contract.
   *
   * Reject missing Origin rather than
   * accepting cross-site form submissions.
   * Origin and Sec-Fetch-Site are defense
   * in depth, not buyer identity.
   */
  const origin = request.headers.get("Origin");

  if (
    !origin ||
    origin !== url.origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  ) {
    return invalid(403);
  }

  const contentType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    ?.toLowerCase();

  if (contentType !== "application/json") {
    return invalid(415);
  }

  const declared = request.headers.get("Content-Length");

  if (
    declared !== null &&
    (
      !/^(0|[1-9][0-9]*)$/.test(declared) ||
      !Number.isSafeInteger(Number(declared)) ||
      Number(declared) > MAX_BYTES
    )
  ) {
    return invalid(413);
  }

  let body;

  try {
    const raw = await request.text();

    if (
      new TextEncoder().encode(raw).byteLength >
      MAX_BYTES
    ) {
      return invalid(413);
    }

    body = JSON.parse(raw);
  } catch {
    return invalid();
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return invalid();
  }

  const required = [
    "challengeId",
    "code",
    "email",
    "orderPublicId",
  ];

  const keys = Object.keys(body).sort();

  if (
    keys.length !== required.length ||
    keys.some((key, i) => key !== required[i])
  ) {
    return invalid();
  }

  if (
    typeof body.orderPublicId !== "string" ||
    !ORDER.test(body.orderPublicId) ||
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    !EMAIL.test(body.email.trim()) ||
    typeof body.challengeId !== "string" ||
    !UUID.test(body.challengeId) ||
    typeof body.code !== "string" ||
    !CODE.test(body.code)
  ) {
    return invalid();
  }

  let actorHash;

  try {
    actorHash = await deriveActor({
      request,
      secret: env.NFT_BUYER_ACTOR_SECRET,
    });

    if (
      typeof actorHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(actorHash)
    ) {
      return unavailable();
    }
  } catch {
    return unavailable();
  }

  let credential;

  try {
    credential = await forward({
      env,
      orderPublicId: body.orderPublicId,
      email: body.email.trim(),
      challengeId: body.challengeId,
      code: body.code,
      actorHash,
    });
  } catch {
    /*
     * Do not reveal challenge status,
     * membership identity or DO errors.
     */
    return respond(403, {
      error: "NFT_BUYER_CLAIM_UNAVAILABLE",
    });
  }

  if (
    !credential ||
    typeof credential.claimToken !== "string" ||
    !TOKEN.test(credential.claimToken) ||
    typeof credential.claimExpiresAt !== "string" ||
    !Number.isFinite(
      Date.parse(credential.claimExpiresAt)
    ) ||
    Date.parse(credential.claimExpiresAt) <= Date.now()
  ) {
    return unavailable();
  }

  return respond(200, {
    claimToken: credential.claimToken,
    claimExpiresAt: credential.claimExpiresAt,
  });
}
