/*
 * Production defaults to same-origin.
 *
 * Example:
 *   https://founding.example/api/...
 *
 * Development uses the Vite /api proxy.
 *
 * VITE_API_URL remains available only when an explicit
 * external API origin is intentionally required.
 */
const API_BASE =
  (
    import.meta.env.VITE_API_URL ??
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      "",
    );

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const payload =
    await response.json();

  if (!response.ok) {
    const errorPayload =
      payload as ApiErrorPayload;

    throw new Error(
      errorPayload.error ??
      errorPayload.message ??
      `HTTP_${response.status}`,
    );
  }

  return payload as T;
}

export type FoundingOrder = {
  publicId: string;
  email: string;

  phase: {
    code: string;
    name: string;
  };

  referencePriceUsd: number;
  status: string;
};

export type UsdtPaymentAttempt = {
  publicId: string;

  paymentMethod: "USDT";

  network: string;
  chainId: number;

  tokenContract: string;
  tokenDecimals: number;

  receiverAddress: string;

  expectedAmountMinor: number;
  expectedAmountUsdt: string;

  status:
    | "AWAITING_TRANSFER"
    | "SUBMITTED"
    | "VERIFYING"
    | "VERIFIED"
    | "REJECTED"
    | "EXPIRED";

  txHash:
    | string
    | null;

  createdAt: string;
};

export async function createFoundingOrder(
  email: string,
) {
  const idempotencyKey =
    `web-order-${crypto.randomUUID()}`;

  const response =
    await fetch(
      `${API_BASE}/api/orders`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            idempotencyKey,
        },

        body:
          JSON.stringify({
            email,
          }),
      },
    );

  return parseResponse<{
    order: FoundingOrder;
    idempotentReplay: boolean;
  }>(
    response,
  );
}

export async function createUsdtAttempt(
  orderPublicId: string,
) {
  const idempotencyKey =
    `web-usdt-${crypto.randomUUID()}`;

  const response =
    await fetch(
      `${API_BASE}/api/payments/usdt/attempts`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Idempotency-Key":
            idempotencyKey,
        },

        body:
          JSON.stringify({
            orderPublicId,
          }),
      },
    );

  return parseResponse<{
    attempt:
      UsdtPaymentAttempt;

    idempotentReplay:
      boolean;
  }>(
    response,
  );
}

export async function submitUsdtTxHash(
  paymentAttemptPublicId: string,
  txHash: string,
) {
  const response =
    await fetch(
      `${API_BASE}/api/payments/usdt/attempts/${paymentAttemptPublicId}/submit`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            txHash,
          }),
      },
    );

  return parseResponse<{
    attempt:
      UsdtPaymentAttempt;

    paymentVerified:
      false;

    settlementCreated:
      false;

    message:
      string;
  }>(
    response,
  );
}


export type PrelaunchEmailRegistration = {
  id: string;
  email: string;
  createdAt: string;
};

export async function registerPrelaunchEmail(
  email: string,
) {
  const response =
    await fetch(
      `${API_BASE}/api/email-registrations`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            email,
          }),
      },
    );

  return parseResponse<{
    registration:
      PrelaunchEmailRegistration;
  }>(
    response,
  );
}
