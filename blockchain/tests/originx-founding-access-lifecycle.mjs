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

const source =
  fs.readFileSync(
    "blockchain/contracts/OriginXFoundingAccess.sol",
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
    if (fs.existsSync(candidate)) {
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
  "LIFECYCLE_SOLIDITY_COMPILE=PASS",
);

const ganacheProvider =
  ganache.provider({
    logging: {
      quiet: true,
    },

    wallet: {
      totalAccounts: 12,
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

const minterA =
  await provider.getSigner(1);

const holderA =
  await provider.getSigner(2);

const holderB =
  await provider.getSigner(3);

const holderC =
  await provider.getSigner(4);

const minterB =
  await provider.getSigner(5);

const adminB =
  await provider.getSigner(6);

const attacker =
  await provider.getSigner(7);

const adminAddress =
  await admin.getAddress();

const minterAAddress =
  await minterA.getAddress();

const holderAAddress =
  await holderA.getAddress();

const holderBAddress =
  await holderB.getAddress();

const holderCAddress =
  await holderC.getAddress();

const minterBAddress =
  await minterB.getAddress();

const adminBAddress =
  await adminB.getAddress();

const attackerAddress =
  await attacker.getAddress();

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
    minterAAddress,
    baseURI,
  );

await contract.waitForDeployment();

console.log(
  "LIFECYCLE_LOCAL_DEPLOY=PASS",
);

const DEFAULT_ADMIN_ROLE =
  "0x"
  + "00".repeat(32);

const MINTER_ROLE =
  id(
    "MINTER_ROLE",
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
 * Phase A — sequential minting.
 */

for (
  let tokenId = 1;
  tokenId <= 25;
  tokenId += 1
) {
  await (
    await contract
      .connect(minterA)
      .mint(
        holderAAddress,
        tokenId,
        {
          gasLimit:
            300_000n,
        },
      )
  ).wait();
}

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "25",
);

for (
  let tokenId = 1;
  tokenId <= 25;
  tokenId += 1
) {
  assert.equal(
    await contract.ownerOf(tokenId),
    holderAAddress,
  );
}

console.log(
  "SEQUENTIAL_MINT_1_25=PASS",
);

console.log(
  "TOTAL_MINTED_25=PASS",
);

/*
 * Phase B — transfers do not affect minted count.
 */

for (
  let tokenId = 1;
  tokenId <= 10;
  tokenId += 1
) {
  await (
    await contract
      .connect(holderA)
      .transferFrom(
        holderAAddress,
        holderBAddress,
        tokenId,
        {
          gasLimit:
            200_000n,
        },
      )
  ).wait();
}

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "25",
);

for (
  let tokenId = 1;
  tokenId <= 10;
  tokenId += 1
) {
  assert.equal(
    await contract.ownerOf(tokenId),
    holderBAddress,
  );
}

console.log(
  "TRANSFER_1_10=PASS",
);

console.log(
  "TRANSFER_DOES_NOT_CHANGE_TOTAL_MINTED=PASS",
);

/*
 * Phase C — pause freezes lifecycle changes.
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
      .connect(minterA)
      .mint(
        holderAAddress,
        26,
      ),

  "paused mint must revert",
);

await mustRevert(
  () =>
    contract
      .connect(holderB)
      .transferFrom(
        holderBAddress,
        holderCAddress,
        1,
      ),

  "paused transfer must revert",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "25",
);

console.log(
  "PAUSED_LIFECYCLE_BLOCKED=YES",
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
 * Phase D — minter rotation.
 */

await (
  await contract
    .connect(admin)
    .grantRole(
      MINTER_ROLE,
      minterBAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    minterBAddress,
  ),
  true,
);

await (
  await contract
    .connect(admin)
    .revokeRole(
      MINTER_ROLE,
      minterAAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    minterAAddress,
  ),
  false,
);

await mustRevert(
  () =>
    contract
      .connect(minterA)
      .mint(
        holderAAddress,
        26,
      ),

  "revoked minter A must fail",
);

await (
  await contract
    .connect(minterB)
    .mint(
      holderAAddress,
      26,
      {
        gasLimit:
          300_000n,
      },
    )
).wait();

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "26",
);

assert.equal(
  await contract.ownerOf(26),
  holderAAddress,
);

console.log(
  "MINTER_ROTATION=PASS",
);

/*
 * Phase E — second admin remains separated.
 */

await (
  await contract
    .connect(admin)
    .grantRole(
      DEFAULT_ADMIN_ROLE,
      adminBAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    DEFAULT_ADMIN_ROLE,
    adminBAddress,
  ),
  true,
);

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    adminBAddress,
  ),
  false,
);

await mustRevert(
  () =>
    contract
      .connect(adminB)
      .grantRole(
        MINTER_ROLE,
        adminBAddress,
      ),

  "admin B cannot also become minter",
);

console.log(
  "SECONDARY_ADMIN_SEPARATION=PASS",
);

/*
 * Phase F — attacker still has no authority.
 */

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .grantRole(
        MINTER_ROLE,
        attackerAddress,
      ),

  "attacker cannot grant minter role",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .pause(),

  "attacker cannot pause",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .setBaseURI(
        "https://attacker.invalid/",
      ),

  "attacker cannot change URI",
);

console.log(
  "ATTACKER_AUTHORITY=NONE",
);

/*
 * Phase G — metadata stability across transfer.
 */

const beforeTransferURI =
  await contract.tokenURI(1);

await (
  await contract
    .connect(holderB)
    .transferFrom(
      holderBAddress,
      holderCAddress,
      1,
      {
        gasLimit:
          200_000n,
      },
    )
).wait();

assert.equal(
  await contract.ownerOf(1),
  holderCAddress,
);

const afterTransferURI =
  await contract.tokenURI(1);

assert.equal(
  beforeTransferURI,
  afterTransferURI,
);

console.log(
  "TOKEN_URI_STABLE_ACROSS_TRANSFER=PASS",
);

/*
 * Phase H — high boundary IDs.
 */

await (
  await contract
    .connect(minterB)
    .mint(
      holderCAddress,
      5999,
      {
        gasLimit:
          300_000n,
      },
    )
).wait();

await (
  await contract
    .connect(minterB)
    .mint(
      holderCAddress,
      6000,
      {
        gasLimit:
          300_000n,
      },
    )
).wait();

assert.equal(
  await contract.ownerOf(5999),
  holderCAddress,
);

assert.equal(
  await contract.ownerOf(6000),
  holderCAddress,
);

await mustRevert(
  () =>
    contract
      .connect(minterB)
      .mint(
        holderCAddress,
        6001,
      ),

  "token 6001 must fail",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "28",
);

console.log(
  "HIGH_BOUNDARY_TOKEN_IDS=PASS",
);

console.log(
  "TOTAL_MINTED_28=PASS",
);

/*
 * Phase I — duplicate boundary token rejected.
 */

await mustRevert(
  () =>
    contract
      .connect(minterB)
      .mint(
        holderCAddress,
        6000,
      ),

  "duplicate token 6000 must fail",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "28",
);

console.log(
  "DUPLICATE_BOUNDARY_MINT_BLOCKED=YES",
);

/*
 * Phase J — base URI migration then freeze.
 */

const migratedBaseURI =
  "https://nft.example.invalid/nft/metadata/";

await (
  await contract
    .connect(adminB)
    .setBaseURI(
      migratedBaseURI,
    )
).wait();

assert.equal(
  await contract.tokenURI(1),
  migratedBaseURI
    + "1.json",
);

assert.equal(
  await contract.tokenURI(6000),
  migratedBaseURI
    + "6000.json",
);

await (
  await contract
    .connect(adminB)
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

  "base URI cannot change after freeze",
);

console.log(
  "URI_MIGRATION_AND_FREEZE=PASS",
);

/*
 * Phase K — freeze does not break ownership.
 */

assert.equal(
  await contract.ownerOf(1),
  holderCAddress,
);

assert.equal(
  await contract.ownerOf(6000),
  holderCAddress,
);

assert.equal(
  await contract.tokenURI(1),
  migratedBaseURI
    + "1.json",
);

console.log(
  "POST_FREEZE_OWNERSHIP_STABLE=PASS",
);

/*
 * Phase L — final invariants.
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
  "28",
);

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    adminAddress,
  ),
  false,
);

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    adminBAddress,
  ),
  false,
);

assert.equal(
  await contract.hasRole(
    DEFAULT_ADMIN_ROLE,
    minterBAddress,
  ),
  false,
);

console.log(
  "FINAL_SUPPLY_INVARIANTS=PASS",
);

console.log(
  "FINAL_AUTHORITY_INVARIANTS=PASS",
);

console.log(
  "BURN_CAPABILITY=NOT_IMPLEMENTED",
);

console.log(
  "TOTAL_MINTED_MONOTONIC=YES",
);

console.log(
  "OX_NFT_25_LIFECYCLE_HARDENING_TEST=PASS",
);

console.log(
  "REAL_NETWORK_DEPLOYMENT=NO",
);

console.log(
  "REAL_BLOCKCHAIN_TRANSACTION=NO",
);

await ganacheProvider.disconnect();
