# OX-NFT-24B — Funding Readiness Model

Version:

`OX-TREASURY-FUNDING-READINESS-1`

## Purpose

The funding readiness model answers a narrow question:

> Given a planning gas price and the current NFT minter balance,
> is the observed balance large enough to cover the current
> planning requirement?

It does not move funds.

It does not authorize funding.

It does not authorize minting.

## Inputs

- planning gas price in wei;
- current NFT minter balance in wei;
- planning gas units.

Current first-1000 planning gas:

`69,666,271`

## Calculation

`requiredBalanceWei = planningGasUnits × gasPriceWei`

If:

`currentBalanceWei < requiredBalanceWei`

then:

`fundingDeficitWei = requiredBalanceWei - currentBalanceWei`

Otherwise:

`fundingDeficitWei = 0`

If:

`currentBalanceWei > requiredBalanceWei`

then:

`fundingSurplusWei = currentBalanceWei - requiredBalanceWei`

Otherwise:

`fundingSurplusWei = 0`

Balance readiness is:

`currentBalanceWei >= requiredBalanceWei`

## Critical distinction

`BALANCE_READY != FUNDING_APPROVED`

`BALANCE_READY != MINT_APPROVED`

`BALANCE_READY != MAINNET_APPROVED`

A wallet can contain sufficient gas while OriginX still has no
authority to use it.

Likewise, an insufficient wallet does not automatically authorize
the operating treasury to transfer funds.

## Funding authority

The approved architecture remains:

`OPERATING_TREASURY -> NFT_MINTER`

The following remains forbidden for routine gas funding:

`RESERVE_VAULT -> NFT_MINTER`

The protected reserve is not an operational gas account.

## Runtime observation

A future stage may obtain:

- live network gas conditions;
- live NFT minter balance.

Those observations remain telemetry/readiness evidence.

`TELEMETRY != AUTHORITY`

## Current state

`AUTOMATIC_FUNDING_AUTHORIZED=false`

`TREASURY_ACTION_AUTHORIZED=false`

`MAINNET_FUNDING_AUTHORIZED=false`

`NFT_MINT_ENABLED=false`

`RESERVE_FUNDING_ALLOWED=false`

No blockchain transaction is authorized by this model.
