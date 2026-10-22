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

export type FoundingPaymentResult = {
  attempt:
    UsdtPaymentAttempt;

  paymentVerified:
    boolean;

  settlementCreated:
    boolean;

  verificationStatus?:
    | "PENDING"
    | "VERIFYING"
    | "VERIFIED"
    | "REJECTED";

  verificationCode?:
    string;

  order?: {
    publicId:
      string;

    status:
      string;
  };

  allocation?: {
    serialNumber:
      number;

    phaseCode:
      string;

    phaseTransitioned:
      boolean;
  };

  membership?: {
    publicId:
      string;

    serialNumber:
      number;

    foundingMember:
      boolean;

    genesisMember:
      boolean;

    status:
      string;
  };
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


export async function getUsdtPaymentAttempt(
  paymentAttemptPublicId: string,
) {
  const response =
    await fetch(
      `${API_BASE}/api/payments/usdt/attempts/${paymentAttemptPublicId}`,
      {
        method:
          "GET",

        headers: {
          "Accept":
            "application/json",
        },
      },
    );

  return parseResponse<
    FoundingPaymentResult
  >(
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


/* =========================================================
 * OX-FOUNDING-ECONOMICS-4B
 * Public-safe NFT economy view
 * ========================================================= */

export type FoundingCollectionTier =
  | "RARE"
  | "EPIC"
  | "GENESIS";

export type TokenEconomyProof = {
  status:
    | "VERIFIED"
    | "NOT_FULLY_COVERED"
    | "UNAVAILABLE";

  snapshotVersion:
    string | null;

  snapshotHash:
    string | null;

  capturedAt:
    string | null;

  network:
    string | null;

  chainId:
    number | null;

  tokenContract:
    string | null;

  vaultAddress:
    string | null;

  totalLiabilityMinor:
    string | null;

  onchainBalanceMinor:
    string | null;

  surplusDeficitMinor:
    string | null;

  coverageBps:
    string | null;

  fullyCovered:
    boolean;
};

export type TokenEconomy = {
  viewVersion:
    string;

  tokenId:
    number;

  serialNumber:
    number;

  collectionTier:
    FoundingCollectionTier;

  tierPolicy: {
    wave:
      number;

    serialStart:
      number;

    serialEnd:
      number;

    supply:
      number;

    canonicalPrimaryPriceMinor:
      string;

    canonicalPrimaryPriceUsdt:
      string;
  };

  acquisition: {
    amountMinor:
      string;

    amountUsdt:
      string;

    settledAt:
      string;
  };

  reserveContribution: {
    totalMinor:
      string;

    totalUsdt:
      string;

    reserveBps:
      number;

    economicModelVersion:
      string;

    waterfallVersion:
      string;
  };

  tierBaseAllocation: {
    amountMinor:
      string;

    amountUsdt:
      string;

    weightBps:
      number;
  };

  current:
    | {
        reserveBalanceMinor:
          string;

        reserveBalanceUsdt:
          string;

        issuedSupply:
          number;

        navMinor:
          string | null;

        navUsdt:
          string | null;

        growthDeltaMinor:
          string | null;

        growthDeltaUsdt:
          string | null;

        growthBps:
          string | null;
      }
    | null;

  proofOfReserve:
    TokenEconomyProof;
};

export async function getTokenEconomy(
  tokenId:
    number,
) {
  if (
    !Number.isInteger(
      tokenId,
    ) ||
    tokenId < 1 ||
    tokenId > 6000
  ) {
    throw new Error(
      "INVALID_TOKEN_ID",
    );
  }

  const response =
    await fetch(
      `${API_BASE}/api/economy/tokens/${tokenId}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseResponse<{
    economy:
      TokenEconomy;
  }>(
    response,
  );
}


/* =========================================================
 * OX-FOUNDING-ECONOMICS-5B
 * Public-safe NAV / reserve history
 * ========================================================= */

export type TokenEconomyHistoryItem = {
  snapshotVersion:
    string;

  snapshotHash:
    string;

  capturedAt:
    string;

  tier:
    FoundingCollectionTier;

  reserve: {
    balanceMinor:
      string;

    balanceUsdt:
      string;

    issuedSupply:
      number;

    navMinor:
      string | null;

    navUsdt:
      string | null;
  };

  growth: {
    baseMinor:
      string;

    baseUsdt:
      string;

    deltaMinor:
      string | null;

    deltaUsdt:
      string | null;

    growthBps:
      string | null;
  };

  proofOfReserve: {
    status:
      | "VERIFIED"
      | "NOT_FULLY_COVERED";

    coverageBps:
      string | null;

    fullyCovered:
      boolean;

    totalLiabilityMinor:
      string;

    onchainBalanceMinor:
      string;

    surplusDeficitMinor:
      string;

    network:
      string;

    chainId:
      number;

    tokenContract:
      string;

    vaultAddress:
      string;
  };
};

export type TokenEconomyHistory = {
  historyVersion:
    string;

  tokenId:
    number;

  collectionTier:
    FoundingCollectionTier;

  order:
    "DESC";

  pagination: {
    limit:
      number;

    hasMore:
      boolean;

    nextCursor:
      string | null;
  };

  items:
    TokenEconomyHistoryItem[];
};

export async function getTokenEconomyHistory(
  input: {
    tokenId:
      number;

    limit?:
      number;

    cursor?:
      string | null;
  },
) {
  if (
    !Number.isInteger(
      input.tokenId,
    ) ||
    input.tokenId < 1 ||
    input.tokenId > 6000
  ) {
    throw new Error(
      "INVALID_TOKEN_ID",
    );
  }

  const limit =
    input.limit ??
    25;

  if (
    !Number.isInteger(
      limit,
    ) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "INVALID_ECONOMY_HISTORY_LIMIT",
    );
  }

  const params =
    new URLSearchParams();

  params.set(
    "limit",
    String(
      limit,
    ),
  );

  if (
    input.cursor
  ) {
    params.set(
      "cursor",
      input.cursor,
    );
  }

  const response =
    await fetch(
      `${API_BASE}/api/economy/tokens/${input.tokenId}/history?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseResponse<{
    history:
      TokenEconomyHistory;
  }>(
    response,
  );
}
