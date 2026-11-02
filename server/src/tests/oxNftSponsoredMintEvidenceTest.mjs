import assert from 'node:assert/strict';
import { Interface, ZeroAddress, sha256 } from 'ethers';
import {
  verifyBaseSepoliaMintRpcEvidence,
  verifyBaseSepoliaSponsoredMintRpcEvidence,
} from '../../../cloudflare/nftMintRpcEvidenceAdapter.mjs';

// Local fixtures only. These tests never access a network or submit a transaction.
const abi = new Interface([
  'function ownerOf(uint256) view returns(address)',
  'function hasRole(bytes32,address) view returns(bool)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
]);
const contract='0x1111111111111111111111111111111111111111';
const wallet='0x2222222222222222222222222222222222222222';
const minter='0x3333333333333333333333333333333333333333';
const bundler='0x4444444444444444444444444444444444444444';
const entrypoint='0x5555555555555555555555555555555555555555';
const hash='0x'+'a'.repeat(64), blockHash='0x'+'b'.repeat(64);
const code='0x60006000';
const event=abi.encodeEventLog('Transfer',[ZeroAddress,wallet,2n]);
function fixture() {
  const tx={hash,blockHash,blockNumber:'0x64',chainId:'0x14a34',
    from:bundler,to:entrypoint,input:'0x12345678',value:'0x0'};
  const receipt={transactionHash:hash,blockHash,blockNumber:'0x64',
    from:bundler,to:entrypoint,status:'0x1',logs:[
      {address:contract,topics:event.topics,data:event.data}
    ]};
  return {tx,receipt,chain:'0x14a34',latest:'0x66',code,
    owner:wallet,role:true,reorg:false};
}
function rpcFor(state) {
  let blocks=0;
  const pinned={blockHash,requireCanonical:true};
  return { async send(method,params) {
    switch(method) {
      case 'eth_chainId':return state.chain;
      case 'eth_getTransactionByHash':return state.tx;
      case 'eth_getTransactionReceipt':return state.receipt;
      case 'eth_blockNumber':return state.latest;
      case 'eth_getBlockByNumber':
        assert.equal(params[0],'0x64');
        return {number:'0x64',hash:state.reorg&&++blocks>1?'0x'+'c'.repeat(64):blockHash};
      case 'eth_getCode':assert.deepEqual(params,[contract,pinned]);return state.code;
      case 'eth_call': {
        assert.deepEqual(params[1],pinned);
        assert.equal(params[0].to,contract);
        const parsed=abi.parseTransaction({data:params[0].data});
        if(parsed.name==='ownerOf') {
          assert.equal(parsed.args[0],2n);
          return abi.encodeFunctionResult('ownerOf',[state.owner]);
        }
        assert.equal(parsed.name,'hasRole');
        assert.equal(parsed.args[1].toLowerCase(),minter);
        return abi.encodeFunctionResult('hasRole',[state.role]);
      }
      default:throw Error('FORBIDDEN_RPC_METHOD:'+method);
    }
  }};
}
function input(state=fixture()) {
  return {rpc:rpcFor(state),contractAddress:contract,transactionHash:hash,
    recipient:wallet,tokenId:2,expectedMinter:minter,
    expectedRuntimeSha256:sha256(code).slice(2)};
}
const result=await verifyBaseSepoliaSponsoredMintRpcEvidence(input());
assert.equal(result.rpcChecksPassed,true);
assert.equal(result.executionEvidence,'CONTRACT_EVENT');
assert.equal(result.runtimeSha256Verified,true);
assert.equal(result.minterRoleAtReceiptBlock,null);
assert.equal(result.configuredMinterRoleAtReceiptBlock,true);
assert.equal(result.internalCallerIdentified,false);
assert.equal(result.mintAuthority,false);
assert.equal(result.entitlementActivated,false);
assert.equal(result.transactionSubmitted,false);
assert.equal(result.outerTransactionFrom.toLowerCase(),bundler);
console.log('SPONSORED_EVENT_OWNER_AND_PINNED_CODE=PASS');
await assert.rejects(()=>verifyBaseSepoliaMintRpcEvidence(input()));
console.log('DIRECT_CALL_POLICY_PRESERVED=PASS');
const faults={
  WRONG_CHAIN:s=>s.chain='0x2105',
  FAILED_RECEIPT:s=>s.receipt.status='0x0',
  WRONG_TRANSACTION:s=>s.receipt.transactionHash='0x'+'d'.repeat(64),
  RECEIPT_BLOCK_MISMATCH:s=>s.receipt.blockHash='0x'+'d'.repeat(64),
  OUTER_DESTINATION_MISMATCH:s=>s.receipt.to=contract,
  OUTER_SENDER_MISMATCH:s=>s.receipt.from=minter,
  RUNTIME_MISMATCH:s=>s.code='0x60016000',
  WRONG_OWNER:s=>s.owner=minter,
  CONFIGURED_MINTER_ROLE_MISSING:s=>s.role=false,
  INSUFFICIENT_CONFIRMATIONS:s=>s.latest='0x64',
  REORGANIZATION:s=>s.reorg=true,
  NO_MINT_EVENT:s=>s.receipt.logs=[],
  WRONG_EVENT_CONTRACT:s=>s.receipt.logs[0].address=entrypoint,
  DUPLICATE_EVENT:s=>s.receipt.logs.push({...s.receipt.logs[0]}),
  REMOVED_EVENT:s=>s.receipt.logs[0].removed=true,
  WRONG_TOKEN:s=>s.receipt.logs[0].topics=[...event.topics.slice(0,3),'0x'+(3n).toString(16).padStart(64,'0')],
  WRONG_RECIPIENT:s=>s.receipt.logs[0].topics=[event.topics[0],event.topics[1],'0x'+minter.slice(2).padStart(64,'0'),event.topics[3]],
};
for(const [name,change] of Object.entries(faults)) {
  const state=fixture();change(state);
  await assert.rejects(()=>verifyBaseSepoliaSponsoredMintRpcEvidence(input(state)),undefined,name);
  console.log(name+'=PASS');
}
for(const missing of ['expectedMinter','expectedRuntimeSha256']) {
  const args=input();delete args[missing];
  await assert.rejects(()=>verifyBaseSepoliaSponsoredMintRpcEvidence(args));
}
console.log('EXPLICIT_TRUSTED_PROFILE_REQUIRED=PASS');
console.log('NO_SALE_OR_MEMBERSHIP_MUTATION=PASS');
