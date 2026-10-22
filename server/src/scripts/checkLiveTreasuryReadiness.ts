import {
  createHttpReadOnlyRpcTransport,
  readLiveTreasuryReadiness,
} from "../web3/liveTreasuryReadiness.js";

function requireEnv(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `MISSING_ENV:${name}`,
    );
  }

  return value;
}

async function main(): Promise<void> {
  const rpcUrl =
    requireEnv(
      "OX_NFT_READONLY_RPC_URL",
    );

  const minterAddress =
    requireEnv(
      "OX_NFT_MINTER_ADDRESS",
    );

  const transport =
    createHttpReadOnlyRpcTransport(
      rpcUrl,
    );

  const result =
    await readLiveTreasuryReadiness({
      minterAddress,
      transport,
    });

  console.log(
    JSON.stringify(
      {
        version:
          result.version,

        gasPriceWei:
          result.networkObservation
            .gasPriceWei
            .toString(),

        currentMinterBalanceWei:
          result.networkObservation
            .minterBalanceWei
            .toString(),

        requiredBalanceWei:
          result.readiness
            .requiredBalanceWei
            .toString(),

        fundingDeficitWei:
          result.readiness
            .fundingDeficitWei
            .toString(),

        fundingSurplusWei:
          result.readiness
            .fundingSurplusWei
            .toString(),

        balanceReady:
          result.readiness
            .balanceReady,

        fundingAuthorized:
          result.authority
            .fundingAuthorized,

        mintAuthorized:
          result.authority
            .mintAuthorized,

        mainnetAuthorized:
          result.authority
            .mainnetAuthorized,

        transactionSubmissionSupported:
          result.authority
            .transactionSubmissionSupported,
      },
      null,
      2,
    ),
  );

  console.log(
    "LIVE_READINESS_OBSERVATION=PASS",
  );

  console.log(
    "TELEMETRY_IS_AUTHORITY=NO",
  );

  console.log(
    "TRANSACTION_EXECUTED=NO",
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );

    process.exitCode = 1;
  },
);
