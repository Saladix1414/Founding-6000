import {
  requestBuyerEmailVerification,
} from "./nftBuyerEmailRequest.mjs";

const MAX_BYTES = 2048;
const ORDER = /^F6K-[A-F0-9]{12}$/;
const ACTOR = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(body, status) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function unavailable() {
  return reply({
    error: "NFT_BUYER_SERVICE_UNAVAILABLE",
  }, 503);
}

/*
 * Internal Durable Object boundary.
 *
 * Never call this from untrusted public requests.
 * The external Worker must first perform its own
 * HTTP checks and derive actorHash using HMAC.
 *
 * No production secret is embedded here.
 */
export async function handleInternalBuyerEmail({
  request,
  storage,
  env = {},
  service = requestBuyerEmailVerification,
}) {
  if (
    !(request instanceof Request) ||
    env.NFT_BUYER_EMAIL_ENABLED !== "true" ||
    typeof env.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    typeof env.RESEND_API_KEY !== "string" ||
    !env.RESEND_API_KEY.startsWith("re_") ||
    typeof env.NFT_EMAIL_FROM !== "string" ||
    !EMAIL.test(env.NFT_EMAIL_FROM)
  ) {
    return unavailable();
  }

  /*
   * Internal key is required even when the
   * feature flag is enabled.
   */
  const supplied = request.headers.get(
    "X-OriginX-Internal-Key",
  );

  if (!supplied ||
      supplied !== env.NFT_INTERNAL_SERVICE_KEY) {
    return unavailable();
  }

  if (request.method !== "POST") {
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const media = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    ?.toLowerCase();

  if (media !== "application/json") {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }

  const declared = request.headers.get("Content-Length");

  if (declared !== null && (
    !/^(0|[1-9][0-9]*)$/.test(declared) ||
    !Number.isSafeInteger(Number(declared)) ||
    Number(declared) > MAX_BYTES
  )) {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }

  let body;

  try {
    const text = await request.text();

    if (
      new TextEncoder().encode(text).byteLength >
      MAX_BYTES
    ) {
      return reply({ error: "INVALID_REQUEST" }, 400);
    }

    body = JSON.parse(text);
  } catch {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 3 ||
    !Object.hasOwn(body, "orderPublicId") ||
    !Object.hasOwn(body, "email") ||
    !Object.hasOwn(body, "actorHash") ||
    typeof body.orderPublicId !== "string" ||
    !ORDER.test(body.orderPublicId) ||
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    !EMAIL.test(body.email.trim()) ||
    typeof body.actorHash !== "string" ||
    !ACTOR.test(body.actorHash)
  ) {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }

  try {
    /*
     * Only the authenticated internal caller
     * supplies actorHash. It is never read
     * directly from a browser request.
     */
    await service({
      storage,
      orderPublicId: body.orderPublicId,
      email: body.email,
      actorHash: body.actorHash,
      apiKey: env.RESEND_API_KEY,
      from: env.NFT_EMAIL_FROM,
    });

    return reply({
      acceptedForProcessing: true,
      message:
        "Si los datos corresponden a una compra elegible, enviaremos instrucciones al correo registrado.",
    }, 202);
  } catch {
    // Never expose membership or provider details.
    return unavailable();
  }
}
