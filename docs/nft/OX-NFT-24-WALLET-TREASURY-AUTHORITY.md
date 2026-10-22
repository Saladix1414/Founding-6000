# OX-NFT-24 — Wallet & Treasury Authority

Version: `OX-WALLET-TREASURY-AUTHORITY-1`

## Purpose

OriginX separates economic custody, operational funding,
NFT minting and contract administration.

A wallet address, wallet signature, account balance or successful
payment verification does not itself grant protocol authority.

## Authority roles

### PAYMENT_RECEIVER

Receives verified primary-sale USDT payments.

It is not:

- an NFT minter;
- a reserve vault;
- a contract administrator.

### OPERATING_TREASURY

Funds approved operational requirements such as:

- infrastructure;
- blockchain gas;
- limited funding of the isolated NFT minter.

It does not hold the protected reserve.

### RESERVE_VAULT

Holds the protected economic reserve.

Current primary-sale reserve policy:

`25%`

The reserve is not an ordinary operating account.

It must not:

- pay routine gas;
- fund the NFT minter;
- directly mint;
- become the operating treasury.

### NFT_MINTER

An isolated signer whose purpose is limited to approved
NFT mint transactions.

It may eventually hold a minimal operational gas balance.

It must not:

- receive customer payments;
- hold the reserve;
- act as the operating treasury;
- act as the contract admin.

### ADMIN

Restricted contract administration authority.

Administration and minting remain separate authorities.

## Mandatory separation

The following role pairs must not share the same wallet:

- PAYMENT_RECEIVER / NFT_MINTER
- RESERVE_VAULT / NFT_MINTER
- OPERATING_TREASURY / NFT_MINTER
- ADMIN / NFT_MINTER
- RESERVE_VAULT / OPERATING_TREASURY
- RESERVE_VAULT / PAYMENT_RECEIVER

Additional separation can be added as the production model matures.

## Authority principles

`WALLET_OWNERSHIP != AUTHORITY`

`WALLET_SIGNATURE != AUTHORITY`

`BALANCE != AUTHORITY`

`PAYMENT_VERIFIED != MINT_APPROVED`

`RESERVE_BALANCE != OPERATING_BUDGET`

`MINTER_ROLE != ADMIN_ROLE`

## Current safety state

`NFT_MINT_ENABLED=false`

`RESERVE_SWEEP_ENABLED=false`

`TREASURY_ACTION_AUTHORIZED=false`

`MAINNET_MINT_AUTHORIZED=false`

No address assignment is required during this architecture phase.

## Funding bootstrap

OriginX follows:

`NO TREASURY BEFORE FUNDING`

Therefore:

- the operating treasury may remain unfunded before bootstrap;
- the NFT minter may remain unfunded until mint readiness;
- the reserve vault may remain unfunded until verified revenue exists.

No placeholder funding transaction should be made merely to
populate these wallets.

## Network separation

Primary USDT settlement currently belongs to Ethereum Mainnet.

NFT deployment and minting use the separate OriginX NFT network
architecture, with Base preferred and Base Sepolia used before
mainnet execution.

Network membership does not remove authority separation.

## Future phases

OX-NFT-24B will establish operating treasury bootstrap and gas
budget policy.

OX-NFT-25 will bind the final NFT contract to separated ADMIN and
MINTER authorities.

No mainnet transaction is authorized by this document.
