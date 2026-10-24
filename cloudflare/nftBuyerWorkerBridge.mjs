/*
 * OriginX — Worker to Durable Object buyer bridge.
 *
 * INTERNAL ADAPTER ONLY.
 *
 * No public endpoint is installed here.
 * The caller must derive actorHash via HMAC
 * from trusted Cloudflare request context.
 *
 * A feature flag is NOT buyer authentication.
 */

const ORDER = /^F6K-[A-F0-9]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTOR = /^[0-9a-f]{64}$/;

const GENERIC_ACK = Object.freeze({
  acceptedForProcessing: true,
  message:
    "Si los datos corresponden a una compra elegible, enviaremos instrucciones al correo registrado.",
});

function unavailable() {
  throw new Error("NFT_BUYER_BRIDGE_UNAVAILABLE");
}

export async function forwardBuyerEmailToCore({
  env,
  orderPublicId,
  email,
  actorHash,
}) {
  /*
   * No actions without an explicitly enabled
   * runtime and a configured internal credential.
   */
  if (
    env?.NFT_BUYER_EMAIL_ENABLED !== "true" ||
    typeof env?.NFT_INTERNAL_SERVICE_KEY !== "string" ||
    env.NFT_INTERNAL_SERVICE_KEY.length < 32 ||
    typeof env?.FOUNDING_CORE?.idFromName !== "function" ||
    typeof env?.FOUNDING_CORE?.get !== "function"
  ) {
    unavailable();
  }

  if (
    typeof orderPublicId !== "string" ||
    !ORDER.test(orderPublicId) ||
    typeof email !== "string" ||
    email.length > 320 ||
    !EMAIL.test(email.trim()) ||
    typeof actorHash !== "string" ||
    !ACTOR.test(actorHash)
  ) {
    throw new Error("NFT_BUYER_BRIDGE_INVALID_INPUT");
  }

  const payload = {
    orderPublicId,
    email: email.trim(),
    actorHash,
  };

  let core;

  try {
    const id = env.FOUNDING_CORE.idFromName(
      "canonical-founding-6000",
    );

    core = env.FOUNDING_CORE.get(id);
  } catch {
    unavailable();
  }

  if (typeof core?.fetch !== "function") {
    unavailable();
  }

  let result;

  try {
    result = await core.fetch(
      new Request(
        "https://founding-core.internal/internal/nft/buyer/email",
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

  /*
   * Do not relay internal response bodies.
   * Errors may contain private operational data.
   */
  if (!(result instanceof Response) ||
      result.status !== 202) {
    unavailable();
  }

  return { ...GENERIC_ACK };
}
