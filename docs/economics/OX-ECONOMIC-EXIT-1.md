# OX-ECONOMIC-EXIT-1

## Status

Canonical fail-closed economic exit policy.

This policy does not enable refunds, redemption, reserve
withdrawals, NFT burns, or serial reuse.

## Core separation

Membership state is not reserve authority.

NFT ownership is not reserve authority.

Wallet ownership is not reserve authority.

Transfer is not reserve authority.

A request to burn or redeem is not reserve authority.

## Current decisions

### Membership REFUNDED

A membership may eventually enter `REFUNDED` for product or
commercial reasons.

Under `OX-ECONOMIC-EXIT-1`, that state alone:

- does not debit the reserve;
- does not remove historical reserve contributions;
- does not change historical issued supply;
- does not make the serial reusable;
- does not authorize NFT burn;
- does not authorize redemption.

### Membership REVOKED

`REVOKED` is an entitlement/access state.

It does not mutate reserve accounting and does not reduce the
NAV denominator.

### NFT transfer

Transfer changes ownership only.

Transfer does not change historical issued supply and has no
reserve accounting effect.

### NFT burn

Burn economics are not enabled by this policy.

No burn may silently:

- reduce historical issued supply;
- increase NAV;
- release reserve assets;
- recreate inventory;
- make a Founding serial reusable.

A future burn-aware economic model requires a new explicit
versioned policy.

### Redemption

Reserve redemption is disabled.

A future redemption mechanism requires a new policy defining at
minimum:

1. eligibility;
2. claimant authority;
3. token/NFT state requirements;
4. amount calculation;
5. reserve ledger entries;
6. idempotency;
7. replay protection;
8. treasury execution;
9. blockchain evidence;
10. Proof-of-Reserve consequences;
11. NAV consequences;
12. Akashic/provenance events.

## NAV basis

Current policy remains:

`HISTORICAL_ISSUED_SUPPLY`

Therefore ALLOCATED and RELEASED serials both remain part of the
NAV denominator.

## Authority rule

No frontend, membership state, wallet signature, AI output,
telemetry event, NFT ownership event, or user request may create
reserve withdrawal authority by itself.

## Future policy

Any reserve-return, burn-adjusted NAV, outstanding-supply NAV or
redemption model requires a new version rather than modifying
`OX-ECONOMIC-EXIT-1` silently.
