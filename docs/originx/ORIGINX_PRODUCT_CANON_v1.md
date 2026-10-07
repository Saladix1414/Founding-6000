# ORIGINX PRODUCT CANON v1

Project: DIGITALBOOST ORIGIN — FOUNDING 6000  
System: ORIGINX  
Phase: OX-0 — Product & Legal Canon  
Status: PRODUCT CANON LOCKED v1

---

## 1. Purpose

This document defines the canonical product rules for the OriginX
Founding 6000 NFT membership system.

All later technical phases must implement this canon.

Smart contracts, blockchain services, databases, wallet flows,
generative systems and marketplace integrations must not redefine
these rules implicitly.

This document is a product and engineering specification.

Final customer-facing legal terms must be reviewed for the
jurisdictions where the product is offered before production launch.

---

## 2. Brand hierarchy

Canonical brand relationship:

ORIGINX
↓
DigitalBoost Origin
↓
Founding 6000

### OriginX

OriginX is the NFT membership, ownership, identity and provenance
technology.

It is responsible for concepts such as:

- transferable NFT membership;
- canonical token identity;
- NFT ownership;
- OriginX DNA;
- metadata;
- provenance;
- wallet verification;
- transferable access entitlement.

### DigitalBoost Origin

DigitalBoost Origin is the product or service environment whose
Founding access may be represented by the OriginX membership NFT.

### Founding 6000

Founding 6000 is the limited founding campaign.

Maximum canonical serial range:

1 through 6000.

Recommended collection name:

OriginX — DigitalBoost Origin Founding 6000

Recommended individual token name:

OriginX Founding #0001
OriginX Founding #0042
OriginX Founding #6000

---

## 3. Product definition

An OriginX Founding NFT is a transferable digital membership
credential.

It represents the right of the current valid NFT owner to use the
remaining portion of the associated DigitalBoost Origin Founding
access entitlement, subject to:

- activation;
- expiration;
- ownership verification;
- applicable product terms;
- applicable law.

Preferred public terminology:

- Transferable Membership NFT
- Transferable Access NFT
- OriginX Membership
- OriginX Founding Access

The NFT is intentionally transferable.

---

## 4. What the NFT does NOT represent

OriginX ownership does not represent:

- stock;
- equity;
- company ownership;
- company voting rights;
- revenue sharing;
- dividends;
- yield;
- staking returns;
- guaranteed appreciation;
- guaranteed resale;
- guaranteed liquidity;
- company debt;
- profit participation;
- investment return.

OriginX must not market the membership as a guaranteed financial
investment.

Commercial value on a secondary market, if any, is determined by
independent market participants.

---

## 5. Canonical serial identity

The Founding serial is canonical.

There must never be two public numbering systems.

The same identity follows the asset through:

payment
→ membership
→ OriginX NFT
→ metadata
→ DNA
→ provenance
→ access
→ transfer

Canonical rule:

tokenId = Founding serial

Examples:

Founding #0001
→ tokenId 1

Founding #0042
→ tokenId 42

Founding #1000
→ tokenId 1000

Founding #1001
→ tokenId 1001

Founding #6000
→ tokenId 6000

Leading zeroes are only presentation formatting.

---

## 6. Serial non-reuse

Once a serial has been permanently allocated after verified settlement,
that serial must never represent another independent membership.

If a membership is later:

- refunded;
- cancelled;
- retired;
- burned;
- revoked where legally permitted;

its serial remains part of its historical provenance.

The serial is never returned to the available inventory pool.

Maximum possible canonical serials:

6000.

This does not require 6000 simultaneously active memberships.

---

## 7. Collection tiers

### Tier 01

Serial range:

#0001–#1000

Campaign phase:

Genesis

OriginX tier:

RARE

Maximum range supply:

1000

Art generation:

Primitive Origin

---

### Tier 02

Serial range:

#1001–#3000

Campaign phase:

Early Access

OriginX tier:

EPIC

Maximum range supply:

2000

Art generation:

Evolved Origin

---

### Tier 03

Serial range:

#3001–#6000

Campaign phase:

Founding Access

OriginX tier:

LEGENDARY

Maximum range supply:

3000

Art generation:

Ascended Origin

---

Rare, Epic and Legendary are collection/artistic tiers.

They are not statistical rarity probabilities.

They must not imply guaranteed monetary value.

---

## 8. Membership entitlement

Each OriginX NFT is associated with one Founding access lifecycle.

The entitlement belongs to the token identity.

It is not permanently owned by:

- the original email;
- the original purchaser;
- a username;
- a device;
- an original wallet after transfer.

Current NFT ownership controls the transferable entitlement.

---

## 9. Email and account identity

Email is contact/account information.

Email is not canonical proof of transferable NFT ownership.

A DigitalBoost account may be linked to a current NFT owner after
wallet-control verification.

When NFT ownership changes, the old account must no longer retain
access based on that NFT.

---

## 10. Access duration

Canonical Founding access duration:

12 months.

The token receives only one 12-month lifecycle.

Transfer does not create another 12-month period.

Canonical states:

UNACTIVATED

ACTIVE

EXPIRED

Possible administrative states may later include:

CANCELLED

REFUNDED

RETIRED

where appropriate.

---

## 11. Activation

Access does not begin merely because payment settled.

Access does not begin merely because a serial was allocated.

Access does not begin merely because the NFT was submitted for minting.

Recommended activation model:

the access period begins at the earlier applicable event of:

1. first valid manual activation by the eligible current owner; or

2. automatic activation 30 days after confirmed NFT mint if no manual
   activation occurred.

This 30-day grace period remains a founder decision until OX-0 is
approved.

---

## 12. Activation immutability

After activation:

activated_at

and:

expires_at

must not be reset because of:

- resale;
- wallet-to-wallet transfer;
- marketplace transfer;
- account relinking;
- change of email;
- change of owner.

Example:

Activation:

January 1

Transfer:

May 1

Original term:

12 months

New owner receives:

approximately 8 months remaining.

The new owner does not receive a fresh 12-month term.

---

## 13. Transfer policy

OriginX Founding NFTs are intentionally transferable.

Standard ERC-721 transfer mechanics should remain available.

OriginX should not require a proprietary marketplace to transfer a
valid NFT.

Compatible mechanisms may include:

- wallet-to-wallet transfer;
- compatible NFT marketplaces;
- compatible wallets;
- future OriginX Marketplace.

When ownership changes:

OLD OWNER
→ loses the associated transferable access entitlement.

NEW OWNER
→ receives the remaining entitlement.

Activation and expiry timestamps remain unchanged.

---

## 14. Resale

NFT resale is allowed.

OriginX does not promise:

- resale value;
- minimum resale price;
- buyer availability;
- liquidity;
- appreciation;
- profit.

Before a secondary purchase, the system should allow the prospective
buyer to determine relevant entitlement state including:

- tokenId;
- tier;
- activation status;
- expiration;
- whether access is already expired.

---

## 15. Expired NFTs

Expiration ends the Founding access entitlement.

Expiration does not automatically destroy:

- the NFT;
- tokenId;
- artwork;
- DNA;
- provenance;
- historical identity.

An expired NFT may remain transferable as a digital collectible and
provenance artifact.

It must not be represented as carrying active DigitalBoost access.

Public status should clearly indicate:

EXPIRED — NO ACTIVE DIGITALBOOST ACCESS

when applicable.

---

## 16. Marketplace freedom

OriginX is designed around commercial transferability.

Users should remain free to use compatible external wallets and
marketplaces.

A future OriginX Marketplace may offer:

- discovery;
- listings;
- offers;
- transaction UX;
- provenance display;
- entitlement status display.

It must not become an artificial technical requirement for all
transfers.

---

## 17. Royalty policy

Recommended OriginX Founding v1 policy:

0% mandatory creator royalty.

Reasons:

- preserve commercial freedom;
- maximize standard ERC-721 compatibility;
- avoid relying on marketplace-specific enforcement;
- reduce contract complexity;
- avoid making secondary royalties a critical economic dependency.

A future OriginX Marketplace may charge a clearly disclosed service
fee for its own marketplace services.

Such a fee must not restrict external standard NFT transfers.

This decision must be explicitly approved before smart contract
specification.

---

## 18. Refund principle

The system must prevent an unintended state where a person receives:

refund
+
continued NFT control
+
active membership access

at the same time.

Applicable mandatory consumer rights always take precedence over
internal product policy.

---

## 19. Refund before mint

If an approved refund occurs before NFT mint:

- OriginX eligibility is cancelled;
- no mint may occur;
- the allocated serial remains historically consumed;
- the serial is never reassigned.

---

## 20. Refund after mint but before transfer

Where legally and operationally permitted, an approved voluntary refund
after mint should require NFT control to be reunified with OriginX
before completing the refund.

Possible future mechanism:

- verified return to an OriginX cancellation address; or
- explicit burn/cancellation mechanism if supported by the final
  contract design.

Exact mechanics are deferred to:

PHASE OX-14.

---

## 21. Refund after third-party transfer

The original purchaser must not be able to obtain a routine voluntary
refund while an independent third party retains:

- the NFT; and
- its associated entitlement.

Such cases require exceptional/legal review.

Mandatory consumer rights remain controlling where applicable.

---

## 22. Access already consumed

OriginX does not create an unlimited voluntary refund right after
substantial use of the membership.

Applicable mandatory legal rights, material service failures, fraud or
provider error must be handled according to the final legal framework.

---

## 23. Lost or stolen wallet

Recommended OriginX v1 model:

STRICT BEARER-ASSET MODEL.

OriginX should not contain a hidden administrative function capable of
arbitrarily moving a user's NFT.

If a private key is lost, OriginX cannot reconstruct it.

If a private key is stolen and blockchain ownership validly changes,
the blockchain owner changes.

Support systems may still:

- secure a DigitalBoost account;
- terminate account sessions;
- investigate abuse;
- preserve evidence;
- respond to legal obligations.

Those actions are separate from seizing or transferring the NFT.

Any future recovery mechanism would require:

- explicit public disclosure;
- new security analysis;
- governance analysis;
- contract review;
- founder approval.

This decision remains subject to explicit OX-0 approval.

---

## 24. Owner rights

Subject to the active entitlement period and final terms, the valid
current owner may receive:

- remaining Founding access;
- ability to link a compatible DigitalBoost account;
- ability to transfer the NFT;
- ability to sell through compatible external mechanisms;
- ability to display the OriginX artwork;
- access to public OriginX provenance.

---

## 25. Intellectual property

NFT ownership does not automatically transfer:

- OriginX trademarks;
- DigitalBoost trademarks;
- source code;
- platform technology;
- corporate ownership;
- authority to represent OriginX or DigitalBoost officially;
- rights over unrelated OriginX collection artwork.

Approved OriginX v1 artwork license:

commercial,
worldwide,
non-exclusive,
token-ownership-bound.

The valid current NFT owner may commercially use the specific artwork
associated with the NFT they own.

Permitted examples may include:

- merchandise;
- personal branding;
- commercial media;
- promotional material;
- derivative creative works based on that specific NFT artwork.

The commercial license does NOT grant:

- ownership of the OriginX brand;
- ownership of the DigitalBoost brand;
- company ownership;
- corporate rights;
- rights over other NFTs in the collection;
- authority to claim an official partnership or endorsement;
- authority to issue official OriginX products.

The continuing commercial license is linked to ownership of the NFT.

When ownership of the NFT is transferred, the previous owner loses the
right to create new commercial uses based on that NFT artwork.

Previously completed lawful products or historical references are not
automatically erased by a later transfer.

## 26. Privacy

Public OriginX metadata must never include:

- email;
- real name;
- phone number;
- government identifier;
- private database identifiers;
- private order information;
- wallet signatures;
- authentication tokens;
- password data;
- support notes;
- personal billing information.

Public-safe information may include:

- tokenId;
- serial;
- tier;
- campaign phase;
- generation;
- DNA hash;
- media hash;
- metadata hash;
- traits;
- network;
- contract;
- public blockchain transaction;
- public provenance events.

A blockchain wallet address is publicly observable on-chain.

Internal association between a wallet and customer/account data must be
protected as private account information.

---

## 27. Payment authority

The NFT layer must never weaken existing Founding payment authority.

Canonical upstream flow:

USDT PAYMENT
↓
SERVER VERIFICATION
↓
SETTLEMENT
↓
ORDER PAID
↓
FOUNDING SERIAL
↓
MEMBERSHIP CREATED

OriginX begins downstream:

MEMBERSHIP CREATED
↓
ORIGINX NFT ELIGIBLE

An NFT can never manufacture or substitute a valid payment settlement.

---

## 28. Public language

Preferred public descriptions:

"Transferable Membership NFT"

"Transferable Access NFT"

"OriginX Membership"

"OriginX Founding Access"

Recommended description:

"OriginX Founding Access is a transferable NFT-based membership
credential for DigitalBoost Origin."

Spanish:

"OriginX Founding Access es una membresía digital transferible
representada mediante un NFT y vinculada al acceso Founding de
DigitalBoost Origin."

---

## 29. Prohibited or discouraged marketing language

OriginX marketing must not describe the product as:

- guaranteed investment;
- guaranteed appreciating asset;
- stock;
- equity;
- share of the company;
- dividend product;
- yield product;
- guaranteed passive income;
- guaranteed resale;
- guaranteed liquidity.

The product is designed around:

ownership,
access,
identity,
provenance,
transferability.

Not financial return.

---

## 30. Minimum transfer disclosure

Before transfer or sale, the product should clearly communicate:

"Transferring this OriginX NFT transfers the remaining associated
Founding access entitlement. The access term does not restart for the
new owner."

---

## 31. Minimum buyer disclosure

Before purchase, a buyer should be able to understand that:

- Founding access lasts 12 months;
- transfer does not restart the 12-month period;
- selling/transferring the NFT transfers the remaining access;
- an expired NFT no longer provides active access;
- blockchain transactions may incur fees;
- loss of wallet control may cause loss of NFT control;
- secondary resale is not guaranteed;
- liquidity is not guaranteed;
- appreciation is not guaranteed;
- the NFT does not represent ownership in DigitalBoost.

---

## 32. Immutable product invariants

OX-I01

Maximum canonical serial range is 1–6000.

OX-I02

tokenId equals canonical Founding serial.

OX-I03

A permanently allocated serial is never reassigned.

OX-I04

Each OriginX Founding entitlement has one 12-month lifecycle.

OX-I05

Transfer does not reset activation or expiry.

OX-I06

Current valid NFT ownership controls the transferable entitlement.

OX-I07

Email is not canonical NFT ownership.

OX-I08

Existing payment settlement remains upstream authority.

OX-I09

OriginX does not represent equity or revenue rights.

OX-I10

OriginX does not promise financial return.

OX-I11

External standard transfers are intentionally supported.

OX-I12

Expired NFT ownership does not imply active DigitalBoost access.

OX-I13

Private customer data is excluded from public metadata.

OX-I14

No hidden NFT-recovery administrator backdoor is part of v1.

OX-I15

Refund processing must consider current NFT ownership and access state.

---

## 33. Decisions requiring founder approval

Only decisions that materially change the product remain open.

### OX-D01 — Activation grace period

APPROVED.

Canonical decision:

30 days after confirmed mint.

If the owner does not manually activate during that period, the
12-month access lifecycle begins automatically.

### OX-D02 — Lost wallet model

APPROVED.

Canonical decision:

STRICT BEARER-ASSET MODEL.

OriginX v1 contains no hidden administrative NFT recovery,
unilateral seizure or arbitrary transfer mechanism.

### OX-D03 — Artwork license

APPROVED WITH COMMERCIAL RIGHTS.

Canonical decision:

commercial,
worldwide,
non-exclusive,
token-ownership-bound license.

The valid current NFT owner may commercially use the specific artwork
associated with their token.

This does not transfer:

- OriginX trademarks;
- DigitalBoost trademarks;
- company ownership;
- platform intellectual property;
- rights over unrelated collection artwork;
- authority to represent OriginX or DigitalBoost officially.

The continuing commercial license follows ownership of the NFT.

### OX-D04 — Initial launch geography

APPROVED.

Canonical initial launch strategy:

Argentina-first followed by jurisdiction-by-jurisdiction expansion.

International expansion requires review of:

- consumer terms;
- privacy obligations;
- disclosures;
- tax treatment;
- crypto/NFT regulatory analysis.

### OX-D05 — Mandatory royalties

APPROVED.

Canonical decision:

0% mandatory creator royalty on external NFT transfers.

OriginX v1 does not depend on secondary-sale royalties for its core
business economics.

A future OriginX Marketplace may charge a clearly disclosed marketplace
service fee for using its own infrastructure without restricting
standard external NFT transfers.

## 34. Phase completion condition

PHASE OX-0 is approved.

Status:

PRODUCT CANON LOCKED v1

Founder decisions:

OX-D01 — APPROVED  
30-day automatic activation deadline.

OX-D02 — APPROVED  
Strict Bearer Asset model.

OX-D03 — APPROVED  
Commercial, worldwide, non-exclusive, token-ownership-bound artwork
license.

OX-D04 — APPROVED  
Argentina-first launch strategy.

OX-D05 — APPROVED  
0% mandatory creator royalty on external transfers.

No smart contract implementation has been performed in OX-0.

The next authorized phase is:

PHASE OX-1 — TECHNICAL ARCHITECTURE.
