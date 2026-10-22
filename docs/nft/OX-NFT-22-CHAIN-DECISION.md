# OX-NFT-22 — Chain Decision

Status: PROVISIONAL SELECTION
Scope: RARE #0001–#1000

## Measured OriginX workload

The benchmark executed:

- 1 local ERC-721 deployment
- 1000 sequential mints
- token IDs 1 through 1000
- owner verification for #0001 and #1000
- OpenZeppelin Contracts 5.0.2
- Solidity optimizer enabled, runs=200
- local EVM only
- zero real funds

Measured gas:

- deployment: 1,498,867
- first mint: 76,350
- average mint: 59,276
- maximum mint: 76,350
- 1000 mints: 59,276,004
- deployment + 1000 mints: 60,774,871
- conservative budget with 15% mint headroom: 69,666,271

## Candidate ranking

### 1. Base — preferred

Reasons:

- EVM compatible
- MetaMask compatible
- ETH gas token
- low observed execution gas prices
- Base Sepolia available for zero-cash development
- straightforward ethers integration
- suitable for isolated automated minter
- strong Ethereum ecosystem compatibility

Status:

PREFERRED_TESTNET_TARGET

Not yet authorized for production.

### 2. Polygon PoS — fallback candidate

Reasons:

- EVM compatible
- MetaMask compatible
- low transaction costs
- Polygon Amoy available for development
- mature ecosystem

Tradeoff:

- separate POL gas treasury
- introduces another native asset into operations

Status:

VALID_FALLBACK

### 3. Arbitrum One — secondary fallback

Reasons:

- EVM compatible
- MetaMask compatible
- ETH gas token
- mature L2 ecosystem

Tradeoff:

- current fee reference is less favorable for this workload
- L1 data component must also be considered

Status:

SECONDARY_FALLBACK

## Decision

Base becomes the preferred chain for the next validation phase.

This is NOT a mainnet deployment approval.

The next step is Base Sepolia validation using the same contract family
and automation path intended for production.

## Cost authority

Explorer gas trackers and token prices are volatile informational data.

They do not create a guaranteed production budget.

Final production funding must be calculated again immediately before
mainnet activation using:

1. finalized contract bytecode
2. live chain fee data
3. current ETH price
4. L1/L2 fee components
5. operational safety margin

## Bootstrap principle

OriginX does not require production gas capital during development.

The first production gas budget may be funded from the non-reserve
portion of verified campaign proceeds only after an explicit treasury
policy authorizes it.

Reserve funds are not minter gas funds.

## Security boundaries

PAYMENT != MINT AUTHORITY

SETTLEMENT VERIFIED != BLOCKCHAIN EXECUTION BY ITSELF

MINT JOB != TREASURY AUTHORITY

MINTER != ADMIN

MINTER != RESERVE VAULT

RESERVE != GAS TREASURY

TESTNET RESULT != MAINNET APPROVAL

MAINNET DEPLOYMENT REQUIRES EXPLICIT ACTIVATION
