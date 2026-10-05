import {
  formatUnits,
} from "ethers";

import {
  findRecentRealUsdtWitness,
} from "../web3/realUsdtWitness.js";

console.log("");
console.log(
  "============================================",
);

console.log(
  " REAL ETHEREUM USDT — READ ONLY TEST",
);

console.log(
  "============================================",
);

try {
  const witness =
    await findRecentRealUsdtWitness();

  console.log(
    `CHAIN_ID=${witness.chainId}`,
  );

  console.log(
    `TX_HASH=${witness.txHash}`,
  );

  console.log(
    `BLOCK=${witness.blockNumber}`,
  );

  console.log(
    `RECEIPT_STATUS=${witness.receiptStatus}`,
  );

  console.log(
    `TOKEN_CONTRACT=${witness.tokenContract}`,
  );

  console.log(
    `FROM=${witness.sender}`,
  );

  console.log(
    `TO=${witness.receiver}`,
  );

  console.log(
    `AMOUNT_MINOR=${witness.amountMinor.toString()}`,
  );

  console.log(
    `AMOUNT_USDT=${formatUnits(
      witness.amountMinor,
      6,
    )}`,
  );

  console.log(
    `CONFIRMATIONS=${witness.confirmations}`,
  );

  console.log("");
  console.log(
    "REAL_USDT_RECEIPT_VERIFICATION=PASS",
  );

  console.log(
    "CAMPAIGN_PAYMENT=NO",
  );

  console.log(
    "TRANSACTION_SENT_BY_US=NO",
  );

  console.log(
    "MODE=READ_ONLY",
  );
} catch (error) {
  console.error("");
  console.error(
    "REAL_USDT_RECEIPT_VERIFICATION=FAIL",
  );

  if (
    error instanceof Error
  ) {
    console.error(
      error.message,
    );
  } else {
    console.error(
      error,
    );
  }

  process.exit(1);
}
