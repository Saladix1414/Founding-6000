const ENDPOINT = "https://api.resend.com/emails";
const CODE_PATTERN = /^[0-9a-f]{32}$/;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function sendBuyerVerificationEmail({
  apiKey,
  from,
  to,
  code,
  challengeId,
  fetcher = fetch,
}) {
  if (
    typeof apiKey !== "string" ||
    !apiKey.startsWith("re_") ||
    typeof from !== "string" ||
    !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(from) ||
    typeof to !== "string" ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)
  ) {
    throw new Error("NFT_EMAIL_NOT_CONFIGURED");
  }

  if (
    !CODE_PATTERN.test(code ?? "") ||
    !ID_PATTERN.test(challengeId ?? "")
  ) {
    throw new Error("NFT_EMAIL_INVALID_REQUEST");
  }

  let response;

  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `originx-buyer-${challengeId}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "OriginX — Verifica tu compra",
        text: [
          "Tu codigo de verificacion OriginX es:",
          "",
          code,
          "",
          "Identificador de verificacion:",
          challengeId,
          "",
          "Caduca en 30 minutos.",
          "No compartas este codigo.",
          "Si no solicitaste esta verificacion, ignora el mensaje.",
        ].join("\n"),
      }),
    });
  } catch {
    throw new Error("NFT_EMAIL_DELIVERY_UNAVAILABLE");
  }

  if (!response || !response.ok) {
    // Do not expose provider responses or secrets.
    throw new Error("NFT_EMAIL_DELIVERY_FAILED");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("NFT_EMAIL_RESPONSE_INVALID");
  }

  if (
    typeof result?.id !== "string" ||
    result.id.length === 0
  ) {
    throw new Error("NFT_EMAIL_RESPONSE_INVALID");
  }

  return {
    accepted: true,
    providerMessageId: result.id,
  };
}
