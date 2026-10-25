import {
  completeBuyerEmailClaimSafely,
} from "./nftBuyerClaimCompletion.mjs";

import {
  reserveBuyerEmailActor,
} from "./nftBuyerEmailRequest.mjs";

const MAX_BYTES = 2048;
const ORDER = /^F6K-[A-F0-9]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[0-9a-f]{32}$/;
const ACTOR = /^[0-9a-f]{64}$/;

function reply(status, data) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function unavailable() {
  return reply(503, {
    error: "NFT_BUYER_CLAIM_UNAVAILABLE",
  });
}

function invalid() {
  return reply(400, {
    error: "INVALID_REQUEST",
  });
}

/*
 * PRIVATE DURABLE OBJECT ENTRYPOINT.
 *
 * Never expose this URL directly in the Worker.
 *
 * All requests must originate from a trusted
 * Worker-to-DO bridge authenticated by the
 * shared internal service credential.
 *
 * This service returns a short-lived bearer
 * claim credential ONLY to that trusted caller.
 *
 * Actor reservation shares the conservative
 * email+claim hourly quota for now. Split quotas
 * must be explicitly designed before launch.
 */
export async function handleInternalBuyerClaim({
  request,
  storage,
  env = {},
  reserve = reserveBuyerEmailActor,
  complete = completeBuyerEmailClaimSafely,
}) {
  if (
    !(request instanceof Request) ||
    env.NFT_BUYER_CLAIM_ENABLED !== "true" ||
    typeof env.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    !storage?.sql ||
    typeof storage.transactionSync !== "function"
  ) {
    return unavailable();
  }

  const supplied = request.headers.get(
    "X-OriginX-Internal-Key",
  );

  if (
    !supplied ||
    supplied !== env.NFT_INTERNAL_SERVICE_KEY
  ) {
    return unavailable();
  }

  if (request.method !== "POST") {
    return reply(405, {
      error: "METHOD_NOT_ALLOWED",
    });
  }

  const media = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    ?.toLowerCase();

  if (media !== "application/json") {
    return reply(415, {
      error: "UNSUPPORTED_MEDIA_TYPE",
    });
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
    Array.isArray(body)
  ) {
    return invalid();
  }

  const expected = [
    "actorHash",
    "challengeId",
    "code",
    "email",
    "orderPublicId",
  ];

  const actual = Object.keys(body).sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, i) => key !== expected[i])
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
    !CODE.test(body.code) ||
    typeof body.actorHash !== "string" ||
    !ACTOR.test(body.actorHash)
  ) {
    return invalid();
  }

  /*
   * Reserve the actor quota before order lookup.
   * The supplied actorHash must have been derived
   * by the trusted external Worker, never a browser.
   */
  let reservation;

  try {
    reservation = reserve({
      storage,
      actorHash: body.actorHash,
    });
  } catch {
    return unavailable();
  }

  if (reservation?.allowed !== true) {
    return reply(429, {
      error: "NFT_BUYER_CLAIM_UNAVAILABLE",
    });
  }

  let result;

  try {
    result = complete({
      storage,
      orderPublicId: body.orderPublicId,
      email: body.email.trim(),
      challengeId: body.challengeId,
      code: body.code,
    });
  } catch {
    return reply(403, {
      error: "NFT_BUYER_CLAIM_UNAVAILABLE",
    });
  }

  if (
    result?.verified !== true ||
    typeof result.claimToken !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(result.claimToken) ||
    typeof result.claimExpiresAt !== "string" ||
    !Number.isFinite(
      Date.parse(result.claimExpiresAt)
    )
  ) {
    return unavailable();
  }

  return reply(200, {
    claimToken: result.claimToken,
    claimExpiresAt: result.claimExpiresAt,
  });
}
