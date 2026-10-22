import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ganache from "ganache";
import solc from "solc";

import {
  BrowserProvider,
  ContractFactory,
  id,
} from "ethers";

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

const errors =
  output.errors ?? [];

const fatal =
  errors.filter(
    (entry) =>
      entry.severity ===
      "error",
  );

if (fatal.length > 0) {
  for (
    const entry of fatal
  ) {
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

assert.ok(
  compiled.abi,
);

assert.ok(
  compiled.evm
    .bytecode
    .object,
);

console.log(
  "SOLIDITY_COMPILE=PASS",
);

const ganacheProvider =
  ganache.provider({
    logging: {
      quiet: true,
    },

    wallet: {
      totalAccounts: 8,
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

const holder =
  await provider.getSigner(2);

const recipient =
  await provider.getSigner(3);

const attacker =
  await provider.getSigner(4);

const adminAddress =
  await admin.getAddress();

const minterAddress =
  await minter.getAddress();

assert.notEqual(
  adminAddress.toLowerCase(),
  minterAddress.toLowerCase(),
);

const initialBaseURI =
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
    initialBaseURI,
  );

await contract.waitForDeployment();

console.log(
  "LOCAL_DEPLOY=PASS",
);

console.log(
  "LOCAL_CHAIN_ONLY=YES",
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

assert.equal(
  await contract.baseURIFrozen(),
  false,
);

const defaultAdminRole =
  "0x"
  + "00".repeat(32);

const minterRole =
  id(
    "MINTER_ROLE",
  );

assert.equal(
  await contract.hasRole(
    defaultAdminRole,
    adminAddress,
  ),
  true,
);

assert.equal(
  await contract.hasRole(
    minterRole,
    minterAddress,
  ),
  true,
);

assert.equal(
  await contract.hasRole(
    minterRole,
    adminAddress,
  ),
  false,
);

assert.equal(
  await contract.hasRole(
    defaultAdminRole,
    minterAddress,
  ),
  false,
);

console.log(
  "ADMIN_MINTER_SEPARATION=PASS",
);

const holderAddress =
  await holder.getAddress();

await (
  await contract
    .connect(minter)
    .mint(
      holderAddress,
      1,
    )
).wait();

assert.equal(
  await contract.ownerOf(1),
  holderAddress,
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "1",
);

assert.equal(
  await contract.tokenURI(1),
  initialBaseURI + "1.json",
);

console.log(
  "TOKEN_0001_MINT_LOCAL=PASS",
);

console.log(
  "TOKEN_URI_JSON_SUFFIX=PASS",
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

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAddress,
        0,
      ),

  "token 0 must revert",
);

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAddress,
        6001,
      ),

  "token 6001 must revert",
);

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAddress,
        1,
      ),

  "duplicate token must revert",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .mint(
        holderAddress,
        2,
      ),

  "non-minter must not mint",
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .mint(
        holderAddress,
        2,
      ),

  "admin must not implicitly mint",
);

console.log(
  "TOKEN_RANGE_ENFORCED=YES",
);

console.log(
  "DUPLICATE_MINT_BLOCKED=YES",
);

console.log(
  "MINTER_ROLE_ENFORCED=YES",
);

const updatedBaseURI =
  "https://nft.example.invalid/nft/metadata/";

await (
  await contract
    .connect(admin)
    .setBaseURI(
      updatedBaseURI,
    )
).wait();

assert.equal(
  await contract.tokenURI(1),
  updatedBaseURI
    + "1.json",
);

console.log(
  "BASE_URI_UPDATE=PASS",
);

await mustRevert(
  () =>
    contract
      .connect(minter)
      .setBaseURI(
        initialBaseURI,
      ),

  "minter must not change base URI",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .pause(),

  "attacker must not pause",
);

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
      .connect(minter)
      .mint(
        holderAddress,
        2,
      ),

  "paused mint must revert",
);

const recipientAddress =
  await recipient.getAddress();

await mustRevert(
  () =>
    contract
      .connect(holder)
      .transferFrom(
        holderAddress,
        recipientAddress,
        1,
      ),

  "paused transfer must revert",
);

console.log(
  "PAUSE_BLOCKS_MINT=YES",
);

console.log(
  "PAUSE_BLOCKS_TRANSFER=YES",
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

console.log(
  "UNPAUSE_STATE=PASS",
);

await (
  await contract
    .connect(holder)
    .transferFrom(
      holderAddress,
      recipientAddress,
      1,
      {
        gasLimit: 200_000n,
      },
    )
).wait();

assert.equal(
  await contract.ownerOf(1),
  recipientAddress,
);

console.log(
  "TRANSFER_AFTER_UNPAUSE=PASS",
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
        initialBaseURI,
      ),

  "base URI change after freeze must revert",
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .freezeBaseURI(),

  "second freeze must revert",
);

console.log(
  "BASE_URI_FREEZE=PASS",
);

console.log(
  "BASE_URI_FREEZE_IRREVERSIBLE=YES",
);

const finalTokenURI =
  await contract.tokenURI(1);

assert.equal(
  finalTokenURI,
  updatedBaseURI
    + "1.json",
);

console.log(
  "FINAL_TOKEN_URI="
  + finalTokenURI,
);

console.log(
  "OX_NFT_25_FINAL_CONTRACT_TEST=PASS",
);

console.log(
  "MAX_SUPPLY=6000",
);

console.log(
  "TOKEN_ID_RANGE=1..6000",
);

console.log(
  "ADMIN_MINTER_SEPARATION=YES",
);

console.log(
  "ROYALTIES_IMPLEMENTED=NO",
);

console.log(
  "REAL_NETWORK_DEPLOYMENT=NO",
);

console.log(
  "REAL_BLOCKCHAIN_TRANSACTION=NO",
);

await ganacheProvider.disconnect();
