import {
  requestBuyerEmailVerification,
} from "./nftBuyerEmailRequest.mjs";

const encoder = new TextEncoder();

/*
 * Worker-only origin identity.
 *
 * Do not accept user-provided IP or actorHash
 * parameters here.
 *
 * Deployment requirement:
 * Cloudflare must control CF-Connecting-IP.
 * Never trust this header from an untrusted
 * reverse proxy or direct origin request.
 */
export async function deriveBuyerActorHash({
  request,
  secret,
}) {
  if (
    !(request instanceof Request) ||
    typeof secret !== "string" ||
    secret.length < 32 ||
    secret.length > 4096
  ) {
    throw new Error("NFT_ACTOR_NOT_CONFIGURED");
  }

  const ip = request.headers.get("CF-Connecting-IP");

  /*
   * Deliberately accept only ASCII IPv4/IPv6
   * characters, with no spaces or delimiters.
   *
   * This is an input-shape check; Cloudflare is
   * responsible for the authenticity of the IP.
   */
  if (
    typeof ip !== "string" ||
    ip.length < 3 ||
    ip.length > 45 ||
    !/^[0-9a-fA-F:.]+$/.test(ip)
  ) {
    throw new Error("NFT_ACTOR_ORIGIN_UNAVAILABLE");
  }

  let canonicalIp;

  if (ip.includes(":")) {
    try {
      const parsed = new URL(`http://[${ip}]/`);
      canonicalIp = parsed.hostname.slice(1, -1);
    } catch {
      throw new Error("NFT_ACTOR_ORIGIN_UNAVAILABLE");
    }
  } else {
    const octets = ip.split(".");

    if (
      octets.length !== 4 ||
      octets.some(part =>
        !/^(0|[1-9][0-9]{0,2})$/.test(part) ||
        Number(part) > 255
      )
    ) {
      throw new Error("NFT_ACTOR_ORIGIN_UNAVAILABLE");
    }

    canonicalIp = octets.join(".");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(
      `OriginX-NFT-buyer-actor-v1:${canonicalIp}`,
    ),
  );

  return Array.from(new Uint8Array(signature), b =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/*
 * Internal HTTP-to-domain adapter.
 *
 * It derives the actor identity server-side and
 * passes it into the existing rate-limited
 * domain service.
 *
 * No route is installed by this module.
 */
export async function requestBuyerEmailFromWorker({
  request,
  secret,
  storage,
  orderPublicId,
  email,
  apiKey,
  from,
  now = Date.now(),
  service = requestBuyerEmailVerification,
}) {
  const actorHash = await deriveBuyerActorHash({
    request,
    secret,
  });

  return service({
    storage,
    orderPublicId,
    email,
    actorHash,
    apiKey,
    from,
    now,
  });
}
