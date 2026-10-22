# OX-NFT-24B — Network Readiness

Version:

`OX-NETWORK-READINESS-1`

## Purpose

OriginX uses Base Sepolia as the preferred NFT end-to-end
test environment before any Base mainnet deployment or mint.

Expected chain ID:

`84532`

## Read-only observations

The readiness adapter may use:

- `eth_chainId`
- `eth_blockNumber`
- `eth_gasPrice`

These calls provide network evidence only.

## Authority boundary

`NETWORK REACHABLE != DEPLOYMENT APPROVED`

`NETWORK REACHABLE != FUNDING APPROVED`

`NETWORK REACHABLE != MINT APPROVED`

`NETWORK REACHABLE != MAINNET APPROVED`

## Security

No private key is required.

No signer is created.

No transaction is broadcast.

RPC write methods remain unsupported.

## Runtime input

The read-only endpoint is supplied through:

`OX_BASE_SEPOLIA_READONLY_RPC_URL`

The endpoint is runtime configuration and must not become
protocol authority.

## Current state

`TARGET_NETWORK=BASE_SEPOLIA`

`EXPECTED_CHAIN_ID=84532`

`DEPLOYMENT_AUTHORIZED=false`

`FUNDING_AUTHORIZED=false`

`MINT_AUTHORIZED=false`

`MAINNET_AUTHORIZED=false`

The next stages may use this evidence for Base Sepolia E2E
planning, but this document does not authorize a blockchain
transaction.
