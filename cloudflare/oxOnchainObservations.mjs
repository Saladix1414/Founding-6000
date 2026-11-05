/*
 * Founding 6000 — READ-ONLY, unprivileged RPC observations.
 * NOT a trusted registry verifier, treasury reconciliation or access gate.
 * The supplied transport MUST be created by trusted server configuration.
 */
import { createHash } from 'node:crypto';

export const EVIDENCE_VERSION = 'OX-ONCHAIN-OBSERVATIONS-2';
export const ETHEREUM_USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const HASH = /^0x[0-9a-f]{64}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const SHA = /^[0-9a-f]{64}$/i;
const ZERO = '0x' + '0'.repeat(40);
const ALLOWED = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call']);
const OWNER_OF = '0x6352211e';
const BALANCE_OF = '0x70a08231';

function fail() { throw new Error('OX_ONCHAIN_OBSERVATION_REJECTED'); }
function address(value) {
  if (typeof value !== 'string' || !ADDRESS.test(value) || value.toLowerCase() === ZERO) fail();
  return value.toLowerCase();
}
function sha(value) {
  if (typeof value !== 'string' || !SHA.test(value)) fail();
  return value.toLowerCase();
}
function hash(value) {
  if (typeof value !== 'string' || !HASH.test(value)) fail();
  return value.toLowerCase();
}
function qty(value) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value)) fail();
  const n = BigInt(value);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) fail();
  return Number(n);
}
function word(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value)) fail();
  return value.slice(2).toLowerCase();
}
function toHexBlock(n) { return '0x' + n.toString(16); }
function digestCode(code) {
  if (typeof code !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(code)) fail();
  return createHash('sha256').update(Uint8Array.from(code.slice(2).match(/../g), byte => parseInt(byte, 16))).digest('hex');
}
async function observe({ rpc, chainId, contract, runtimeSha256, callData, minimumConfirmations = 12 }) {
  if (!rpc || typeof rpc.send !== 'function' || ![1, 8453].includes(chainId) ||
      !Number.isInteger(minimumConfirmations) || minimumConfirmations < 12 || minimumConfirmations > 10000 ||
      typeof callData !== 'string' || !/^0x[0-9a-f]+$/i.test(callData)) fail();
  const addr = address(contract);
  const codeHash = sha(runtimeSha256);
  // Hardcoded allowlist of read-only JSON-RPC method names, never caller-controlled.
  async function read(method, params) {
    if (!ALLOWED.has(method)) fail();
    try { return await rpc.send(method, params); } catch { fail(); }
  }
  if (qty(await read('eth_chainId', [])) !== chainId) fail();
  const tip = qty(await read('eth_blockNumber', []));
  // 'finalized' is a consensus/RPC tag, not an arbitrary count of Base sequencer blocks.
  // Fail closed when provider does not support finalized tags or EIP-1898 block-hash calls.
  const block = await read('eth_getBlockByNumber', ['finalized', false]);
  if (!block || !Number.isSafeInteger(tip) || typeof block.number !== 'string') fail();
  const number = qty(block.number);
  const blockHash = hash(block.hash);
  if (number < 1 || number > tip || tip - number + 1 < minimumConfirmations) fail();
  const pinned = Object.freeze({ blockHash, requireCanonical: true });
  const code = await read('eth_getCode', [addr, pinned]);
  if (digestCode(code) !== codeHash) fail();
  const output = await read('eth_call', [{ to: addr, data: callData }, pinned]);
  const resultWord = word(output);
  // Recheck the same numbered block and chain after reads, rejecting reorgs or provider flips.
  const latestBlockCheck = await read('eth_getBlockByNumber', [toHexBlock(number), false]);
  if (!latestBlockCheck || hash(latestBlockCheck.hash) !== blockHash ||
      qty(latestBlockCheck.number) !== number || qty(await read('eth_chainId', [])) !== chainId) fail();
  return { chainId, contract: addr, runtimeSha256: codeHash, blockNumber: number,
    blockHash, confirmationsObserved: tip - number + 1, resultWord };
}

/**
 * Read confirmed Base ownerOf at a consensus-finalized block of the APPROVED contract.
 * This observation alone is NOT wallet signature verification, mint receipt verification,
 * current-tip ownership, or an authority callback for oxMembershipRegistry.
 */
export async function observeBaseNftOwner({ rpc, contractAddress, expectedRuntimeSha256,
  serialNumber, minimumConfirmations = 12 }) {
  if (!Number.isInteger(serialNumber) || serialNumber < 1 || serialNumber > 6000) fail();
  const result = await observe({ rpc, chainId: 8453, contract: contractAddress,
    runtimeSha256: expectedRuntimeSha256,
    callData: OWNER_OF + BigInt(serialNumber).toString(16).padStart(64, '0'), minimumConfirmations });
  if (!/^0{24}[0-9a-f]{40}$/.test(result.resultWord)) fail();
  const owner = address('0x' + result.resultWord.slice(24));
  const { resultWord: unused, ...confirmed } = result;
  return Object.freeze({ schema: EVIDENCE_VERSION, kind: 'BASE_ERC721_OWNER',
    ...confirmed, serialNumber, owner, source: 'CONFIGURED_RPC_FINALIZED_BLOCK',
    rpcSourceIndependentlyVerified: false, currentTipOwnerVerified: false,
    walletControlVerified: false, registryWriteAuthorized: false, entitlementAuthorized: false });
}

/** Ethereum mainnet USDT balance only; Base redemption asset is NOT assumed. */
export async function observeEthereumUsdtVault({ rpc, vaultAddress, expectedTokenRuntimeSha256,
  minimumConfirmations = 12 }) {
  const vault = address(vaultAddress);
  const result = await observe({ rpc, chainId: 1, contract: ETHEREUM_USDT,
    runtimeSha256: expectedTokenRuntimeSha256,
    callData: BALANCE_OF + vault.slice(2).padStart(64, '0'), minimumConfirmations });
  const balanceMinor = BigInt('0x' + result.resultWord);
  const { resultWord: unused, ...confirmed } = result;
  return Object.freeze({ schema: EVIDENCE_VERSION, kind: 'ETHEREUM_USDT_VAULT_BALANCE',
    ...confirmed, tokenContract: ETHEREUM_USDT, vaultAddress: vault,
    decimalsAssumedByPolicy: 6, observedBalanceMinor: balanceMinor.toString(),
    source: 'CONFIGURED_RPC_FINALIZED_BLOCK', rpcSourceIndependentlyVerified: false,
    vaultControlVerified: false, liabilitiesReconciled: false, reserveDebitAuthorized: false,
    investmentAuthorized: false, redemptionAuthorized: false });
}

/** Ledger coverage comparison only, not legal/financial proof of reserve solvency. */
export function compareEthereumReserveJournal({ observation, journal }) {
  if (observation?.schema !== EVIDENCE_VERSION ||
      observation.kind !== 'ETHEREUM_USDT_VAULT_BALANCE' || observation.chainId !== 1 ||
      observation.tokenContract !== ETHEREUM_USDT ||
      typeof observation.observedBalanceMinor !== 'string' ||
      !/^(?:0|[1-9][0-9]*)$/.test(observation.observedBalanceMinor) ||
      !journal || !Number.isSafeInteger(journal.liquidEthereumMinor) || journal.liquidEthereumMinor < 0) fail();
  const observed = BigInt(observation.observedBalanceMinor);
  const ledger = BigInt(journal.liquidEthereumMinor);
  return Object.freeze({ schema: EVIDENCE_VERSION, network: 'ethereum-mainnet',
    observedBalanceMinor: observed.toString(), journalLiquidMinor: ledger.toString(),
    coverageDifferenceMinor: (observed - ledger).toString(),
    observedBalanceCoversJournal: observed >= ledger,
    reserveSolvencyCertified: false, custodyOwnerCertified: false, baseLiquidityCertified: false,
    payoutsAuthorized: false });
}
