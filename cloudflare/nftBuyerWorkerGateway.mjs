import {
  deriveBuyerActorHash,
} from "./nftBuyerActorIdentity.mjs";

import {
  forwardBuyerEmailToCore,
} from "./nftBuyerWorkerBridge.mjs";

const MAX_BYTES = 2048;
const ROUTE = "/api/nft/buyer/email";
const ORDER = /^F6K-[A-F0-9]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function unavailable() {
  return reply(503, {
    error: "NFT_BUYER_SERVICE_UNAVAILABLE",
  });
}

function invalid() {
  return reply(400, {
    error: "INVALID_REQUEST",
  });
}

/*
 * OriginX public HTTP gateway, NOT YET INSTALLED.
 *
 * Resend secrets stay in Durable Object only.
 * The Worker needs:
 *  - NFT_BUYER_EMAIL_ENABLED
 *  - NFT_BUYER_ACTOR_SECRET
 *  - NFT_INTERNAL_SERVICE_KEY
 *  - FOUNDING_CORE binding
 *
 * No trusted identity comes from JSON.
 */
export async function handleNftBuyerGateway({
  request,
  env,
  forward = forwardBuyerEmailToCore,
}) {
  if (
    !(request instanceof Request) ||
    env?.NFT_BUYER_EMAIL_ENABLED !== "true" ||
    typeof env.NFT_BUYER_ACTOR_SECRET !== "string" ||
    env.NFT_BUYER_ACTOR_SECRET.length < 32 ||
    typeof env.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    typeof env.FOUNDING_CORE?.get !== "function" ||
    typeof env.FOUNDING_CORE?.idFromName !== "function"
  ) {
    return unavailable();
  }

  if (new URL(request.url).pathname !== ROUTE) {
    return reply(404, { error: "NOT_FOUND" });
  }

  if (request.method !== "POST") {
    return reply(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const media = request.headers.get("Content-Type")
    ?.split(";")[0]?.trim()?.toLowerCase();

  if (media !== "application/json") {
    return reply(415, {
      error: "UNSUPPORTED_MEDIA_TYPE",
    });
  }

  const declared = request.headers.get("Content-Length");

  if (declared !== null && (
    !/^(0|[1-9][0-9]*)$/.test(declared) ||
    !Number.isSafeInteger(Number(declared)) ||
    Number(declared) > MAX_BYTES
  )) {
    return invalid();
  }

  let body;

  try {
    const raw = await request.text();

    if (
      new TextEncoder().encode(raw).byteLength >
      MAX_BYTES
    ) {
      return reply(413, {
        error: "REQUEST_TOO_LARGE",
      });
    }

    body = JSON.parse(raw);
  } catch {
    return invalid();
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    !Object.hasOwn(body, "orderPublicId") ||
    !Object.hasOwn(body, "email") ||
    typeof body.orderPublicId !== "string" ||
    !ORDER.test(body.orderPublicId) ||
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    !EMAIL.test(body.email.trim())
  ) {
    return invalid();
  }

  let actorHash;

  try {
    actorHash = await deriveBuyerActorHash({
      request,
      secret: env.NFT_BUYER_ACTOR_SECRET,
    });
  } catch {
    return unavailable();
  }

  try {
    const result = await forward({
      env,
      orderPublicId: body.orderPublicId,
      email: body.email.trim(),
      actorHash,
    });

    if (result?.acceptedForProcessing !== true) {
      return unavailable();
    }
  } catch {
    return unavailable();
  }

  /*
   * Return the same non-sensitive acknowledgement
   * for eligible and ineligible orders.
   */
  return reply(202, {
    acceptedForProcessing: true,
    message:
      "Si los datos corresponden a una compra elegible, enviaremos instrucciones al correo registrado.",
  });
}
