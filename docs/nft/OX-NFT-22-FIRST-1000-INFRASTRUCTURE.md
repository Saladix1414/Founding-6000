# OX-NFT-22 — First 1000 Infrastructure Canon

Status: BENCHMARK / PRE-MAINNET
Target: RARE #0001–#1000

## Launch scope

The initial production cost model covers only:

- 1 collection contract deployment
- RARE token IDs 1 through 1000
- up to 1000 primary mints
- operational retry/headroom

EPIC and GENESIS are outside the initial gas budget.

## Zero-cash development

Development and validation must not require production funds.

Production-cost actions remain disabled until explicitly activated.

Testnet/local execution is used to validate the same contract and
automation path intended for production.

## Self-host-first storage

Existing Founding 6000 infrastructure is the first storage layer.

### Static assets

Use Cloudflare Worker Static Assets for immutable/content-addressed:

- canonical NFT image
- canonical metadata JSON
- public provenance manifest

Target layout:

/nft/rare/0001/image-<sha256>.png
/nft/rare/0001/metadata-<sha256>.json
/nft/rare/0001/provenance-<sha256>.json

The exact extension may change according to the canonical media format.

A canonical asset must never be silently overwritten at the same
content-addressed path.

### Durable Object SQLite

Use SQLite only for operational/index data:

- token ID
- serial
- collection tier
- canonical media hash
- canonical metadata hash
- provenance hash
- mint state
- destination wallet binding
- transaction references
- confirmation state
- owner verification state
- idempotency state

Do not use SQLite as the canonical image blob store.

## External storage

R2 / IPFS / Arweave are not launch requirements.

They may be added as:

- replication
- archival persistence
- CDN/object-storage scaling
- decentralized preservation

No external paid storage dependency is required for NFT-22.

## Chain candidates

Production candidates:

1. Base
2. Polygon PoS
3. Arbitrum One

Development networks:

- Base Sepolia
- Polygon Amoy
- Arbitrum Sepolia

## Chain decision rule

No chain wins solely because of nominal gwei.

The final decision uses the measured OriginX contract and includes:

- deployment gas
- mint gas
- 1000-mint projected cost
- native token USD cost
- L1/data component where applicable
- RPC availability
- testnet/faucet availability
- MetaMask compatibility
- marketplace compatibility
- operational automation
- signer isolation
- ecosystem maturity

## Mint cost authority

The authoritative benchmark will use actual gas measurements from the
OriginX ERC-721 benchmark contract.

Explorer fee trackers are informational evidence only.

## Safety

PAYMENT != MINT AUTHORITY

WALLET OWNERSHIP != ADMIN AUTHORITY

NFT MINT != RESERVE AUTHORITY

RESERVE != MINTER GAS WALLET

TESTNET RESULT != MAINNET APPROVAL

NO PRODUCTION MINT WITHOUT EXPLICIT ACTIVATION
