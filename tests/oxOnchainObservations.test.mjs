import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { observeBaseNftOwner, observeEthereumUsdtVault, compareEthereumReserveJournal } from '../cloudflare/oxOnchainObservations.mjs';
const contract = '0x' + 'a'.repeat(40);
const owner = '0x' + 'b'.repeat(40);
const vault = '0x' + 'c'.repeat(40);
const code = '0x60006000';
const runtimeSha256 = createHash('sha256').update(Buffer.from(code.slice(2), 'hex')).digest('hex');
const blockHash = '0x' + 'd'.repeat(64);
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
const walletWord = '0x' + owner.slice(2).padStart(64, '0');
const pinned = { blockHash, requireCanonical: true };
function mockRpc({ chainId=8453, blockNumber=99, tip=150, output=walletWord,
  codeValue=code, reorg=false, unsupportedFinalized=false, rpcError=false }={}) {
  const calls=[];
  const rpc={ async send(method, params) {
    calls.push({method,params});
    if (rpcError) throw Error('network error');
    switch(method) {
      case 'eth_chainId': return '0x'+chainId.toString(16);
      case 'eth_blockNumber': return '0x'+tip.toString(16);
      case 'eth_getBlockByNumber':
        if (params[0] === 'finalized' && unsupportedFinalized) throw Error('unsupported');
        return { number: '0x'+blockNumber.toString(16), hash: reorg && params[0] !== 'finalized' ? '0x'+'e'.repeat(64) : blockHash };
      case 'eth_getCode':
        assert.deepEqual(params, [params[0],pinned]);
        return codeValue;
      case 'eth_call':
        assert.equal(params[1].blockHash, blockHash);
        assert.equal(params[1].requireCanonical, true);
        return output;
      default: throw Error('nonallowlisted method requested');
    }
  }};
  return { rpc,calls };
}
const ownerParams = rpc => ({ rpc, contractAddress:contract, expectedRuntimeSha256:runtimeSha256, serialNumber:1 });
test('Base owner snapshot: pinned finalized block, code pin, no privilege', async()=>{
  const {rpc,calls}=mockRpc();
  const x=await observeBaseNftOwner(ownerParams(rpc));
  assert.equal(x.owner,owner); assert.equal(x.chainId,8453); assert.equal(x.blockNumber,99);
  assert.equal(x.registryWriteAuthorized,false);assert.equal(x.currentTipOwnerVerified,false);
  assert.deepEqual(calls.map(x=>x.method),['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_call','eth_getBlockByNumber','eth_chainId']);
  assert.equal(calls[4].params[0].data, '0x6352211e'+ '1'.padStart(64,'0'));
});
test('rejects wrong chain, wrong runtime, removed token, stale finality, reorg',async()=>{
  for(const x of [
    () => observeBaseNftOwner(ownerParams(mockRpc({chainId:1}).rpc)),
    () => observeBaseNftOwner({...ownerParams(mockRpc().rpc),expectedRuntimeSha256:'f'.repeat(64)}),
    () => observeBaseNftOwner(ownerParams(mockRpc({output:word(0)}).rpc)),
    () => observeBaseNftOwner(ownerParams(mockRpc({tip:102}).rpc)),
    () => observeBaseNftOwner(ownerParams(mockRpc({reorg:true}).rpc)),
    () => observeBaseNftOwner(ownerParams(mockRpc({unsupportedFinalized:true}).rpc)),
    () => observeBaseNftOwner(ownerParams(mockRpc({rpcError:true}).rpc)),
    () => observeBaseNftOwner({...ownerParams(mockRpc().rpc),serialNumber:6001}),
  ]) await assert.rejects(x,/OX_ONCHAIN_OBSERVATION_REJECTED/);
});
test('Ethereum USDT observation is read-only and yields exact balance in minor units',async()=>{
  const {rpc,calls}=mockRpc({chainId:1,output:word(12345678n)});
  const x=await observeEthereumUsdtVault({rpc,vaultAddress:vault,expectedTokenRuntimeSha256:runtimeSha256});
  assert.equal(x.observedBalanceMinor,'12345678');
  assert.equal(x.reserveDebitAuthorized,false);
  assert.equal(calls[4].params[0].to,'0xdac17f958d2ee523a2206206994597c13d831ec7');
  assert.equal(calls[4].params[0].data,'0x70a08231'+vault.slice(2).padStart(64,'0'));
});
test('comparator does not conflate observed liquidity with solvency or Base availability',async()=>{
  const {rpc}=mockRpc({chainId:1,output:word(3000000)});
  const x=await observeEthereumUsdtVault({rpc,vaultAddress:vault,expectedTokenRuntimeSha256:runtimeSha256});
  const covered=compareEthereumReserveJournal({observation:x,journal:{liquidEthereumMinor:2000000}});
  assert.equal(covered.coverageDifferenceMinor,'1000000');
  assert.equal(covered.observedBalanceCoversJournal,true);
  assert.equal(covered.reserveSolvencyCertified,false);
  assert.equal(covered.baseLiquidityCertified,false);
  assert.equal(compareEthereumReserveJournal({observation:x,journal:{liquidEthereumMinor:4000000}}).observedBalanceCoversJournal,false);
});
test('rejects untrusted malformed observations and invalid runtime code',async()=>{
  await assert.rejects(()=>observeEthereumUsdtVault({rpc:mockRpc({chainId:8453}).rpc,vaultAddress:vault,expectedTokenRuntimeSha256:runtimeSha256}),/REJECTED/);
  await assert.rejects(()=>observeEthereumUsdtVault({rpc:mockRpc({chainId:1,codeValue:'0x'}).rpc,vaultAddress:vault,expectedTokenRuntimeSha256:runtimeSha256}),/REJECTED/);
  assert.throws(()=>compareEthereumReserveJournal({observation:{observedBalanceMinor:'100'},journal:{liquidEthereumMinor:5}}),/REJECTED/);
  assert.throws(()=>compareEthereumReserveJournal({observation:{schema:'OX-ONCHAIN-OBSERVATIONS-2',kind:'ETHEREUM_USDT_VAULT_BALANCE',chainId:1,tokenContract:'0xdac17f958d2ee523a2206206994597c13d831ec7',observedBalanceMinor:'100'},journal:{liquidEthereumMinor:-5}}),/REJECTED/);
});
