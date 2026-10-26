import {
  Interface,
  getAddress,
  id,
  ZeroAddress,
} from "ethers";

import {
  verifyNftMintReceiptEvidence,
} from "./nftMintReceiptEvidence.mjs";

/*
 * OriginX — Base Sepolia RPC Evidence Adapter.
 *
 * READ ONLY. Transport supplied by trusted caller.
 *
 * NO HTTP endpoint, signer, keys or DB writes.
 * Never authorizes mint, SUBMITTED, CONFIRMED
 * or membership activation.
 *
 * RPC responses are not cryptographic proofs.
 * Use an independently configured trusted RPC.
 */

const CHAIN_ID = 84532;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const HEX = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

const ABI = new Interface([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
]);

const MINTER_ROLE = id("MINTER_ROLE");

function deny() {
  throw new Error("NFT_MINT_RPC_EVIDENCE_UNAVAILABLE");
}

function address(value) {
  try {
    if (typeof value !== "string") deny();
    return getAddress(value);
  } catch {
    deny();
  }
}

function quantity(value) {
  if (
    typeof value !== "string" ||
    !HEX.test(value)
  ) {
    deny();
  }

  const n = Number(BigInt(value));

  if (!Number.isSafeInteger(n) || n < 0) {
    deny();
  }

  return n;
}

function sameHash(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    HASH.test(a) &&
    HASH.test(b) &&
    a.toLowerCase() === b.toLowerCase()
  );
}

function blockTag(number) {
  return "0x" + number.toString(16);
}

/*
 * The transport interface is intentionally
 * narrow: send(method, params).
 *
 * No supplied transport can be deemed trusted
 * merely because it implements this interface.
 */
export async function verifyBaseSepoliaMintRpcEvidence({
  rpc,
  contractAddress,
  transactionHash,
  recipient,
  tokenId,
  minConfirmations = 3,
}) {
  if (
    !rpc ||
    typeof rpc.send !== "function" ||
    typeof transactionHash !== "string" ||
    !HASH.test(transactionHash) ||
    !Number.isSafeInteger(tokenId) ||
    tokenId < 1 ||
    tokenId > 6000 ||
    !Number.isSafeInteger(minConfirmations) ||
    minConfirmations < 1 ||
    minConfirmations > 100
  ) {
    deny();
  }

  const contract = address(contractAddress);
  const wallet = address(recipient);

  if (
    contract === ZeroAddress ||
    wallet === ZeroAddress
  ) {
    deny();
  }

  /*
   * Explicit allowlist of read-only JSON-RPC
   * methods. No signing, publishing or sending.
   */
  const allowed = new Set([
    "eth_chainId",
    "eth_getTransactionByHash",
    "eth_getTransactionReceipt",
    "eth_blockNumber",
    "eth_getBlockByNumber",
    "eth_getCode",
    "eth_call",
  ]);

  async function read(method, params) {
    if (!allowed.has(method)) deny();

    try {
      return await rpc.send(method, params);
    } catch {
      deny();
    }
  }

  if (quantity(await read("eth_chainId", [])) !== CHAIN_ID) {
    deny();
  }

  const tx = await read(
    "eth_getTransactionByHash",
    [transactionHash],
  );

  const receipt = await read(
    "eth_getTransactionReceipt",
    [transactionHash],
  );

  if (
    !tx ||
    !receipt ||
    !sameHash(tx.hash, transactionHash) ||
    !sameHash(receipt.transactionHash, transactionHash) ||
    !sameHash(tx.blockHash, receipt.blockHash) ||
    tx.blockNumber == null ||
    receipt.blockNumber == null ||
    quantity(tx.blockNumber) !==
      quantity(receipt.blockNumber) ||
    address(tx.to) !== contract ||
    address(receipt.to) !== contract ||
    address(tx.from) !== address(receipt.from)
  ) {
    deny();
  }

  const txChain = quantity(tx.chainId);
  const height = quantity(receipt.blockNumber);
  const latest = quantity(
    await read("eth_blockNumber", []),
  );

  if (
    txChain !== CHAIN_ID ||
    height > latest ||
    latest - height + 1 < minConfirmations
  ) {
    deny();
  }

  const tag = blockTag(height);

  const block = await read(
    "eth_getBlockByNumber",
    [tag, false],
  );

  if (
    !block ||
    quantity(block.number) !== height ||
    !sameHash(block.hash, receipt.blockHash)
  ) {
    deny();
  }

  /*
   * EIP-1898 block-hash tags: contract reads
   * cannot silently use a later block.
   *
   * Some RPC providers may not support this;
   * failure must be closed, never downgraded
   * to a 'latest' call.
   */
  const pinned = {
    blockHash: receipt.blockHash,
    requireCanonical: true,
  };

  const code = await read(
    "eth_getCode",
    [contract, pinned],
  );

  if (
    typeof code !== "string" ||
    !/^0x(?:[0-9a-fA-F]{2})+$/.test(code) ||
    code === "0x"
  ) {
    deny();
  }

  async function contractCall(data) {
    const result = await read(
      "eth_call",
      [{ to: contract, data }, pinned],
    );

    if (
      typeof result !== "string" ||
      !/^0x[0-9a-fA-F]*$/.test(result)
    ) {
      deny();
    }

    return result;
  }

  let owner;
  let authorizedMinter;

  try {
    const ownerResult = await contractCall(
      ABI.encodeFunctionData(
        "ownerOf",
        [BigInt(tokenId)],
      ),
    );

    owner = ABI.decodeFunctionResult(
      "ownerOf",
      ownerResult,
    )[0];

    const roleResult = await contractCall(
      ABI.encodeFunctionData(
        "hasRole",
        [MINTER_ROLE, address(tx.from)],
      ),
    );

    authorizedMinter = ABI.decodeFunctionResult(
      "hasRole",
      roleResult,
    )[0];
  } catch {
    deny();
  }

  if (
    address(owner) !== wallet ||
    authorizedMinter !== true
  ) {
    deny();
  }

  /*
   * Recheck canonical block after contract calls
   * to catch a reorganization during the reads.
   */
  const after = await read(
    "eth_getBlockByNumber",
    [tag, false],
  );

  if (
    !after ||
    !sameHash(after.hash, receipt.blockHash)
  ) {
    deny();
  }

  const offline = verifyNftMintReceiptEvidence({
    chainId: CHAIN_ID,
    contractAddress: contract,
    recipient: wallet,
    tokenId,
    transaction: {
      hash: tx.hash,
      to: tx.to,
      chainId: txChain,
      data: tx.input,
      value: BigInt(tx.value ?? "0x0"),
    },
    receipt: {
      transactionHash: receipt.transactionHash,
      to: receipt.to,
      status: quantity(receipt.status),
      blockNumber: height,
      logs: receipt.logs,
    },
    ownerAddress: owner,
    latestBlockNumber: latest,
    minConfirmations,
  });

  if (
    offline.evidenceConsistent !== true ||
    offline.mintAuthority !== false ||
    offline.entitlementActivated !== false
  ) {
    deny();
  }

  return Object.freeze({
    ...offline,
    rpcChecksPassed: true,
    rpcSourceIndependentlyVerified: false,
    canonicalBlockHash: receipt.blockHash.toLowerCase(),
    minterRoleAtReceiptBlock: true,
    ownerAtReceiptBlock: wallet,
    status: "RPC_EVIDENCE_CONSISTENT",
    mintAuthority: false,
    transactionSubmitted: false,
    entitlementActivated: false,
  });
}
