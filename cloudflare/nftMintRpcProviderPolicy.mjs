/*
 * OriginX — NFT RPC Provider Policy v1
 *
 * Base Sepolia only. Configuration validation only.
 *
 * NO network calls.
 * NO user-controlled endpoint selection.
 * NO production enabling.
 * NO signer, keys, database or mint authority.
 *
 * Network egress protection is NOT implemented
 * by this policy alone.
 */

const ERROR = "OX_NFT_RPC_PROVIDER_POLICY_REJECTED";

function deny() {
  throw new Error(ERROR);
}

const POLICY = Object.freeze({
  version: "OX-NFT-RPC-PROVIDER-POLICY-1",
  network: "base-sepolia",
  chainId: 84532,
  providerId: "base-public-sepolia",
  endpoint: "https://sepolia.base.org",
  hostname: "sepolia.base.org",
  timeoutMs: 5000,
  maxResponseBytes: 262144,
  liveRpcEnabled: false,
  mintAuthority: false,
  entitlementAuthority: false,
  allowedMethods: Object.freeze([
    "eth_chainId",
    "eth_getTransactionByHash",
    "eth_getTransactionReceipt",
    "eth_blockNumber",
    "eth_getBlockByNumber",
    "eth_getCode",
    "eth_call",
  ]),
});

export function getNftBaseSepoliaRpcPolicy() {
  return POLICY;
}

/*
 * This validator intentionally permits only
 * disabled and mock configurations.
 *
 * A future phase must explicitly implement
 * audited live connectivity.
 *
 * It is not acceptable to enable live RPC
 * merely by setting an environment variable.
 */
export function validateNftBaseSepoliaRpcConfig(
  candidate,
) {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    deny();
  }

  const expectedKeys = [
    "network",
    "chainId",
    "providerId",
    "endpoint",
    "mode",
  ];

  const keys = Object.keys(candidate);

  if (
    keys.length !== expectedKeys.length ||
    keys.some(k => !expectedKeys.includes(k))
  ) {
    deny();
  }

  if (
    candidate.network !== POLICY.network ||
    candidate.chainId !== POLICY.chainId ||
    candidate.providerId !== POLICY.providerId ||
    candidate.endpoint !== POLICY.endpoint ||
    !["disabled", "mock"].includes(
      candidate.mode,
    )
  ) {
    deny();
  }

  let url;

  try {
    url = new URL(candidate.endpoint);
  } catch {
    deny();
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== POLICY.hostname ||
    url.origin !== POLICY.endpoint ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    deny();
  }

  return Object.freeze({
    version: POLICY.version,
    network: POLICY.network,
    chainId: POLICY.chainId,
    providerId: POLICY.providerId,
    endpoint: POLICY.endpoint,
    mode: candidate.mode,
    liveRpcEnabled: false,
    mintAuthority: false,
    entitlementAuthority: false,
  });
}
