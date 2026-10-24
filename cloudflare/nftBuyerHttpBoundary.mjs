import {
  requestBuyerEmailFromWorker,
} from "./nftBuyerActorIdentity.mjs";

import {
  buyerEmailRequestAcknowledgement,
} from "./nftBuyerOrderResolver.mjs";

const MAX_BYTES = 2048;
const ORDER_PATTERN = /^F6K-[A-F0-9]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function response(payload, status) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function errorResponse(status) {
  if (status === 405) {
    return response({
      error: "METHOD_NOT_ALLOWED",
    }, status);
  }

  if (status === 413) {
    return response({
      error: "REQUEST_TOO_LARGE",
    }, status);
  }

  if (status === 415) {
    return response({
      error: "UNSUPPORTED_MEDIA_TYPE",
    }, status);
  }

  return response({
    error: "INVALID_REQUEST",
  }, status);
}

/*
 * INTERNAL HTTP ADAPTER.
 *
 * No public route is installed here.
 * Requires explicit feature enablement AND
 * server-side secrets.
 *
 * The service parameter is injected for testing.
 * Real callers must use the trusted domain service.
 */
export async function handleBuyerEmailRequest({
  request,
  storage,
  enabled = false,
  actorSecret,
  apiKey,
  from,
  now = Date.now(),
  service,
}) {
  if (!(request instanceof Request)) {
    return errorResponse(400);
  }

  /*
   * Feature flags do not constitute authentication.
   * Both the feature gate and runtime configuration
   * must be valid before doing any work.
   */
  if (
    enabled !== true ||
    typeof actorSecret !== "string" ||
    actorSecret.length < 32 ||
    typeof apiKey !== "string" ||
    !apiKey.startsWith("re_") ||
    typeof from !== "string" ||
    !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(from)
  ) {
    return response({
      error: "NFT_BUYER_SERVICE_DISABLED",
    }, 503);
  }

  if (request.method !== "POST") {
    return errorResponse(405);
  }

  const mediaType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    ?.toLowerCase();

  if (mediaType !== "application/json") {
    return errorResponse(415);
  }

  const declared = request.headers.get("Content-Length");

  if (declared !== null) {
    if (
      !/^(0|[1-9][0-9]*)$/.test(declared) ||
      !Number.isSafeInteger(Number(declared))
    ) {
      return errorResponse(400);
    }

    if (Number(declared) > MAX_BYTES) {
      return errorResponse(413);
    }
  }

  let raw;

  try {
    raw = await request.text();
  } catch {
    return errorResponse(400);
  }

  if (
    new TextEncoder().encode(raw).byteLength >
    MAX_BYTES
  ) {
    return errorResponse(413);
  }

  let body;

  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    !Object.hasOwn(body, "orderPublicId") ||
    !Object.hasOwn(body, "email")
  ) {
    return errorResponse(400);
  }

  if (
    typeof body.orderPublicId !== "string" ||
    !ORDER_PATTERN.test(body.orderPublicId) ||
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    !EMAIL_PATTERN.test(body.email.trim())
  ) {
    return errorResponse(400);
  }

  try {
    await requestBuyerEmailFromWorker({
      request,
      secret: actorSecret,
      storage,
      orderPublicId: body.orderPublicId,
      email: body.email,
      apiKey,
      from,
      now,
      ...(service === undefined ? {} : { service }),
    });
  } catch {
    /*
     * Missing trusted origin or internal failure:
     * never report delivery as successful.
     */
    return response({
      error: "NFT_BUYER_SERVICE_UNAVAILABLE",
    }, 503);
  }

  /*
   * For syntactically valid requests, the domain
   * layer supplies a uniform acknowledgement.
   * Do not disclose order or email existence.
   */
  return response(
    buyerEmailRequestAcknowledgement(),
    202,
  );
}
