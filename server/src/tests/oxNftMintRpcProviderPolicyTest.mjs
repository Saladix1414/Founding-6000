import assert from "node:assert/strict";

import {
  getNftBaseSepoliaRpcPolicy,
  validateNftBaseSepoliaRpcConfig,
} from "../../../cloudflare/nftMintRpcProviderPolicy.mjs";

const policy = getNftBaseSepoliaRpcPolicy();

assert.equal(policy.chainId, 84532);
assert.equal(policy.network, "base-sepolia");
assert.equal(
  policy.endpoint,
  "https://sepolia.base.org",
);
assert.equal(policy.liveRpcEnabled, false);
assert.equal(policy.mintAuthority, false);
assert.equal(policy.entitlementAuthority, false);
assert.ok(Object.isFrozen(policy));
assert.ok(Object.isFrozen(policy.allowedMethods));

const expected = {
  network: policy.network,
  chainId: policy.chainId,
  providerId: policy.providerId,
  endpoint: policy.endpoint,
  mode: "disabled",
};

const disabled = validateNftBaseSepoliaRpcConfig(
  expected,
);

assert.equal(disabled.mode, "disabled");
assert.equal(disabled.liveRpcEnabled, false);
assert.ok(Object.isFrozen(disabled));

const mock = validateNftBaseSepoliaRpcConfig({
  ...expected,
  mode: "mock",
});

assert.equal(mock.mode, "mock");
assert.equal(mock.liveRpcEnabled, false);

console.log("DISABLED_MODE=PASS");
console.log("MOCK_MODE=PASS");

let rejected = 0;

function reject(name, config) {
  assert.throws(
    () => validateNftBaseSepoliaRpcConfig(config),
    /OX_NFT_RPC_PROVIDER_POLICY_REJECTED/,
    name,
  );
  rejected++;
  console.log(name + "=PASS");
}

reject("MISSING_CONFIGURATION", undefined);
reject("NULL_CONFIGURATION", null);
reject("ARRAY_CONFIGURATION", []);
reject("EMPTY_CONFIGURATION", {});

reject("MAINNET_CHAIN", {
  ...expected,
  chainId: 8453,
});

reject("MAINNET_NETWORK", {
  ...expected,
  network: "base-mainnet",
});

reject("MAINNET_ENDPOINT", {
  ...expected,
  endpoint: "https://mainnet.base.org",
});

reject("ARBITRARY_PROVIDER", {
  ...expected,
  providerId: "user-supplied",
});

reject("ARBITRARY_HOSTNAME", {
  ...expected,
  endpoint: "https://rpc.example.org",
});

reject("INSECURE_HTTP", {
  ...expected,
  endpoint: "http://sepolia.base.org",
});

reject("LOCALHOST_ENDPOINT", {
  ...expected,
  endpoint: "https://localhost",
});

reject("URL_CREDENTIALS", {
  ...expected,
  endpoint: "https://user:secret@sepolia.base.org",
});

reject("URL_QUERY", {
  ...expected,
  endpoint: "https://sepolia.base.org/?key=secret",
});

reject("UNEXPECTED_PATH", {
  ...expected,
  endpoint: "https://sepolia.base.org/alternate",
});

reject("LIVE_MODE_BLOCKED", {
  ...expected,
  mode: "live",
});

reject("PRODUCTION_MODE_BLOCKED", {
  ...expected,
  mode: "production",
});

reject("MISSING_MODE", {
  ...expected,
  mode: undefined,
});

reject("EXTRA_CONFIGURATION_FIELD", {
  ...expected,
  privateKey: "unexpected",
});

reject("EXTRA_AUTHORITY_FIELD", {
  ...expected,
  mintAuthority: true,
});

reject("WRONG_CHAIN_ID_TYPE", {
  ...expected,
  chainId: "84532",
});

assert.equal(rejected, 20);

for (const forbidden of [
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "personal_sign",
  "eth_sign",
]) {
  assert.equal(
    policy.allowedMethods.includes(forbidden),
    false,
  );
}

console.log("POLICY_ADVERSARIAL_CASES=20");
console.log("WRITE_RPC_METHODS=BLOCKED");
console.log("LIVE_NETWORK_CONNECTION=DISABLED");
console.log("NO_SIGNER=PASS");
console.log("NO_MINT_AUTHORITY=PASS");
console.log("OX_NFT_MINT_LIFECYCLE_PART_5F_1_TEST=PASS");
