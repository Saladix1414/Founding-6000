import {
  getNftBaseSepoliaRpcPolicy,
  validateNftBaseSepoliaRpcConfig,
} from "./nftMintRpcProviderPolicy.mjs";

import {
  createNftReadOnlyHttpTransport,
} from "./nftMintReadOnlyHttpTransport.mjs";

/*
 * OriginX RPC Policy Integration v1.
 *
 * LOCAL TEST / SIMULATION ONLY.
 *
 * No live transport creation.
 * No default network fetch.
 * No HTTP routes or production imports.
 * No signer or database mutation.
 *
 * The caller-provided mockFetch is trusted
 * test infrastructure. JavaScript cannot
 * prove that an arbitrary callback is offline.
 */

function deny() {
  throw new Error(
    "OX_NFT_RPC_POLICY_INTEGRATION_REJECTED"
  );
}

export function createNftBaseSepoliaMockRpc({
  config,
  mockFetch,
} = {}) {
  /*
   * Reject calls that try to smuggle
   * additional authority or configuration.
   */
  if (
    !config ||
    typeof config !== "object" ||
    typeof mockFetch !== "function"
  ) {
    deny();
  }

  let validated;

  try {
    validated = validateNftBaseSepoliaRpcConfig(
      config,
    );
  } catch {
    deny();
  }

  if (
    validated.mode !== "mock" ||
    validated.liveRpcEnabled !== false ||
    validated.mintAuthority !== false ||
    validated.entitlementAuthority !== false
  ) {
    deny();
  }

  const canonical = getNftBaseSepoliaRpcPolicy();

  if (
    validated.endpoint !== canonical.endpoint ||
    validated.chainId !== 84532 ||
    validated.providerId !== canonical.providerId
  ) {
    deny();
  }

  /*
   * No endpoint argument is forwarded
   * from an arbitrary external request.
   *
   * The URL and hostname are sourced only
   * from the canonical static policy.
   */
  const transport = createNftReadOnlyHttpTransport({
    endpoint: canonical.endpoint,
    allowedHostnames: [canonical.hostname],
    timeoutMs: canonical.timeoutMs,
    maxResponseBytes: canonical.maxResponseBytes,
    fetchImpl: mockFetch,
  });

  return Object.freeze({
    mode: "mock",
    network: canonical.network,
    chainId: canonical.chainId,
    liveRpcEnabled: false,
    mintAuthority: false,
    entitlementAuthority: false,

    async send(method, params) {
      /*
       * The underlying transport enforces
       * the read-only method allowlist.
       */
      return transport.send(method, params);
    },
  });
}
