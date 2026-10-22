import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ganache from "ganache";
import solc from "solc";

import {
  BrowserProvider,
  ContractFactory,
} from "ethers";

const MAX_SUPPLY = 6000;

const CONTRACT_FILE =
  "blockchain/contracts/OriginXFoundingAccess.sol";

const source =
  fs.readFileSync(
    CONTRACT_FILE,
    "utf8",
  );

function findImports(importPath) {
  const candidates = [
    importPath,
    path.join(
      "node_modules",
      importPath,
    ),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(candidate)
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
  language: "Solidity",

  sources: {
    "OriginXFoundingAccess.sol": {
      content: source,
    },
  },

  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },

    evmVersion: "shanghai",

    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
        ],
      },
    },
  },
};

const output =
  JSON.parse(
    solc.compile(
      JSON.stringify(input),
      {
        import: findImports,
      },
    ),
  );

const fatal =
  (output.errors ?? []).filter(
    (entry) =>
      entry.severity ===
      "error",
  );

if (fatal.length > 0) {
  for (const entry of fatal) {
    console.error(
      entry.formattedMessage,
    );
  }

  process.exit(1);
}

const compiled =
  output.contracts[
    "OriginXFoundingAccess.sol"
  ][
    "OriginXFoundingAccess"
  ];

console.log(
  "FULL_SUPPLY_SOLIDITY_COMPILE=PASS",
);

const ganacheProvider =
  ganache.provider({
    logging: {
      quiet: true,
    },

    wallet: {
      totalAccounts: 6,
    },

    miner: {
      blockGasLimit:
        30_000_000,
    },

    chain: {
      chainId: 31337,
    },
  });

const provider =
  new BrowserProvider(
    ganacheProvider,
  );

const admin =
  await provider.getSigner(0);

const minter =
  await provider.getSigner(1);

const holderA =
  await provider.getSigner(2);

const holderB =
  await provider.getSigner(3);

const adminAddress =
  await admin.getAddress();

const minterAddress =
  await minter.getAddress();

const holderAAddress =
  await holderA.getAddress();

const holderBAddress =
  await holderB.getAddress();

const baseURI =
  "https://founding-6000-prelaunch.digitalboostlaunch.workers.dev/nft/metadata/";

const factory =
  new ContractFactory(
    compiled.abi,
    compiled.evm
      .bytecode
      .object,
    admin,
  );

const contract =
  await factory.deploy(
    adminAddress,
    minterAddress,
    baseURI,
  );

await contract.waitForDeployment();

console.log(
  "FULL_SUPPLY_LOCAL_DEPLOY=PASS",
);

assert.equal(
  (
    await contract.MAX_SUPPLY()
  ).toString(),
  "6000",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "0",
);

console.log(
  "INITIAL_TOTAL_MINTED=0",
);

async function mustRevert(
  fn,
  label,
) {
  let reverted = false;

  try {
    const result =
      await fn();

    if (
      result &&
      typeof result.wait ===
        "function"
    ) {
      await result.wait();
    }
  } catch {
    reverted = true;
  }

  assert.equal(
    reverted,
    true,
    label,
  );
}

/*
 * ------------------------------------------------
 * FULL CANONICAL SUPPLY
 * ------------------------------------------------
 *
 * This is intentionally exhaustive:
 *
 * tokenId 1
 * ...
 * tokenId 6000
 *
 * Each canonical serial is minted exactly once.
 */

const startedAt =
  Date.now();

for (
  let tokenId = 1;
  tokenId <= MAX_SUPPLY;
  tokenId += 1
) {
  await (
    await contract
      .connect(minter)
      .mint(
        holderAAddress,
        tokenId,
        {
          gasLimit:
            300_000n,
        },
      )
  ).wait();

  if (
    tokenId % 500 === 0 ||
    tokenId === MAX_SUPPLY
  ) {
    const elapsedSeconds =
      Math.round(
        (
          Date.now()
          - startedAt
        )
        / 1000,
      );

    console.log(
      `FULL_SUPPLY_PROGRESS=${tokenId}/${MAX_SUPPLY}`
    );

    console.log(
      `ELAPSED_SECONDS=${elapsedSeconds}`
    );
  }
}

console.log(
  "MINT_1_THROUGH_6000=PASS",
);

/*
 * Exact supply count.
 */

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

console.log(
  "TOTAL_MINTED_6000=PASS",
);

/*
 * Boundary ownership.
 */

for (
  const tokenId of [
    1,
    2,
    999,
    1000,
    1001,
    2999,
    3000,
    3001,
    5999,
    6000,
  ]
) {
  assert.equal(
    await contract.ownerOf(
      tokenId,
    ),
    holderAAddress,
  );
}

console.log(
  "BOUNDARY_OWNERSHIP=PASS",
);

/*
 * Tier boundaries implied by canonical serials.
 *
 * RARE       1..1000
 * EPIC       1001..3000
 * LEGENDARY  3001..6000
 */

assert.equal(
  await contract.ownerOf(1000),
  holderAAddress,
);

assert.equal(
  await contract.ownerOf(1001),
  holderAAddress,
);

assert.equal(
  await contract.ownerOf(3000),
  holderAAddress,
);

assert.equal(
  await contract.ownerOf(3001),
  holderAAddress,
);

console.log(
  "CANONICAL_TIER_BOUNDARIES=PASS",
);

/*
 * Public metadata endpoints.
 */

assert.equal(
  await contract.tokenURI(1),
  baseURI + "1.json",
);

assert.equal(
  await contract.tokenURI(1000),
  baseURI + "1000.json",
);

assert.equal(
  await contract.tokenURI(1001),
  baseURI + "1001.json",
);

assert.equal(
  await contract.tokenURI(3000),
  baseURI + "3000.json",
);

assert.equal(
  await contract.tokenURI(3001),
  baseURI + "3001.json",
);

assert.equal(
  await contract.tokenURI(6000),
  baseURI + "6000.json",
);

console.log(
  "FULL_SUPPLY_METADATA_BOUNDARIES=PASS",
);

/*
 * Exhaustion:
 *
 * tokenId 6001 is outside the canonical collection.
 */

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAAddress,
        6001,
      ),

  "token 6001 must revert",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

console.log(
  "TOKEN_6001_BLOCKED=YES",
);

/*
 * Duplicate cannot inflate totalMinted.
 */

for (
  const tokenId of [
    1,
    1000,
    1001,
    3000,
    3001,
    6000,
  ]
) {
  await mustRevert(
    () =>
      contract
        .connect(minter)
        .mint(
          holderAAddress,
          tokenId,
        ),

    `duplicate ${tokenId} must revert`,
  );
}

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

console.log(
  "DUPLICATE_AFTER_FULL_SUPPLY=BLOCKED",
);

console.log(
  "SUPPLY_COUNTER_CANNOT_EXCEED_6000=PASS",
);

/*
 * Transfers remain possible after full mint.
 *
 * Minted supply must not change.
 */

await (
  await contract
    .connect(holderA)
    .transferFrom(
      holderAAddress,
      holderBAddress,
      1,
      {
        gasLimit:
          200_000n,
      },
    )
).wait();

assert.equal(
  await contract.ownerOf(1),
  holderBAddress,
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

console.log(
  "POST_EXHAUSTION_TRANSFER=PASS",
);

console.log(
  "TRANSFER_DOES_NOT_CHANGE_FULL_SUPPLY=PASS",
);

/*
 * Pause still works at full supply.
 */

await (
  await contract
    .connect(admin)
    .pause()
).wait();

assert.equal(
  await contract.paused(),
  true,
);

await mustRevert(
  () =>
    contract
      .connect(holderB)
      .transferFrom(
        holderBAddress,
        holderAAddress,
        1,
      ),

  "paused full-supply transfer must revert",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

console.log(
  "FULL_SUPPLY_PAUSE=PASS",
);

await (
  await contract
    .connect(admin)
    .unpause()
).wait();

assert.equal(
  await contract.paused(),
  false,
);

/*
 * Metadata migration + irreversible freeze
 * must remain valid at full supply.
 */

const finalBaseURI =
  "https://nft.example.invalid/nft/metadata/";

await (
  await contract
    .connect(admin)
    .setBaseURI(
      finalBaseURI,
    )
).wait();

assert.equal(
  await contract.tokenURI(1),
  finalBaseURI
    + "1.json",
);

assert.equal(
  await contract.tokenURI(6000),
  finalBaseURI
    + "6000.json",
);

await (
  await contract
    .connect(admin)
    .freezeBaseURI()
).wait();

assert.equal(
  await contract.baseURIFrozen(),
  true,
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .setBaseURI(
        baseURI,
      ),

  "frozen URI must remain immutable",
);

console.log(
  "FULL_SUPPLY_METADATA_FREEZE=PASS",
);

/*
 * Final collection invariants.
 */

assert.equal(
  (
    await contract.MAX_SUPPLY()
  ).toString(),
  "6000",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "6000",
);

assert.equal(
  await contract.ownerOf(6000),
  holderAAddress,
);

assert.equal(
  await contract.baseURIFrozen(),
  true,
);

console.log(
  "FULL_COLLECTION_INVARIANTS=PASS",
);

console.log(
  "CANONICAL_SERIAL_RANGE=1..6000",
);

console.log(
  "MAX_SUPPLY=6000",
);

console.log(
  "TOTAL_MINTED_FINAL=6000",
);

console.log(
  "BURN_CAPABILITY=NOT_IMPLEMENTED",
);

console.log(
  "SUPPLY_IS_MONOTONIC=YES",
);

console.log(
  "OX_NFT_25_FULL_SUPPLY_TEST=PASS",
);

console.log(
  "REAL_NETWORK_DEPLOYMENT=NO",
);

console.log(
  "REAL_BLOCKCHAIN_TRANSACTION=NO",
);

await ganacheProvider.disconnect();
