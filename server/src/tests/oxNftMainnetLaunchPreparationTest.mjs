import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AbiCoder } from 'ethers';
import { prepareMainnetDeployment, validateCdpProbeEndpoint, probeCdpPaymaster, MAINNET_LAUNCH_PROFILE as P } from '../../../cloudflare/nftMainnetLaunchPreparation.mjs';

const creation = fs.readFileSync(new URL('../../../blockchain/artifacts/originx-founding-access-v1/OriginXFoundingAccess.creation-bytecode.txt', import.meta.url), 'utf8').trim();
const plan = prepareMainnetDeployment(creation);
assert.deepEqual(plan, prepareMainnetDeployment(creation));
const args = AbiCoder.defaultAbiCoder().decode(['address','address','string'], '0x' + plan.directDeployment.data.slice(creation.length));
assert.deepEqual([...args], [P.admin, P.minter, P.baseURI]);
assert.equal(plan.directDeployment.chainId, '0x2105');
assert.equal(plan.directDeployment.from, P.admin);
assert.equal(plan.directDeployment.value, '0x0');
assert.equal(Object.hasOwn(plan.directDeployment, 'to'), false);
assert.equal(plan.publicSalesReady, false);
assert.equal(plan.funding.deploymentSponsorshipApproved, false);
assert.throws(() => prepareMainnetDeployment(creation.slice(0,-2)+'00'));
assert.throws(() => prepareMainnetDeployment('0x0'));
console.log('PINNED_BYTECODE_AND_EXACT_CONSTRUCTOR=PASS');
console.log('MAINNET_PLAN_NEVER_AUTHORIZES_SALES_OR_SPENDING=PASS');

const endpoint = 'https://api.developer.coinbase.com/rpc/v1/base-sepolia/test_key_123';
const entry = '0x0000000071727de22e5e9d8baf0edac6f37da032';
const calls = [];
function mock(mode = '') {
  return async (url, options) => {
    calls.push(JSON.parse(options.body).method);
    assert.equal(options.redirect, 'error');
    assert.equal(url, endpoint);
    const req = JSON.parse(options.body);
    if (mode === 'leak') throw new Error(endpoint);
    if (mode === 'http') return new Response('private provider error', { status: 403 });
    if (mode === 'large') return new Response('x'.repeat(32769));
    if (mode === 'json') return new Response('not json');
    const result = req.method === 'eth_chainId' ? (mode === 'chain' ? '0x2105' : '0x14a34') : (mode === 'entries' ? [] : [entry]);
    return Response.json({ jsonrpc: '2.0', id: mode === 'id' ? 99 : req.id, ...(mode === 'rpc' ? { error: { message: endpoint } } : { result }) });
  };
}
const result = await probeCdpPaymaster({ endpoint, fetchImpl: mock() });
assert.equal(result.reachable, true);
for (const key of ['creditsVerified','walletCompatibilityVerified','sponsorshipApproved','deploymentSponsorshipApproved','transactionSubmitted','publicSalesReady']) assert.equal(result[key], false);
assert.equal(JSON.stringify(result).includes('test_key'), false);
for (const mode of ['leak','http','large','json','chain','entries','id','rpc']) {
  await assert.rejects(probeCdpPaymaster({ endpoint, fetchImpl: mock(mode) }), /^Error: OX_PAYMASTER_PREFLIGHT_UNAVAILABLE$/);
}
let touched = false;
for (const invalid of [endpoint.replace('https:', 'http:'), endpoint.replace('coinbase.com','coinbase.com.evil.test'), endpoint+'?key=secret', endpoint+'#x', endpoint.replace('/base-sepolia/','/base/'), endpoint.replace('https://','https://user:pass@'), endpoint.replace('.com/', '.com:8443/'), endpoint+'/extra', 'https://127.0.0.1/rpc/v1/base-sepolia/test_key_123', null]) {
  await assert.rejects(probeCdpPaymaster({ endpoint: invalid, fetchImpl: async () => { touched = true; } }));
}
assert.equal(touched, false);
assert.throws(() => validateCdpProbeEndpoint(endpoint, 1));
assert.ok(calls.every(m => ['eth_chainId','eth_supportedEntryPoints'].includes(m)));
console.log('PAYMASTER_NETWORK_AND_RESPONSE_GUARDS=PASS');
console.log('ENDPOINT_CREDENTIALS_REDACTED=PASS');
console.log('UNAPPROVED_URLS_BLOCKED_BEFORE_NETWORK=PASS');
console.log('ONLY_READ_ONLY_RPC_METHODS=PASS');
console.log('CREDITS_AND_DEPLOYMENT_APPROVAL_NEVER_INFERRED=PASS');
console.log('NETWORK_REQUESTS=MOCK_ONLY');
