import {
  verifyEthereumMainnetReadOnly,
} from "../web3/mainnetHealth.js";

console.log("");
console.log(
  "============================================",
);

console.log(
  " Ethereum Mainnet — Read Only Verification",
);

console.log(
  "============================================",
);

try {
  const result =
    await verifyEthereumMainnetReadOnly();

  console.log(
    `CHAIN_ID=${result.chainId}`,
  );

  console.log(
    `LATEST_BLOCK=${result.blockNumber}`,
  );

  console.log(
    `TOKEN=${result.symbol}`,
  );

  console.log(
    `TOKEN_DECIMALS=${result.decimals}`,
  );

  console.log(
    `TOKEN_CONTRACT=${result.tokenContract}`,
  );

  console.log(
    `RECEIVER=${result.receiverAddress}`,
  );

  console.log(
    `CONTRACT_CODE_PRESENT=${result.codePresent}`,
  );

  console.log(
    `MODE=${result.mode}`,
  );

  console.log("");
  console.log(
    "ETHEREUM_MAINNET_READONLY_STATUS=PASS",
  );
} catch (error) {
  console.error("");
  console.error(
    "ETHEREUM_MAINNET_READONLY_STATUS=FAIL",
  );

  if (
    error instanceof Error
  ) {
    console.error(
      error.message,
    );
  } else {
    console.error(error);
  }

  process.exit(1);
}
