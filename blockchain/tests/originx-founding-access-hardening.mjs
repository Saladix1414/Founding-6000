import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ganache from "ganache";
import solc from "solc";

import {
  BrowserProvider,
  ContractFactory,
  ZeroAddress,
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
  "HARDENING_SOLIDITY_COMPILE=PASS",
);

const ganacheProvider =
  ganache.provider({
    logging: {
      quiet: true,
    },

    wallet: {
      totalAccounts: 10,
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

const attacker =
  await provider.getSigner(3);

const secondaryMinter =
  await provider.getSigner(4);

const secondaryAdmin =
  await provider.getSigner(5);

const adminAddress =
  await admin.getAddress();

const minterAddress =
  await minter.getAddress();

const holderAddress =
  await holder.getAddress();

const attackerAddress =
  await attacker.getAddress();

const secondaryMinterAddress =
  await secondaryMinter.getAddress();

const secondaryAdminAddress =
  await secondaryAdmin.getAddress();

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

async function deploy(
  deployAdmin,
  deployMinter,
  deployBaseURI = baseURI,
) {
  const contract =
    await factory.deploy(
      deployAdmin,
      deployMinter,
      deployBaseURI,
    );

  await contract.waitForDeployment();

  return contract;
}

/*
 * Constructor hardening
 */

await mustRevert(
  () =>
    factory.deploy(
      ZeroAddress,
      minterAddress,
      baseURI,
    ),

  "zero admin must revert",
);

await mustRevert(
  () =>
    factory.deploy(
      adminAddress,
      ZeroAddress,
      baseURI,
    ),

  "zero minter must revert",
);

await mustRevert(
  () =>
    factory.deploy(
      adminAddress,
      adminAddress,
      baseURI,
    ),

  "admin=minter must revert",
);

await mustRevert(
  () =>
    factory.deploy(
      adminAddress,
      minterAddress,
      "",
    ),

  "empty baseURI must revert",
);

console.log(
  "CONSTRUCTOR_HARDENING=PASS",
);

const contract =
  await deploy(
    adminAddress,
    minterAddress,
  );

console.log(
  "HARDENING_LOCAL_DEPLOY=PASS",
);

const DEFAULT_ADMIN_ROLE =
  "0x"
  + "00".repeat(32);

const MINTER_ROLE =
  id(
    "MINTER_ROLE",
  );

/*
 * Initial authority separation.
 */

assert.equal(
  await contract.hasRole(
    DEFAULT_ADMIN_ROLE,
    adminAddress,
  ),
  true,
);

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    minterAddress,
  ),
  true,
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
    DEFAULT_ADMIN_ROLE,
    minterAddress,
  ),
  false,
);

console.log(
  "INITIAL_ROLE_SEPARATION=PASS",
);

/*
 * Critical lifetime collision attempts.
 */

await mustRevert(
  () =>
    contract
      .connect(admin)
      .grantRole(
        MINTER_ROLE,
        adminAddress,
      ),

  "admin must not become minter",
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .grantRole(
        DEFAULT_ADMIN_ROLE,
        minterAddress,
      ),

  "minter must not become admin",
);

console.log(
  "ADMIN_TO_MINTER_COLLISION_BLOCKED=YES",
);

console.log(
  "MINTER_TO_ADMIN_COLLISION_BLOCKED=YES",
);

/*
 * Legitimate separated role expansion.
 */

await (
  await contract
    .connect(admin)
    .grantRole(
      MINTER_ROLE,
      secondaryMinterAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    secondaryMinterAddress,
  ),
  true,
);

await (
  await contract
    .connect(admin)
    .grantRole(
      DEFAULT_ADMIN_ROLE,
      secondaryAdminAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    DEFAULT_ADMIN_ROLE,
    secondaryAdminAddress,
  ),
  true,
);

console.log(
  "SEPARATED_ROLE_EXPANSION=PASS",
);

/*
 * Unauthorized role administration.
 */

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .grantRole(
        MINTER_ROLE,
        attackerAddress,
      ),

  "attacker must not grant roles",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .revokeRole(
        MINTER_ROLE,
        minterAddress,
      ),

  "attacker must not revoke roles",
);

console.log(
  "UNAUTHORIZED_ROLE_ADMIN_BLOCKED=YES",
);

/*
 * Revocation.
 */

await (
  await contract
    .connect(admin)
    .revokeRole(
      MINTER_ROLE,
      secondaryMinterAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    secondaryMinterAddress,
  ),
  false,
);

await mustRevert(
  () =>
    contract
      .connect(secondaryMinter)
      .mint(
        holderAddress,
        10,
      ),

  "revoked minter must not mint",
);

console.log(
  "MINTER_REVOCATION=PASS",
);

/*
 * Regrant and self-renounce.
 */

await (
  await contract
    .connect(admin)
    .grantRole(
      MINTER_ROLE,
      secondaryMinterAddress,
    )
).wait();

await (
  await contract
    .connect(secondaryMinter)
    .renounceRole(
      MINTER_ROLE,
      secondaryMinterAddress,
    )
).wait();

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    secondaryMinterAddress,
  ),
  false,
);

console.log(
  "MINTER_RENOUNCE=PASS",
);

/*
 * Mint hardening.
 */

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        ZeroAddress,
        1,
      ),

  "mint to zero must revert",
);

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAddress,
        0,
      ),

  "token zero must revert",
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

await (
  await contract
    .connect(minter)
    .mint(
      holderAddress,
      1,
      {
        gasLimit:
          300_000n,
      },
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

await mustRevert(
  () =>
    contract
      .connect(minter)
      .mint(
        holderAddress,
        1,
      ),

  "duplicate mint must revert",
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "1",
);

console.log(
  "MINT_HARDENING=PASS",
);

console.log(
  "TOTAL_MINTED_ROLLBACK_SAFETY=PASS",
);

/*
 * Boundary token 6000.
 */

await (
  await contract
    .connect(minter)
    .mint(
      holderAddress,
      6000,
      {
        gasLimit:
          300_000n,
      },
    )
).wait();

assert.equal(
  await contract.ownerOf(6000),
  holderAddress,
);

assert.equal(
  (
    await contract.totalMinted()
  ).toString(),
  "2",
);

console.log(
  "TOKEN_6000_BOUNDARY=PASS",
);

/*
 * tokenURI.
 */

assert.equal(
  await contract.tokenURI(1),
  baseURI + "1.json",
);

assert.equal(
  await contract.tokenURI(6000),
  baseURI + "6000.json",
);

await mustRevert(
  () =>
    contract.tokenURI(2),

  "unminted token URI must revert",
);

console.log(
  "TOKEN_URI_HARDENING=PASS",
);

/*
 * Pause administration.
 */

await mustRevert(
  () =>
    contract
      .connect(minter)
      .pause(),

  "minter must not pause",
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

  "mint while paused must revert",
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
  "PAUSE_AUTHORITY_HARDENING=PASS",
);

/*
 * Base URI administration.
 */

await mustRevert(
  () =>
    contract
      .connect(minter)
      .setBaseURI(
        "https://bad.example/",
      ),

  "minter cannot set base URI",
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .setBaseURI(
        "",
      ),

  "empty base URI update must revert",
);

const migratedBaseURI =
  "https://nft.example.invalid/nft/metadata/";

await (
  await contract
    .connect(admin)
    .setBaseURI(
      migratedBaseURI,
    )
).wait();

assert.equal(
  await contract.tokenURI(1),
  migratedBaseURI
    + "1.json",
);

console.log(
  "BASE_URI_ADMIN_HARDENING=PASS",
);

/*
 * Freeze authority.
 */

await mustRevert(
  () =>
    contract
      .connect(minter)
      .freezeBaseURI(),

  "minter cannot freeze URI",
);

await mustRevert(
  () =>
    contract
      .connect(attacker)
      .freezeBaseURI(),

  "attacker cannot freeze URI",
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

  "URI mutation after freeze must revert",
);

await mustRevert(
  () =>
    contract
      .connect(admin)
      .freezeBaseURI(),

  "second freeze must revert",
);

console.log(
  "BASE_URI_FREEZE_HARDENING=PASS",
);

/*
 * Interface support.
 *
 * ERC165 = 0x01ffc9a7
 * ERC721 = 0x80ac58cd
 * AccessControl = 0x7965db0b
 */

assert.equal(
  await contract.supportsInterface(
    "0x01ffc9a7",
  ),
  true,
);

assert.equal(
  await contract.supportsInterface(
    "0x80ac58cd",
  ),
  true,
);

assert.equal(
  await contract.supportsInterface(
    "0x7965db0b",
  ),
  true,
);

assert.equal(
  await contract.supportsInterface(
    "0xffffffff",
  ),
  false,
);

console.log(
  "INTERFACE_SUPPORT=PASS",
);

/*
 * Final authority state.
 */

assert.equal(
  await contract.hasRole(
    MINTER_ROLE,
    adminAddress,
  ),
  false,
);

assert.equal(
  await contract.hasRole(
    DEFAULT_ADMIN_ROLE,
    minterAddress,
  ),
  false,
);

console.log(
  "FINAL_ADMIN_MINTER_SEPARATION=PASS",
);

console.log(
  "OX_NFT_25_CONTRACT_HARDENING_TEST=PASS",
);

console.log(
  "REAL_NETWORK_DEPLOYMENT=NO",
);

console.log(
  "REAL_BLOCKCHAIN_TRANSACTION=NO",
);

await ganacheProvider.disconnect();
