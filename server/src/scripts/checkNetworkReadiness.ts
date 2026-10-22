import {
  checkBaseSepoliaReadiness,
  createNetworkReadOnlyTransport,
} from "../web3/networkReadiness.js";

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
      "OX_BASE_SEPOLIA_READONLY_RPC_URL",
    );

  const transport =
    createNetworkReadOnlyTransport(
      rpcUrl,
    );

  const result =
    await checkBaseSepoliaReadiness(
      transport,
    );

  console.log(
    JSON.stringify(
      {
        version:
          result.version,

        expectedChainId:
          result.expectedChainId
            .toString(),

        observedChainId:
          result.observedChainId
            .toString(),

        chainMatch:
          result.chainMatch,

        blockNumber:
          result.blockNumber
            .toString(),

        gasPriceWei:
          result.gasPriceWei
            .toString(),

        reachable:
          result.reachable,

        deploymentAuthorized:
          result.authority
            .deploymentAuthorized,

        fundingAuthorized:
          result.authority
            .fundingAuthorized,

        mintAuthorized:
          result.authority
            .mintAuthorized,

        mainnetAuthorized:
          result.authority
            .mainnetAuthorized,
      },
      null,
      2,
    ),
  );

  if (!result.chainMatch) {
    throw new Error(
      "BASE_SEPOLIA_CHAIN_ID_MISMATCH",
    );
  }

  console.log(
    "BASE_SEPOLIA_NETWORK_READINESS=PASS",
  );

  console.log(
    "NETWORK_OBSERVATION_IS_AUTHORITY=NO",
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
