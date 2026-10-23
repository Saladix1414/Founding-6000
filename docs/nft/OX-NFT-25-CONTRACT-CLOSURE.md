# OX-NFT-25 — Contract Closure Evidence

## Scope

Contract: OriginXFoundingAccess
Collection: OriginX Founding 6000
Canonical supply: 6000
Token identifiers: 1 through 6000

This record covers local compilation and testing.
It is not authorization for deployment or minting.

## Compilation

Solidity: 0.8.38
OpenZeppelin Contracts: 5.0.2
Optimizer: enabled, 200 runs
EVM target: Shanghai

Two independent local compilations produced
identical results.

## SHA-256 Evidence

Source:
01d56df7ee7a82431022d37feea86af4e75676540b170f72450dc606e711fee0

ABI file:
fafd79ae471141cd84e5a5251396f9088b9e94167b3c538979d39c18a091c41c

Creation bytecode:
c7708d78b33453817bc78f9a39e742435c2d9dfb9dc252943fdaba887754a6c1

Runtime bytecode:
1c1fde5e9811f6e62254c1ddb71ed47e5ee0cc4b4eb4254a552c020c1a09c0a5

Bytecode hashes use decoded byte sequences.
The manifest contains the full compiler settings.

## Verification Evidence

- Double compilation: PASS
- Artifact reproducibility: PASS
- Contract regression suite: PASS
- Local full-supply mint (1–6000): PASS
- Token 6001 rejected: PASS
- Duplicate after exhaustion blocked: PASS
- Supply counter maximum: 6000
- Transfer preserves total minted: PASS
- Pause behavior: PASS
- Metadata freeze: PASS
- Burn function: not implemented

## Security Boundaries

- No Base Sepolia deployment
- No mainnet deployment
- No real blockchain transactions
- No real funds transferred
- No deployment authority granted
- No mint authority granted
- No approval to freeze production metadata

Bytecode and hashes are evidence of identity,
not proof that the contract has no vulnerabilities.
Deployment bytecode includes constructor arguments;
deployed runtime comparison must account for compiler
metadata and immutable values where applicable.

## Next Gate

Complete final closure review before requesting
explicit authorization for any testnet deployment.
