import { createHash } from 'node:crypto';
import { AbiCoder, getAddress } from 'ethers';

// Operator preparation only. No Worker route imports this module.
export const MAINNET_LAUNCH_PROFILE = Object.freeze({
  chainId: 8453,
  admin: getAddress('0x001911220a9ce3b4063ccaece36863428a27c24e'),
  minter: getAddress('0x4d0efb268b6dddff3c043f3d8c0f6410447e1f2f'),
  baseURI: 'https://founding-6000-prelaunch.digitalboostlaunch.workers.dev/nft/metadata/',
  creationSha256: '2615678e553cd50f767a130e797d8d4cb326e132757bd135867c1286a9513119',
  runtimeSha256: '9ed5125194af51175a650209fe49221c6e176e2e33b03af56765eb37569e3d9c',
});

export function prepareMainnetDeployment(creationBytecode) {
  if (typeof creationBytecode !== 'string' || !/^0x(?:[a-fA-F0-9]{2})+$/.test(creationBytecode)) {
    throw new Error('OX_LAUNCH_INVALID_BYTECODE');
  }
  const actual = createHash('sha256').update(Buffer.from(creationBytecode.slice(2), 'hex')).digest('hex');
  if (actual !== MAINNET_LAUNCH_PROFILE.creationSha256) throw new Error('OX_LAUNCH_ARTIFACT_MISMATCH');
  const p = MAINNET_LAUNCH_PROFILE;
  const args = AbiCoder.defaultAbiCoder().encode(['address', 'address', 'string'], [p.admin, p.minter, p.baseURI]);
  const data = creationBytecode.toLowerCase() + args.slice(2);
  return {
    schema: 'OX-MAINNET-LAUNCH-PREPARATION-1',
    profile: p,
    // Direct CREATE payload for review; NOT an ERC-4337 userOperation.
    directDeployment: { chainId: '0x2105', from: p.admin, value: '0x0', data },
    initCodeSha256: createHash('sha256').update(Buffer.from(data.slice(2), 'hex')).digest('hex'),
    funding: {
      provider: 'coinbase-cdp', creditsStatus: 'UNVERIFIED',
      sponsorshipApproved: false, deploymentSponsorshipApproved: false,
      walletCompatibilityVerified: false, providerBudgetVerified: false,
    },
    pending: [
      'CONFIRM_PROVIDER_CREDITS_AND_SPENDING_POLICY',
      'VERIFY_SMART_ACCOUNT_COMPATIBILITY_WITH_CURRENT_WALLETS',
      'SELECT_AND_TEST_SPONSORED_DEPLOYMENT_EXECUTION_PATH',
      'DEPLOY_AND_VERIFY_MAINNET_RUNTIME_AND_ROLES',
      'COMPLETE_PAID_ORDER_TO_SPONSORED_MINT_INTEGRATION',
      'VERIFY_RECEIPT_AND_ATOMIC_ORDER_FULFILLMENT',
      'APPROVE_AND_ENABLE_RARE_RELEASE',
    ],
    publicSalesReady: false, transactionSubmitted: false, membershipActivated: false,
  };
}

const fail = () => { throw new Error('OX_PAYMASTER_PREFLIGHT_UNAVAILABLE'); };

export function validateCdpProbeEndpoint(endpoint, chainId) {
  try {
    if (typeof endpoint !== 'string' || endpoint.length > 1024 || ![8453, 84532].includes(chainId)) fail();
    const url = new URL(endpoint);
    const network = chainId === 8453 ? 'base' : 'base-sepolia';
    if (url.protocol !== 'https:' || url.hostname !== 'api.developer.coinbase.com' ||
        url.username || url.password || url.port || url.search || url.hash ||
        !new RegExp(`^/rpc/v1/${network}/[A-Za-z0-9_-]{8,256}$`).test(url.pathname) ||
        endpoint !== url.href) fail();
    return url.href;
  } catch { fail(); }
}

// Fixed, read-only methods only. No sponsorship request, signing or submission.
export async function probeCdpPaymaster({ endpoint, chainId = 84532, fetchImpl = globalThis.fetch } = {}) {
  const url = validateCdpProbeEndpoint(endpoint, chainId);
  if (typeof fetchImpl !== 'function') fail();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  async function rpc(method, id) {
    const response = await fetchImpl(url, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'OriginX-Paymaster-ReadOnly/1.0' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params: [] }),
    });
    if (!response.ok || !response.body) fail();
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) { await reader.cancel(); fail(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!result || result.jsonrpc !== '2.0' || result.id !== id ||
        Object.hasOwn(result, 'error') || !Object.hasOwn(result, 'result')) fail();
    return result.result;
  }
  try {
    const observedChain = await rpc('eth_chainId', 1);
    if (typeof observedChain !== 'string' || !/^0x[0-9a-f]+$/i.test(observedChain) || BigInt(observedChain) !== BigInt(chainId)) fail();
    const entries = await rpc('eth_supportedEntryPoints', 2);
    if (!Array.isArray(entries) || !entries.length || entries.length > 16 ||
        entries.some(a => typeof a !== 'string' || !/^0x[0-9a-f]{40}$/i.test(a) || /^0x0{40}$/i.test(a))) fail();
    return {
      schema: 'OX-PAYMASTER-CONNECTIVITY-1', chainId,
      reachable: true, entryPoints: [...new Set(entries.map(a => a.toLowerCase()))],
      creditsVerified: false, walletCompatibilityVerified: false,
      sponsorshipApproved: false, deploymentSponsorshipApproved: false,
      transactionSubmitted: false, publicSalesReady: false,
    };
  } catch { fail(); } finally { clearTimeout(timer); }
}
