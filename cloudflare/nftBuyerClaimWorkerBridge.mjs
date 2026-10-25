/*
 * OriginX — NFT Buyer Claim Worker Bridge
 *
 * Private service adapter only.
 * No public HTTP route is registered here.
 *
 * Caller requirements:
 * - Trusted Worker runtime
 * - Actor hash derived server-side via HMAC
 * - Internal service credential
 *
 * Claim tokens are bearer credentials.
 * Never log, cache or forward them except
 * to a future explicitly authorized flow.
 */

const ORDER = /^F6K-[A-F0-9]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[0-9a-f]{32}$/;
const ACTOR = /^[a-f0-9]{64}$/;
const TOKEN = /^0x[a-f0-9]{64}$/;

function unavailable() {
  throw new Error("NFT_BUYER_CLAIM_BRIDGE_UNAVAILABLE");
}

function invalid() {
  throw new Error("NFT_BUYER_CLAIM_BRIDGE_INVALID");
}

export async function forwardBuyerClaimToCore({
  env,
  orderPublicId,
  email,
  challengeId,
  code,
  actorHash,
  now = Date.now(),
}) {
  if (
    env?.NFT_BUYER_CLAIM_ENABLED !== "true" ||
    typeof env.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    typeof env.FOUNDING_CORE?.idFromName !== "function" ||
    typeof env.FOUNDING_CORE?.get !== "function"
  ) {
    unavailable();
  }

  if (
    typeof orderPublicId !== "string" ||
    !ORDER.test(orderPublicId) ||
    typeof email !== "string" ||
    email.length > 320 ||
    !EMAIL.test(email.trim()) ||
    typeof challengeId !== "string" ||
    !UUID.test(challengeId) ||
    typeof code !== "string" ||
    !CODE.test(code) ||
    typeof actorHash !== "string" ||
    !ACTOR.test(actorHash) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    invalid();
  }

  const payload = {
    orderPublicId,
    email: email.trim(),
    challengeId,
    code,
    actorHash,
  };

  let result;

  try {
    const id = env.FOUNDING_CORE.idFromName(
      "canonical-founding-6000",
    );

    const core = env.FOUNDING_CORE.get(id);

    if (typeof core?.fetch !== "function") {
      unavailable();
    }

    result = await core.fetch(
      new Request(
        "https://founding-core.internal/internal/nft/buyer/claim",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OriginX-Internal-Key":
              env.NFT_INTERNAL_SERVICE_KEY,
          },
          body: JSON.stringify(payload),
        },
      ),
    );
  } catch {
    unavailable();
  }

  if (
    !(result instanceof Response) ||
    result.status !== 200 ||
    result.headers.get("Content-Type")
      ?.split(";")[0]?.trim()?.toLowerCase() !==
        "application/json"
  ) {
    unavailable();
  }

  /*
   * Reject unexpectedly large DO responses.
   * Do not trust a success status alone.
   */
  let data;

  try {
    const raw = await result.text();

    if (
      new TextEncoder().encode(raw).byteLength > 1024
    ) {
      unavailable();
    }

    data = JSON.parse(raw);
  } catch {
    unavailable();
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length !== 2 ||
    typeof data.claimToken !== "string" ||
    !TOKEN.test(data.claimToken) ||
    typeof data.claimExpiresAt !== "string"
  ) {
    unavailable();
  }

  const expiry = Date.parse(data.claimExpiresAt);

  if (
    !Number.isFinite(expiry) ||
    expiry <= now ||
    expiry > now + 15 * 60 * 1000
  ) {
    unavailable();
  }

  return Object.freeze({
    claimToken: data.claimToken,
    claimExpiresAt: data.claimExpiresAt,
  });
}
