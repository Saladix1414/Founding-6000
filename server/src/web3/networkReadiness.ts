export const NETWORK_READINESS_VERSION =
  "OX-NETWORK-READINESS-1" as const;

export const BASE_SEPOLIA_CHAIN_ID =
  84_532n;

export const NETWORK_READINESS_RPC_METHODS = [
  "eth_chainId",
  "eth_blockNumber",
  "eth_gasPrice",
] as const;

export type NetworkReadinessRpcMethod =
  (typeof NETWORK_READINESS_RPC_METHODS)[number];

export interface NetworkRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: NetworkReadinessRpcMethod;
  params: unknown[];
}

export interface NetworkRpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

export type NetworkRpcTransport = (
  request: NetworkRpcRequest,
) => Promise<NetworkRpcResponse>;

export interface NetworkReadinessResult {
  version:
    typeof NETWORK_READINESS_VERSION;

  expectedChainId: bigint;
  observedChainId: bigint;

  blockNumber: bigint;
  gasPriceWei: bigint;

  chainMatch: boolean;
  reachable: boolean;

  authority: {
    deploymentAuthorized: false;
    fundingAuthorized: false;
    mintAuthorized: false;
    mainnetAuthorized: false;
  };
}

function parseRpcQuantity(
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

export function assertNetworkReadinessMethod(
  method: string,
): asserts method is NetworkReadinessRpcMethod {
  if (
    !(
      NETWORK_READINESS_RPC_METHODS as readonly string[]
    ).includes(method)
  ) {
    throw new Error(
      `RPC_METHOD_NOT_ALLOWED:${method}`,
    );
  }
}

export function createNetworkReadOnlyTransport(
  rpcUrl: string,
): NetworkRpcTransport {
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
    request: NetworkRpcRequest,
  ): Promise<NetworkRpcResponse> => {
    assertNetworkReadinessMethod(
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
        NetworkRpcResponse;

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

export async function checkBaseSepoliaReadiness(
  transport: NetworkRpcTransport,
): Promise<NetworkReadinessResult> {
  const chain =
    await transport({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_chainId",
      params: [],
    });

  const block =
    await transport({
      jsonrpc: "2.0",
      id: 2,
      method: "eth_blockNumber",
      params: [],
    });

  const gas =
    await transport({
      jsonrpc: "2.0",
      id: 3,
      method: "eth_gasPrice",
      params: [],
    });

  const observedChainId =
    parseRpcQuantity(
      chain.result,
      "chainId",
    );

  const blockNumber =
    parseRpcQuantity(
      block.result,
      "blockNumber",
    );

  const gasPriceWei =
    parseRpcQuantity(
      gas.result,
      "gasPrice",
    );

  return {
    version:
      NETWORK_READINESS_VERSION,

    expectedChainId:
      BASE_SEPOLIA_CHAIN_ID,

    observedChainId,
    blockNumber,
    gasPriceWei,

    chainMatch:
      observedChainId ===
      BASE_SEPOLIA_CHAIN_ID,

    reachable:
      true,

    authority: {
      deploymentAuthorized:
        false,

      fundingAuthorized:
        false,

      mintAuthorized:
        false,

      mainnetAuthorized:
        false,
    },
  };
}
