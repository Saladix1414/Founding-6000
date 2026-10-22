import assert from "node:assert/strict";

import {
  BASE_SEPOLIA_CHAIN_ID,
  NETWORK_READINESS_RPC_METHODS,
  assertNetworkReadinessMethod,
  checkBaseSepoliaReadiness,
  type NetworkRpcRequest,
  type NetworkRpcResponse,
} from "../web3/networkReadiness.js";

const calls: NetworkRpcRequest[] = [];

async function mockTransport(
  request: NetworkRpcRequest,
): Promise<NetworkRpcResponse> {
  calls.push(request);

  if (
    request.method ===
    "eth_chainId"
  ) {
    return {
      result: "0x14a34",
    };
  }

  if (
    request.method ===
    "eth_blockNumber"
  ) {
    return {
      result: "0x123456",
    };
  }

  if (
    request.method ===
    "eth_gasPrice"
  ) {
    return {
      result: "0x3b9aca00",
    };
  }

  throw new Error(
    "UNEXPECTED_METHOD",
  );
}

const result =
  await checkBaseSepoliaReadiness(
    mockTransport,
  );

assert.equal(
  BASE_SEPOLIA_CHAIN_ID,
  84_532n,
);

assert.deepEqual(
  NETWORK_READINESS_RPC_METHODS,
  [
    "eth_chainId",
    "eth_blockNumber",
    "eth_gasPrice",
  ],
);

assert.equal(
  calls.length,
  3,
);

assert.equal(
  result.observedChainId,
  84_532n,
);

assert.equal(
  result.chainMatch,
  true,
);

assert.equal(
  result.reachable,
  true,
);

assert.equal(
  result.authority
    .deploymentAuthorized,
  false,
);

assert.equal(
  result.authority
    .fundingAuthorized,
  false,
);

assert.equal(
  result.authority
    .mintAuthorized,
  false,
);

assert.equal(
  result.authority
    .mainnetAuthorized,
  false,
);

assert.throws(
  () =>
    assertNetworkReadinessMethod(
      "eth_sendTransaction",
    ),
  /RPC_METHOD_NOT_ALLOWED/,
);

assert.throws(
  () =>
    assertNetworkReadinessMethod(
      "eth_sendRawTransaction",
    ),
  /RPC_METHOD_NOT_ALLOWED/,
);

console.log(
  "OX_NETWORK_READINESS_TEST=PASS",
);

console.log(
  "TARGET_NETWORK=BASE_SEPOLIA",
);

console.log(
  "EXPECTED_CHAIN_ID=84532",
);

console.log(
  "CHAIN_MATCH_TEST=PASS",
);

console.log(
  "RPC_WRITES_ALLOWED=NO",
);

console.log(
  "DEPLOYMENT_AUTHORIZED=false",
);

console.log(
  "FUNDING_AUTHORIZED=false",
);

console.log(
  "MINT_AUTHORIZED=false",
);

console.log(
  "MAINNET_AUTHORIZED=false",
);
