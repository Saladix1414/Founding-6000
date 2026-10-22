# OX-NFT-24B — Live Treasury Readiness

Version:

`OX-TREASURY-LIVE-READINESS-1`

## Purpose

This adapter provides live network observations for treasury
readiness without introducing transaction authority.

The adapter is intentionally read-only.

## Allowed JSON-RPC methods

Only:

`eth_gasPrice`

and:

`eth_getBalance`

are required by this adapter.

## Explicitly unsupported capabilities

The adapter must not provide:

- `eth_sendTransaction`
- `eth_sendRawTransaction`
- `eth_sign`
- `personal_sign`
- wallet transaction signing
- private-key signing
- automatic treasury funding
- NFT mint execution

## Inputs

Runtime inputs:

`OX_NFT_READONLY_RPC_URL`

`OX_NFT_MINTER_ADDRESS`

The RPC URL is connectivity configuration.

The minter address is an observation target.

Neither grants authority.

## Outputs

The adapter can report:

- live gas price;
- observed NFT minter balance;
- required planning balance;
- funding deficit;
- funding surplus;
- balance readiness.

## Authority boundary

`RPC OBSERVATION != AUTHORITY`

`BALANCE READY != FUNDING APPROVAL`

`BALANCE READY != MINT APPROVAL`

`BALANCE READY != MAINNET APPROVAL`

No RPC observation can authorize a transfer.

## Funding architecture

The approved future funding path remains:

`OPERATING_TREASURY -> NFT_MINTER`

Routine gas funding from the reserve remains forbidden:

`RESERVE_VAULT -> NFT_MINTER = FORBIDDEN`

## Security model

The read-only adapter accepts no private key.

It creates no signer.

It broadcasts no transaction.

The HTTP transport rejects RPC methods outside the explicit
read-only allowlist.

## Current state

`NFT_MINT_ENABLED=false`

`AUTOMATIC_FUNDING_AUTHORIZED=false`

`MAINNET_FUNDING_AUTHORIZED=false`

`TRANSACTION_SUBMISSION_SUPPORTED=false`
