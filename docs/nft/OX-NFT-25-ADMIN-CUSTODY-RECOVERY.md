# OriginX — Admin Custody and Recovery

Status: DESIGN PROPOSAL — NOT DEPLOYED

## Governance

- One human administrator: project founder.
- No mandatory external human administrator.
- AI, backend, MINTER and payment services
  cannot exercise administrative authority.
- ADMIN, MINTER and TREASURY remain separate.

## Proposed ADMIN custody

- Safe smart account as DEFAULT_ADMIN_ROLE holder.
- Three independent owner credentials.
- Transaction threshold: 2 of 3 signatures.
- All three credentials controlled by the founder.
- Prefer independent hardware signing devices.
- Physical offline backups in separate locations.
- Avoid shared recovery phrases or shared secrets.
- Never store keys or seed phrases in Git,
  Termux, cloud servers or project documentation.

## Recovery scenarios

Lost phone:
Use independent signing devices.

One signer lost:
Use two remaining signers to replace it.

One signer compromised:
Use two trusted signers to revoke it.
Inspect pending operations and other roles.

Two signers lost:
Emergency condition. Recovery is not guaranteed.
Assess offline backups before any deployment.

All signing material lost:
No guaranteed recovery without an approved,
separately designed recovery mechanism.

MINTER compromised:
Use ADMIN to revoke MINTER_ROLE and rotate.

## Contract continuity

- Never permit zero active default administrators.
- Preserve ADMIN/MINTER authority separation.
- Test administrative transfers and recoveries.
- Evaluate OpenZeppelin DefaultAdminRules.
- No change to ADMIN architecture without tests.

## Deployment gates

- No live keys in tests or CI.
- Testnet rehearsals required.
- Verify wallet and network compatibility.
- Verify signature threshold and recovery.
- Verify correct contract ADMIN address.
- Require explicit deployment authorization.
- Mainnet remains unapproved.

## Open decisions

- Final Safe configuration and signer devices.
- Physical backup and recovery procedures.
- Admin transfer delay and cancellation rules.
- Emergency response to partial compromise.
- Testnet deployment and recovery rehearsal.
