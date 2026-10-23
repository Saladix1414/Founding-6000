import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { id } from "ethers";

const sourcePath =
  "blockchain/contracts/OriginXFoundingAccess.sol";

const sourceUnit = "OriginXFoundingAccess.sol";
const contractName = "OriginXFoundingAccess";
const artifactDir =
  "blockchain/artifacts/originx-founding-access-v1";

const source = fs.readFileSync(sourcePath, "utf8");

const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const settings = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: "shanghai",
  outputSelection: {
    "*": {
      "*": [
        "abi",
        "evm.bytecode.object",
        "evm.deployedBytecode.object",
      ],
    },
  },
};

const input = {
  language: "Solidity",
  sources: {
    [sourceUnit]: { content: source },
  },
  settings,
};

function compileOnce() {
  const imports = new Map();

  const findImports = (importPath) => {
    for (const candidate of [
      importPath,
      path.join("node_modules", importPath),
    ]) {
      if (fs.existsSync(candidate)) {
        const contents = fs.readFileSync(candidate, "utf8");

        imports.set(importPath, {
          path: candidate,
          sha256: sha256(Buffer.from(contents)),
        });

        return { contents };
      }
    }

    return { error: `IMPORT_NOT_FOUND:${importPath}` };
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import: findImports,
    }),
  );

  const errors = (output.errors ?? []).filter(
    (entry) => entry.severity === "error",
  );

  assert.equal(
    errors.length,
    0,
    errors.map((e) => e.formattedMessage).join("\n"),
  );

  const result = output.contracts?.[sourceUnit]?.[contractName];
  assert.ok(result, "CONTRACT_NOT_FOUND");

  return {
    abi: result.abi,
    creation: result.evm.bytecode.object,
    runtime: result.evm.deployedBytecode.object,
    imports: [...imports.entries()].sort(
      ([a], [b]) => a.localeCompare(b),
    ),
  };
}

const first = compileOnce();
const second = compileOnce();

assert.deepEqual(first, second, "DOUBLE_COMPILATION_MISMATCH");

assert.equal(
  sha256(Buffer.from(source)),
  "01d56df7ee7a82431022d37feea86af4e75676540b170f72450dc606e711fee0",
  "SOURCE_HASH_MISMATCH",
);

assert.match(source, /MAX_SUPPLY\s*=\s*6000\s*;/);

const functions = new Set(
  first.abi
    .filter((item) => item.type === "function")
    .map((item) => item.name),
);

for (const name of [
  "mint",
  "MINTER_ROLE",
  "MAX_SUPPLY",
  "pause",
  "unpause",
  "freezeBaseURI",
  "baseURIFrozen",
  "tokenURI",
  "supportsInterface",
]) {
  assert.ok(functions.has(name), `MISSING_ABI:${name}`);
}

assert.ok(!functions.has("burn"), "BURN_UNAPPROVED");
assert.ok(!functions.has("royaltyInfo"), "ROYALTIES_UNAPPROVED");

for (const bytecode of [first.creation, first.runtime]) {
  assert.match(bytecode, /^(?:[0-9a-fA-F]{2})+$/);
}

const ozVersion = JSON.parse(
  fs.readFileSync(
    "node_modules/@openzeppelin/contracts/package.json",
    "utf8",
  ),
).version;

assert.equal(ozVersion, "5.0.2", "OPENZEPPELIN_VERSION_DRIFT");
assert.match(solc.version(), /^0\.8\.38\+/);

const abiText = JSON.stringify(first.abi, null, 2) + "\n";
const creationText = "0x" + first.creation + "\n";
const runtimeText = "0x" + first.runtime + "\n";

const hashes = {
  sourceSha256: sha256(Buffer.from(source)),
  compilerInputSha256: sha256(Buffer.from(JSON.stringify(input))),
  abiFileSha256: sha256(Buffer.from(abiText)),
  creationBytecodeSha256: sha256(
    Buffer.from(first.creation, "hex"),
  ),
  runtimeBytecodeSha256: sha256(
    Buffer.from(first.runtime, "hex"),
  ),
};

const manifest = {
  schema: "OX-NFT-CONTRACT-ARTIFACT-1",
  contract: {
    name: contractName,
    version: "1",
    sourcePath,
    sourceUnit,
    tokenName: "OriginX Founding 6000",
    symbol: "OXF6000",
  },
  compiler: {
    version: solc.version(),
    settings,
  },
  dependencies: {
    openzeppelinContracts: ozVersion,
    imports: first.imports,
  },
  hashes,
  hashConventions: {
    source: "SHA256 of source file bytes",
    abi: "SHA256 of emitted JSON file bytes",
    bytecode: "SHA256 of decoded hexadecimal bytes",
  },
  bytecodeSizes: {
    creationBytes: first.creation.length / 2,
    runtimeBytes: first.runtime.length / 2,
  },
  parameters: {
    maxSupply: 6000,
    tokenIdMin: 1,
    tokenIdMax: 6000,
    minterRole: id("MINTER_ROLE"),
    defaultAdminRole: "0x" + "0".repeat(64),
    constructorInputs:
      first.abi.find((item) => item.type === "constructor")?.inputs ?? [],
  },
  declaredFeatures: {
    erc721: true,
    accessControl: true,
    pausable: true,
    authorityCollisionGuard: true,
    pauseBlocksMintAndTransfer: true,
    metadataSuffix: ".json",
    baseUriFreezeIrreversible: true,
    burnImplemented: false,
    erc2981Implemented: false,
  },
  authorization: {
    deploymentApproved: false,
    mintApproved: false,
    mainnetApproved: false,
    artifactDoesNotGrantAuthority: true,
  },
  verification: {
    compilationCount: 2,
    outputsIdentical: true,
    networkDeploymentPerformed: false,
    realFundsMoved: false,
  },
};

const files = new Map([
  ["OriginXFoundingAccess.abi.json", abiText],
  ["OriginXFoundingAccess.creation-bytecode.txt", creationText],
  ["OriginXFoundingAccess.runtime-bytecode.txt", runtimeText],
  ["manifest.json", JSON.stringify(manifest, null, 2) + "\n"],
]);

for (const [filename, expected] of files) {
  const destination = path.join(artifactDir, filename);

  if (
    fs.existsSync(destination) &&
    fs.readFileSync(destination, "utf8") !== expected
  ) {
    throw new Error(`ARTIFACT_COLLISION:${destination}`);
  }
}

fs.mkdirSync(artifactDir, { recursive: true });

for (const [filename, contents] of files) {
  const destination = path.join(artifactDir, filename);

  if (!fs.existsSync(destination)) {
    fs.writeFileSync(destination, contents, { flag: "wx" });
  }
}

console.log("OX_NFT_25_PART6_DOUBLE_COMPILE=PASS");
console.log(`SOURCE_SHA256=${hashes.sourceSha256}`);
console.log(`ABI_SHA256=${hashes.abiFileSha256}`);
console.log(`CREATION_BYTECODE_SHA256=${hashes.creationBytecodeSha256}`);
console.log(`RUNTIME_BYTECODE_SHA256=${hashes.runtimeBytecodeSha256}`);
console.log("NO_NETWORK_DEPLOYMENT=YES");
