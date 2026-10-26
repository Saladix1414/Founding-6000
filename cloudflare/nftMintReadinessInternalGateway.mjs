import {
  prepareNftMintReadiness,
} from "./nftMintReadinessTransition.mjs";

/*
 * OriginX PHASE 5J.6
 *
 * Private Durable Object service adapter.
 *
 * Not registered as a production HTTP route.
 * Must never be exposed directly to clients.
 *
 * A dedicated readiness credential and explicit
 * feature flag are required.
 *
 * The credential is server-side configuration.
 * No caller-supplied authorization callback,
 * wallet address, role or approval is accepted.
 *
 * This is not authority to execute blockchain
 * transactions.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_BYTES = 1024;

function reply(status, body) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function unavailable() {
  return reply(403, {
    error: "NFT_MINT_READINESS_UNAVAILABLE",
  });
}

function equalSecret(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (
    left.length < 32 ||
    left.length !== right.length
  ) {
    return false;
  }

  /*
   * Fixed-length byte comparison with no
   * early exit for differing byte values.
   *
   * This is not a formally guaranteed
   * constant-time primitive in JavaScript.
   * Credential confidentiality and private
   * routing remain mandatory.
   */
  let difference = 0;

  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ right[i];
  }

  return difference === 0;
}

export async function handleInternalMintReadiness({
  request,
  storage,
  env = {},
  prepare = prepareNftMintReadiness,
}) {
  /*
   * All gates are closed unless explicitly
   * configured by a trusted runtime.
   */
  if (
    !(request instanceof Request) ||
    env.NFT_MINT_READINESS_ENABLED !== "true" ||
    typeof env.NFT_READINESS_INTERNAL_KEY !== "string" ||
    env.NFT_READINESS_INTERNAL_KEY.length < 32 ||
    !storage?.sql ||
    typeof storage.transactionSync !== "function" ||
    typeof prepare !== "function"
  ) {
    return unavailable();
  }

  if (!equalSecret(
    request.headers.get("X-OriginX-Readiness-Key"),
    env.NFT_READINESS_INTERNAL_KEY,
  )) {
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

  const length = request.headers.get(
    "Content-Length",
  );

  if (
    length !== null &&
    (
      !/^(0|[1-9][0-9]*)$/.test(length) ||
      !Number.isSafeInteger(Number(length)) ||
      Number(length) > MAX_BYTES
    )
  ) {
    return reply(400, {
      error: "INVALID_REQUEST",
    });
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
    return reply(400, {
      error: "INVALID_REQUEST",
    });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return reply(400, {
      error: "INVALID_REQUEST",
    });
  }

  const keys = Object.keys(body).sort();

  if (
    keys.length !== 2 ||
    keys[0] !== "email" ||
    keys[1] !== "membershipId" ||
    typeof body.membershipId !== "string" ||
    !UUID.test(body.membershipId) ||
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    !EMAIL.test(body.email.trim())
  ) {
    return reply(400, {
      error: "INVALID_REQUEST",
    });
  }

  /*
   * The authorization decision is created
   * inside this trusted service boundary,
   * never supplied in the request body.
   *
   * Subsequent production integration must
   * restrict invocation to the intended
   * Worker/DO private path.
   */
  try {
    const result = prepare({
      storage,
      membershipId: body.membershipId,
      email: body.email,
      authorizeReadiness: context =>
        context.operation ===
          "NFT_MINT_READINESS" &&
        context.membershipId ===
          body.membershipId,
    });

    if (
      result?.prepared !== true ||
      result?.status !== "READY" ||
      result?.mintAuthority !== false ||
      result?.transactionSubmitted !== false
    ) {
      return unavailable();
    }

    return reply(200, {
      prepared: true,
      membershipId: result.membershipId,
      serialNumber: result.serialNumber,
      status: "READY",
      mintAuthority: false,
      transactionSubmitted: false,
    });
  } catch {
    return unavailable();
  }
}
