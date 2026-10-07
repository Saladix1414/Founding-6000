# ORIGINX TECHNICAL ARCHITECTURE v1

Project: DIGITALBOOST ORIGIN — FOUNDING 6000
System: ORIGINX
Phase: OX-1 — Technical Architecture
Status: DRAFT ARCHITECTURE

---

## 1. Architectural objective

OriginX extends the existing Founding 6000 payment and membership
architecture.

OriginX must not create a second payment authority.

Existing authoritative flow remains:

USDT PAYMENT
→ SERVER VERIFICATION
→ SETTLEMENT
→ ORDER PAID
→ FOUNDING SERIAL
→ MEMBERSHIP CREATED

OriginX begins only after:

MEMBERSHIP CREATED

Extended flow:

MEMBERSHIP CREATED
→ ORIGINX ELIGIBLE
→ DESTINATION WALLET
→ WALLET SIGNATURE VERIFIED
→ MINT QUEUED
→ MINT SUBMITTED
→ ON-CHAIN VERIFIED
→ NFT ACTIVE
→ TRANSFERABLE ACCESS ENABLED

---

## 2. Existing authoritative core

The existing Cloudflare architecture remains canonical for Founding
commerce.

Current production core:

Cloudflare Worker
→ FoundingCore Durable Object
→ Durable Object SQLite
→ CommerceCore

The existing commerce layer already manages:

- campaign phases;
- orders;
- payment attempts;
- payment settlements;
- inventory allocations;
- founding memberships;
- audit events;
- rate limiting.

The current settlement transaction already performs:

VERIFIED PAYMENT
→ PAYMENT SETTLEMENT
→ SERIAL ALLOCATION
→ ORDER PAID
→ MEMBERSHIP CREATED

This must remain the upstream source of truth.

---

## 3. Canonical transactional boundary

OriginX eligibility should be created within the same canonical
transactional boundary that creates the Founding membership.

Reason:

membership creation
and
OriginX eligibility creation

must not diverge because of distributed transaction failure.

The canonical system must never produce:

membership exists
but eligibility was silently lost

or:

OriginX eligibility exists
without a legitimate membership.

---

## 4. Separation of authorities

OriginX must maintain strict authority separation.

### Payment authority

Responsible for:

- Ethereum Mainnet USDT verification;
- settlement;
- payment replay protection;
- serial allocation;
- membership creation.

Cannot:

- mint NFTs;
- administer NFT contract;
- move NFT treasury funds.

### Founding Core

Responsible for:

- canonical membership state;
- OriginX eligibility state;
- wallet challenge records;
- mint job state;
- access entitlement state;
- provenance records.

Cannot:

- hold admin private key;
- hold treasury private key.

### Minter authority

Responsible only for:

- approved mint execution.

Must receive:

MINTER_ROLE only.

Must not receive:

- DEFAULT_ADMIN_ROLE;
- payment receiver authority;
- treasury control;
- refund authority.

### Admin authority

Recommended:

multisig or cold operational authority.

Responsible for:

- contract roles;
- pause authority where supported;
- emergency governance.

### Treasury authority

Separate wallet.

Responsible for:

- controlled gas funding;
- infrastructure funding.

---

## 5. Network architecture

Founding payment network remains:

Ethereum Mainnet

Payment token:

official USDT

OriginX NFT network target:

Base Mainnet

Test environment:

Base Sepolia

Payment and NFT networks are deliberately independent.

Base outage must not invalidate a correctly verified Ethereum payment.

---

## 6. Core system components

Logical architecture:

Frontend
→ Cloudflare Worker API
→ FoundingCore
→ OriginX entitlement registry

Additional OriginX components:

- Wallet Challenge Service
- Mint Job Registry
- Mint Executor
- Blockchain Gateway
- Mint Verification Service
- Ownership Indexer
- Access Registry
- Provenance Service
- Generative DNA Engine
- Metadata / Content Store

---

## 7. Proposed OriginX database domains

The following logical tables are planned.

Exact schema is deferred to implementation phases.

### originx_nft_entitlements

Purpose:

one canonical NFT entitlement per Founding membership.

Important uniqueness:

UNIQUE membership_id
UNIQUE founding_serial
UNIQUE token_id

Canonical rule:

token_id = founding_serial

Possible fields:

id
membership_id
founding_serial
token_id
tier
campaign_phase
status
destination_wallet
created_at
updated_at

---

### originx_wallet_challenges

Purpose:

wallet ownership verification.

Possible fields:

id
entitlement_id
wallet_address
nonce_hash
domain
purpose
issued_at
expires_at
used_at
created_at

Security:

single-use
time-limited
purpose-bound
domain-bound
wallet-bound
token-bound

---

### originx_mint_jobs

Purpose:

durable mint lifecycle.

Possible states:

ELIGIBLE
AWAITING_WALLET
WALLET_VERIFIED
MINT_QUEUED
MINTING
MINT_SUBMITTED
MINT_CONFIRMED
NFT_ACTIVE

Recoverable states:

RPC_UNAVAILABLE
MINT_RETRY
INSUFFICIENT_GAS
SIGNER_UNAVAILABLE
CONFIRMATION_PENDING

---

### originx_mint_transactions

Purpose:

persist blockchain transaction attempts.

Possible fields:

mint_job_id
chain_id
contract_address
token_id
recipient
tx_hash
submitted_at
confirmed_at
block_number
block_hash
receipt_status

Important uniqueness:

UNIQUE tx_hash

---

### originx_access_entitlements

Purpose:

off-chain access lifecycle.

Possible fields:

token_id
current_owner
status
activated_at
expires_at
owner_verified_at
updated_at

Canonical access rule:

valid current NFT ownership
+
active entitlement period

---

### originx_ownership_events

Purpose:

record verified ownership changes.

Possible fields:

token_id
from_address
to_address
tx_hash
block_number
block_hash
log_index
verified_at

---

### originx_provenance_events

Purpose:

append-oriented OriginX lifecycle record.

Examples:

PAYMENT_VERIFIED
SERIAL_ALLOCATED
MEMBERSHIP_CREATED
ORIGINX_ELIGIBLE
DNA_CREATED
WALLET_VERIFIED
MINT_QUEUED
MINT_SUBMITTED
NFT_MINTED
ACCESS_ACTIVATED
NFT_TRANSFERRED
OWNER_RECONCILED
ACCESS_EXPIRED

No PII in public provenance.

---

### originx_generation_dna

Purpose:

deterministic NFT DNA.

Important fields:

token_id
generation_version
seed_hash
dna_hash
tier
traits_json

Important uniqueness:

UNIQUE token_id
UNIQUE dna_hash

---

### originx_media_assets

Purpose:

media and content-addressed asset tracking.

Possible fields:

token_id
media_type
content_hash
content_uri
generation_version

---

### originx_metadata_versions

Purpose:

metadata version tracking.

Possible fields:

token_id
metadata_hash
metadata_uri
version
frozen_at

---

### originx_cost_ledger

Purpose:

measure OriginX infrastructure cost.

Possible categories:

MINT_GAS
RPC
STORAGE
GENERATION
INDEXING
MONITORING

This is operational accounting only.

No tokenomics.

---

## 8. Wallet verification boundary

A user must not obtain mint eligibility simply by submitting an
arbitrary address.

Flow:

request challenge
→ sign challenge
→ verify signer
→ consume nonce
→ mark destination wallet verified

Challenge must bind:

- OriginX purpose;
- tokenId;
- serial;
- wallet;
- nonce;
- domain;
- issued time;
- expiry time.

Replay protection is mandatory.

---

## 9. Mint lifecycle

Canonical mint lifecycle:

NOT_ELIGIBLE
→ ELIGIBLE
→ AWAITING_WALLET
→ WALLET_VERIFIED
→ MINT_QUEUED
→ MINTING
→ MINT_SUBMITTED
→ MINT_CONFIRMED
→ NFT_ACTIVE

MINT_SUBMITTED does not mean success.

NFT_ACTIVE requires on-chain verification.

---

## 10. Mint verification

After transaction submission OriginX must verify:

- expected chain;
- expected contract;
- receipt status;
- tokenId;
- recipient;
- Transfer event;
- ownerOf(tokenId);
- confirmation/finality policy.

Only then:

NFT_ACTIVE

---

## 11. Idempotency

OriginX must tolerate duplicate jobs and retries.

A repeated mint job must not create:

- another serial;
- another NFT;
- another membership;
- another entitlement.

Protection exists at two layers:

DATABASE UNIQUENESS

and

SMART CONTRACT TOKEN UNIQUENESS

A retry must converge toward the same tokenId and recipient.

---

## 12. Blockchain Gateway

All OriginX blockchain operations should pass through one logical
gateway.

Conceptual interface:

getChainId()
getBlockNumber()
getBlock()
getOwner(tokenId)
getTransactionReceipt(txHash)
getTransferLogs(fromBlock, toBlock)
estimateMintGas(...)
submitMint(...)
verifyContract(...)

Business logic should not contain arbitrary direct RPC calls spread
throughout the application.

---

## 13. RPC isolation

Ethereum payment RPC and OriginX NFT RPC are separate.

Conceptually:

ETHEREUM_PAYMENT_RPC

ORIGINX_BASE_RPC

An outage in one must not corrupt the state of the other.

Base outage example:

PAYMENT VERIFIED
ORDER PAID
SERIAL ALLOCATED
MEMBERSHIP CREATED
ORIGINX ELIGIBLE
MINT PENDING

The legitimate purchase remains valid.

---

## 14. Transfer indexer

OriginX monitors ERC-721 Transfer events.

Event detection alone is not sufficient.

Verification flow:

Transfer event detected
→ verify chain
→ verify contract
→ verify tokenId
→ verify block
→ query ownerOf(tokenId)
→ reconcile canonical owner
→ update access ownership

The authoritative ownership check is:

ownerOf(tokenId)

on the configured OriginX contract.

---

## 15. Reorganization handling

The ownership indexer should maintain:

chain_id
contract_address
last_processed_block
last_processed_block_hash

If chain history changes:

detect reorg
→ roll back unfinalized derived ownership events
→ replay affected range
→ reconcile ownerOf

Access must not rely only on unverified event cache.

---

## 16. Transferable access

On verified transfer:

OLD OWNER
→ loses entitlement

TOKEN
→ keeps original activation date
→ keeps original expiry date

NEW OWNER
→ receives remaining entitlement

Transfer never resets the 12-month term.

---

## 17. Activation

Approved OX-0 rule:

manual activation

or

automatic activation 30 days after confirmed mint.

Once stored:

activated_at
expires_at

must not be reset after transfer.

---

## 18. Account linking

DigitalBoost account linking requires:

valid wallet signature

and

wallet == current ownerOf(tokenId)

Email is contact/account identity only.

Email is not canonical transferable ownership.

---

## 19. Generative art boundary

The generative system remains independent from blockchain execution.

Canonical deterministic seed model:

SHA256(
  "ORIGINX"
  +
  generationVersion
  +
  tokenId
)

Generator inputs:

tokenId
generationVersion
tier

Generator outputs:

tokenId
seedHash
dna
dnaHash
traits
media manifest

No blockchain connection is required to generate canonical DNA.

---

## 20. Content storage boundary

Canonical OriginX media should use content-addressed storage.

Possible implementations:

IPFS
Arweave
other immutable/content-addressed system

Mutable application HTTP URLs are not sufficient as canonical
provenance.

Final storage selection is deferred to OX-16.

---

## 21. Refund integration boundary

Refund processing must consult OriginX state.

Conceptual checks:

NFT minted?
current owner?
transferred?
access activated?
access expired?
mandatory consumer right applicable?

No refund subsystem may ignore NFT ownership.

Implementation belongs to OX-14.

---

## 22. Failure isolation

Critical invariant:

NFT INFRASTRUCTURE FAILURE
must not become
PAYMENT SETTLEMENT FAILURE

Examples:

Base RPC unavailable
→ mint delayed

Minter unavailable
→ mint delayed

Metadata unavailable
→ publication delayed

None of these may undo a valid payment settlement.

---

## 23. Security trust zones

ZONE A

Customer/browser

ZONE B

Public Cloudflare Worker

ZONE C

FoundingCore Durable Object / SQLite

ZONE D

Operational mint signer

ZONE E

Base blockchain

No assertion from a less trusted zone is accepted without independent
verification.

---

## 24. Canonical identifiers

Example:

Founding #0042

inventory serial = 42
membership serial = 42
OriginX tokenId = 42
DNA token = 42
metadata token = 42
provenance token = 42

Internal UUIDs may exist.

They are implementation identifiers, not public serial identities.

---

## 25. OX-1 invariants

OX1-I01

OriginX remains downstream from verified settlement.

OX1-I02

FoundingCore remains canonical transactional authority for eligibility.

OX1-I03

tokenId equals Founding serial.

OX1-I04

Payment authority and mint authority remain separated.

OX1-I05

Admin authority and minter authority remain separated.

OX1-I06

NFT infrastructure failure cannot invalidate a legitimate payment.

OX1-I07

Mint submission is not mint success.

OX1-I08

ownerOf is the reconciliation authority for current NFT ownership.

OX1-I09

Transfer does not reset access lifecycle.

OX1-I10

Wallet challenges are single-use and replay protected.

OX1-I11

Generative DNA is deterministic and independent from blockchain state.

OX1-I12

Public metadata excludes personal information.

---

## 26. Phase output

PHASE OX-1 produces:

- canonical architecture;
- authority boundaries;
- logical database model;
- wallet verification boundary;
- mint state machine;
- blockchain gateway boundary;
- ownership synchronization model;
- access architecture;
- generative system boundary;
- provenance boundary;
- failure isolation rules.

No smart contract has been implemented.

No production minting has been enabled.

Next phase after approval:

PHASE OX-2 — GENERATIVE DNA ENGINE.
