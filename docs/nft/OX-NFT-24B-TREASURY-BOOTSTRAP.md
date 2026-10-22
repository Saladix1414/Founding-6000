# OX-NFT-24B — Treasury Bootstrap & Gas Budget

Version: `OX-TREASURY-BOOTSTRAP-1`

## Scope

This policy covers the initial OriginX NFT production scope:

- tier: RARE;
- token range: #0001–#1000;
- count: 1,000 NFTs;
- NFT network: Base preferred.

It does not authorize deployment, minting or movement of funds.

## OX-NFT-22 benchmark

Measured local benchmark:

- deployment gas: `1,498,867`;
- first mint gas: `76,350`;
- average mint gas: `59,276`;
- 1,000 mint gas total: `59,276,004`;
- deploy + mint measured total: `60,774,871`;
- planning total including existing headroom: `69,666,271`.

The planning value is therefore:

`69,666,271 gas units`

## Budget formula

The operational gas requirement is calculated as:

`requiredWei = planningGasUnits × planningGasPriceWei`

The gas price is a runtime planning input.

It is not governance authority.

It is not funding approval.

It is not mint approval.

## Examples

At `1 gwei`:

`0.069666271 ETH`

At `5 gwei`:

`0.348331355 ETH`

At `10 gwei`:

`0.696662710 ETH`

These examples are mathematical scenarios only.

They are not predictions of Base gas pricing.

## Funding path

Approved architecture:

`OPERATING_TREASURY → NFT_MINTER`

The NFT minter should hold only the operational gas balance
needed for authorized mint execution.

## Forbidden funding paths

The following must remain forbidden:

`RESERVE_VAULT → NFT_MINTER`

`PAYMENT_RECEIVER → NFT_MINTER`

for routine gas funding.

The protected reserve is not an operational gas account.

## Reserve policy

Current primary-sale reserve:

`25%`

Reserve funds do not become available for gas merely because
an NFT mint requires funding.

`RESERVE_BALANCE != OPERATING_BUDGET`

## Bootstrap rule

OriginX follows:

`NO TREASURY BEFORE FUNDING`

Therefore an empty operating treasury or minter wallet before
production funding is valid.

No artificial transaction should be created merely to make
those wallets non-empty.

## Current authority state

`NFT_MINT_ENABLED=false`

`RESERVE_SWEEP_ENABLED=false`

`TREASURY_ACTION_AUTHORIZED=false`

`AUTOMATIC_FUNDING_AUTHORIZED=false`

`MAINNET_FUNDING_AUTHORIZED=false`

## Next readiness stage

Before any real funding action:

1. select the final NFT chain;
2. verify live network fee conditions;
3. identify the operating treasury;
4. identify the isolated NFT minter;
5. validate role separation;
6. calculate the current required balance;
7. establish an explicit funding approval;
8. test on Base Sepolia;
9. only then consider Base mainnet funding.

This document does not authorize a blockchain transaction.
