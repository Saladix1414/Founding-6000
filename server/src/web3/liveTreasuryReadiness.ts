import {
  evaluateTreasuryFundingReadiness,
  type TreasuryFundingReadinessResult,
} from "./treasuryFundingReadiness.js";

export const LIVE_TREASURY_READINESS_VERSION =
  "OX-TREASURY-LIVE-READINESS-1" as const;

export const ALLOWED_LIVE_RPC_METHODS = [
  "eth_gasPrice",
  "eth_getBalance",
] as const;

export type AllowedLiveRpcMethod =
  (typeof ALLOWED_LIVE_RPC_METHODS)[number];

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: AllowedLiveRpcMethod;
  params: unknown[];
}

export interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

export type ReadOnlyRpcTransport = (
  request: JsonRpcRequest,
) => Promise<JsonRpcResponse>;

export interface LiveTreasuryReadinessInput {
  minterAddress: string;
  transport: ReadOnlyRpcTransport;
}

export interface LiveTreasuryReadinessResult {
  version:
    typeof LIVE_TREASURY_READINESS_VERSION;

  networkObservation: {
    gasPriceWei: bigint;
    minterBalanceWei: bigint;
  };

  readiness:
    TreasuryFundingReadinessResult;

  authority: {
    fundingAuthorized: false;
    mintAuthorized: false;
    mainnetAuthorized: false;
    transactionSubmissionSupported: false;
  };
}

const ADDRESS_PATTERN =
  /^0x[a-fA-F0-9]{40}$/;

function parseRpcHexQuantity(
  value: unknown,
  label: string,
): bigint {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(value)
  ) {
    throw new Error(
      `INVALID_RPC_QUANTITY:${label}`,
    );
  }

  return BigInt(value);
}

export function assertReadOnlyRpcMethod(
  method: string,
): asserts method is AllowedLiveRpcMethod {
  if (
    !(
      ALLOWED_LIVE_RPC_METHODS as readonly string[]
    ).includes(method)
  ) {
    throw new Error(
      `RPC_METHOD_NOT_ALLOWED:${method}`,
    );
  }
}

export function createHttpReadOnlyRpcTransport(
  rpcUrl: string,
): ReadOnlyRpcTransport {
  let parsed: URL;

  try {
    parsed = new URL(rpcUrl);
  } catch {
    throw new Error(
      "INVALID_RPC_URL",
    );
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new Error(
      "UNSUPPORTED_RPC_PROTOCOL",
    );
  }

  return async (
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> => {
    assertReadOnlyRpcMethod(
      request.method,
    );

    const response =
      await fetch(
        parsed.toString(),
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify(
            request,
          ),
        },
      );

    if (!response.ok) {
      throw new Error(
        `RPC_HTTP_ERROR:${response.status}`,
      );
    }

    const payload =
      (await response.json()) as
        JsonRpcResponse;

    if (payload.error) {
      throw new Error(
        `RPC_ERROR:${
          payload.error.code ?? "UNKNOWN"
        }:${
          payload.error.message ??
          "UNKNOWN"
        }`,
      );
    }

    return payload;
  };
}

export async function readLiveTreasuryReadiness(
  input: LiveTreasuryReadinessInput,
): Promise<LiveTreasuryReadinessResult> {
  if (
    !ADDRESS_PATTERN.test(
      input.minterAddress,
    )
  ) {
    throw new Error(
      "INVALID_MINTER_ADDRESS",
    );
  }

  const gasResponse =
    await input.transport({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_gasPrice",
      params: [],
    });

  const balanceResponse =
    await input.transport({
      jsonrpc: "2.0",
      id: 2,
      method: "eth_getBalance",
      params: [
        input.minterAddress,
        "latest",
      ],
    });

  const gasPriceWei =
    parseRpcHexQuantity(
      gasResponse.result,
      "gasPrice",
    );

  const minterBalanceWei =
    parseRpcHexQuantity(
      balanceResponse.result,
      "minterBalance",
    );

  const readiness =
    evaluateTreasuryFundingReadiness({
      gasPriceWei,
      currentMinterBalanceWei:
        minterBalanceWei,
    });

  return {
    version:
      LIVE_TREASURY_READINESS_VERSION,

    networkObservation: {
      gasPriceWei,
      minterBalanceWei,
    },

    readiness,

    authority: {
      fundingAuthorized:
        false,

      mintAuthorized:
        false,

      mainnetAuthorized:
        false,

      transactionSubmissionSupported:
        false,
    },
  };
}
