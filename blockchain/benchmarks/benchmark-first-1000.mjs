import fs from "node:fs";
import path from "node:path";

import solc from "solc";
import ganache from "ganache";

import {
  BrowserProvider,
  ContractFactory,
} from "ethers";

const ROOT =
  process.cwd();

const CONTRACT_PATH =
  path.join(
    ROOT,
    "blockchain/contracts/OriginXFoundingBenchmark.sol",
  );

const CONTRACT_SOURCE =
  fs.readFileSync(
    CONTRACT_PATH,
    "utf8",
  );

function findImports(
  importPath,
) {
  const candidates = [
    path.join(
      ROOT,
      "node_modules",
      importPath,
    ),

    path.join(
      ROOT,
      "blockchain/contracts",
      importPath,
    ),
  ];

  for (
    const candidate of candidates
  ) {
    if (
      fs.existsSync(
        candidate,
      )
    ) {
      return {
        contents:
          fs.readFileSync(
            candidate,
            "utf8",
          ),
      };
    }
  }

  return {
    error:
      `IMPORT_NOT_FOUND:${importPath}`,
  };
}

const input = {
  language:
    "Solidity",

  sources: {
    "OriginXFoundingBenchmark.sol": {
      content:
        CONTRACT_SOURCE,
    },
  },

  settings: {
    /*
     * Ganache compatibility:
     *
     * Modern solc versions may emit PUSH0 for
     * Shanghai+ bytecode. The local Ganache runtime
     * used on Android may reject that opcode during
     * deployment estimation.
     *
     * Paris keeps the benchmark EVM-compatible while
     * preserving optimizer behavior.
     */
    evmVersion:
      "paris",

    optimizer: {
      enabled:
        true,

      runs:
        200,
    },

    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
        ],
      },
    },
  },
};

const output =
  JSON.parse(
    solc.compile(
      JSON.stringify(
        input,
      ),
      {
        import:
          findImports,
      },
    ),
  );

const errors =
  Array.isArray(
    output.errors,
  )
    ? output.errors
    : [];

const fatalErrors =
  errors.filter(
    (entry) =>
      entry.severity ===
      "error",
  );

if (
  fatalErrors.length >
  0
) {
  for (
    const error of fatalErrors
  ) {
    console.error(
      error.formattedMessage,
    );
  }

  throw new Error(
    "SOLIDITY_COMPILATION_FAILED",
  );
}

const artifact =
  output
    .contracts[
      "OriginXFoundingBenchmark.sol"
    ]
    .OriginXFoundingBenchmark;

const abi =
  artifact.abi;

const bytecode =
  `0x${artifact.evm.bytecode.object}`;

if (
  bytecode ===
  "0x"
) {
  throw new Error(
    "EMPTY_CONTRACT_BYTECODE",
  );
}

/*
 * Local-only deterministic EVM.
 *
 * Accounts and balances exist only inside
 * this benchmark process.
 *
 * NO REAL ETH.
 * NO REAL POL.
 * NO PUBLIC RPC.
 */
const ganacheProvider =
  ganache.provider({
    logging: {
      quiet:
        true,
    },

    wallet: {
      totalAccounts:
        4,

      defaultBalance:
        1000000,
    },

    chain: {
      chainId:
        31337,
    },
  });

const provider =
  new BrowserProvider(
    ganacheProvider,
  );

const admin =
  await provider.getSigner(
    0,
  );

const minter =
  await provider.getSigner(
    1,
  );

const recipient =
  await provider.getSigner(
    2,
  );

const adminAddress =
  await admin.getAddress();

const minterAddress =
  await minter.getAddress();

const recipientAddress =
  await recipient.getAddress();

const factory =
  new ContractFactory(
    abi,
    bytecode,
    admin,
  );

const contract =
  await factory.deploy(
    adminAddress,
    minterAddress,
    "https://founding.originx.invalid/nft/rare/",
  );

const deploymentTransaction =
  contract.deploymentTransaction();

if (!deploymentTransaction) {
  throw new Error(
    "DEPLOYMENT_TRANSACTION_MISSING",
  );
}

const deployReceipt =
  await deploymentTransaction.wait();

if (!deployReceipt) {
  throw new Error(
    "DEPLOYMENT_RECEIPT_MISSING",
  );
}

const contractAddress =
  await contract.getAddress();

const mintContract =
  contract.connect(
    minter,
  );

let mintGasTotal =
  0n;

let mintGasMin =
  null;

let mintGasMax =
  0n;

let firstMintGas =
  null;

let lastMintGas =
  null;

const gasSamples =
  [];

const startedAt =
  Date.now();

for (
  let tokenId = 1;
  tokenId <= 1000;
  tokenId += 1
) {
  const tx =
    await mintContract.mint(
      recipientAddress,
      tokenId,
    );

  const receipt =
    await tx.wait();

  if (!receipt) {
    throw new Error(
      `MINT_RECEIPT_MISSING:${tokenId}`,
    );
  }

  const gasUsed =
    receipt.gasUsed;

  mintGasTotal +=
    gasUsed;

  if (
    mintGasMin ===
      null ||
    gasUsed <
      mintGasMin
  ) {
    mintGasMin =
      gasUsed;
  }

  if (
    gasUsed >
    mintGasMax
  ) {
    mintGasMax =
      gasUsed;
  }

  if (
    tokenId ===
      1
  ) {
    firstMintGas =
      gasUsed;
  }

  if (
    tokenId ===
      1000
  ) {
    lastMintGas =
      gasUsed;
  }

  if (
    tokenId <=
      10 ||
    tokenId % 100 ===
      0
  ) {
    gasSamples.push({
      tokenId,
      gasUsed:
        gasUsed.toString(),
    });
  }

  if (
    tokenId % 100 ===
      0
  ) {
    console.log(
      `MINT_PROGRESS=${tokenId}/1000`,
    );
  }
}

const elapsedMs =
  Date.now() -
  startedAt;

const owner1 =
  await contract.ownerOf(
    1,
  );

const owner1000 =
  await contract.ownerOf(
    1000,
  );

if (
  owner1.toLowerCase() !==
    recipientAddress.toLowerCase()
) {
  throw new Error(
    "TOKEN_1_OWNER_INVALID",
  );
}

if (
  owner1000.toLowerCase() !==
    recipientAddress.toLowerCase()
) {
  throw new Error(
    "TOKEN_1000_OWNER_INVALID",
  );
}

const averageMintGas =
  mintGasTotal /
  1000n;

const operationalHeadroomBps =
  1500n;

const projectedWithHeadroom =
  (
    mintGasTotal *
    (
      10000n +
      operationalHeadroomBps
    )
  ) /
  10000n;

const benchmark = {
  version:
    "OX-NFT-GAS-BENCHMARK-1",

  environment: {
    network:
      "LOCAL_GANACHE",

    chainId:
      31337,

    realFundsUsed:
      false,

    publicRpcUsed:
      false,
  },

  compiler: {
    solcVersion:
      solc.version(),

    optimizer:
      true,

    optimizerRuns:
      200,
  },

  contract: {
    name:
      "OriginXFoundingBenchmark",

    address:
      contractAddress,

    maxSupply:
      6000,

    benchmarkTier:
      "RARE",

    benchmarkTokenStart:
      1,

    benchmarkTokenEnd:
      1000,
  },

  gas: {
    deployment:
      deployReceipt
        .gasUsed
        .toString(),

    firstMint:
      firstMintGas
        ?.toString() ??
      null,

    lastMint:
      lastMintGas
        ?.toString() ??
      null,

    minimumMint:
      mintGasMin
        ?.toString() ??
      null,

    maximumMint:
      mintGasMax
        .toString(),

    averageMint:
      averageMintGas
        .toString(),

    mint1000Total:
      mintGasTotal
        .toString(),

    deploymentPlus1000Mints:
      (
        deployReceipt.gasUsed +
        mintGasTotal
      ).toString(),

    mint1000With15PercentHeadroom:
      projectedWithHeadroom
        .toString(),

    deploymentPlus1000With15PercentMintHeadroom:
      (
        deployReceipt.gasUsed +
        projectedWithHeadroom
      ).toString(),
  },

  execution: {
    mintCount:
      1000,

    elapsedMs,

    ownerVerification:
      true,
  },

  samples:
    gasSamples,

  authority: {
    mainnetAuthorized:
      false,

    realTransaction:
      false,

    reserveAuthority:
      false,
  },
};

const outputDirectory =
  path.join(
    ROOT,
    "docs/nft/benchmarks",
  );

fs.mkdirSync(
  outputDirectory,
  {
    recursive:
      true,
  },
);

const outputPath =
  path.join(
    outputDirectory,
    "ox-nft-22-local-gas.json",
  );

fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    benchmark,
    null,
    2,
  )}\n`,
  "utf8",
);

console.log("");
console.log(
  "==============================================",
);

console.log(
  " OX-NFT-22 LOCAL GAS BENCHMARK PASS",
);

console.log(
  "==============================================",
);

console.log(
  `DEPLOY_GAS=${benchmark.gas.deployment}`,
);

console.log(
  `FIRST_MINT_GAS=${benchmark.gas.firstMint}`,
);

console.log(
  `AVERAGE_MINT_GAS=${benchmark.gas.averageMint}`,
);

console.log(
  `MAX_MINT_GAS=${benchmark.gas.maximumMint}`,
);

console.log(
  `TOTAL_1000_MINT_GAS=${benchmark.gas.mint1000Total}`,
);

console.log(
  `DEPLOY_PLUS_1000=${benchmark.gas.deploymentPlus1000Mints}`,
);

console.log(
  `DEPLOY_PLUS_1000_WITH_HEADROOM=${benchmark.gas.deploymentPlus1000With15PercentMintHeadroom}`,
);

console.log(
  "OWNER_0001=VERIFIED",
);

console.log(
  "OWNER_1000=VERIFIED",
);

console.log(
  "REAL_FUNDS_USED=NO",
);

console.log(
  "PUBLIC_RPC_USED=NO",
);

console.log(
  `RESULT=${outputPath}`,
);

await ganacheProvider.disconnect();
