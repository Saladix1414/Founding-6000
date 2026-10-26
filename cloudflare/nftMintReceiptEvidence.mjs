import {
  Interface,
  getAddress,
  ZeroAddress,
} from "ethers";

/*
 * OriginX — Receipt Evidence V1
 *
 * OFFLINE VALIDATOR ONLY.
 *
 * Caller-provided evidence is untrusted.
 * No RPC, signer, database write or approval.
 * Does not authorize or confirm an NFT mint.
 */

const ABI = new Interface([
  "function mint(address to,uint256 tokenId)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);

const CHAIN_ID = 84532;
const HASH = /^0x[0-9a-fA-F]{64}$/;

function deny() {
  throw new Error(
    "NFT_MINT_RECEIPT_EVIDENCE_UNAVAILABLE"
  );
}

function checkedAddress(value) {
  try {
    if (typeof value !== "string") deny();
    return getAddress(value);
  } catch {
    deny();
  }
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function verifyNftMintReceiptEvidence(input) {
  const {
    chainId,
    contractAddress,
    recipient,
    tokenId,
    transaction,
    receipt,
    ownerAddress,
    latestBlockNumber,
    minConfirmations = 3,
  } = input ?? {};

  if (
    chainId !== CHAIN_ID ||
    !integer(tokenId) ||
    tokenId < 1 ||
    tokenId > 6000 ||
    !integer(latestBlockNumber) ||
    !integer(minConfirmations) ||
    minConfirmations < 1 ||
    minConfirmations > 100 ||
    !transaction ||
    !receipt ||
    !Array.isArray(receipt.logs)
  ) {
    deny();
  }

  const contract = checkedAddress(contractAddress);
  const wallet = checkedAddress(recipient);

  if (
    contract === ZeroAddress ||
    wallet === ZeroAddress ||
    checkedAddress(ownerAddress) !== wallet ||
    checkedAddress(transaction.to) !== contract ||
    checkedAddress(receipt.to) !== contract ||
    transaction.chainId !== CHAIN_ID ||
    typeof transaction.hash !== "string" ||
    !HASH.test(transaction.hash) ||
    typeof receipt.transactionHash !== "string" ||
    transaction.hash.toLowerCase() !==
      receipt.transactionHash.toLowerCase() ||
    !integer(receipt.blockNumber) ||
    receipt.blockNumber > latestBlockNumber ||
    !(receipt.status === 1 || receipt.status === 1n)
  ) {
    deny();
  }

  const confirmations =
    latestBlockNumber - receipt.blockNumber + 1;

  if (confirmations < minConfirmations) {
    deny();
  }

  let call;

  try {
    call = ABI.parseTransaction({
      data: transaction.data,
      value: transaction.value ?? 0n,
    });
  } catch {
    deny();
  }

  if (
    !call ||
    call.name !== "mint" ||
    call.args[0] !== wallet ||
    call.args[1] !== BigInt(tokenId) ||
    BigInt(transaction.value ?? 0) !== 0n
  ) {
    deny();
  }

  let transfers = 0;
  let mints = 0;

  for (const log of receipt.logs) {
    if (
      !log ||
      typeof log.address !== "string" ||
      checkedAddress(log.address) !== contract
    ) {
      continue;
    }

    let event;

    try {
      event = ABI.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      deny();
    }

    if (!event || event.name !== "Transfer") {
      continue;
    }

    if (event.args[2] !== BigInt(tokenId)) {
      continue;
    }

    transfers++;

    if (
      event.args[0] === ZeroAddress &&
      event.args[1] === wallet
    ) {
      mints++;
    }
  }

  if (transfers !== 1 || mints !== 1) {
    deny();
  }

  return Object.freeze({
    evidenceConsistent: true,
    independentlyAuthenticated: false,
    chainId: CHAIN_ID,
    contractAddress: contract,
    tokenId,
    recipient: wallet,
    transactionHash:
      transaction.hash.toLowerCase(),
    blockNumber: receipt.blockNumber,
    confirmations,
    status: "EVIDENCE_CONSISTENT_ONLY",
    mintAuthority: false,
    transactionSubmitted: false,
    entitlementActivated: false,
  });
}
