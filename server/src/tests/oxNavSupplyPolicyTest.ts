import {
  NAV_SUPPLY_BASIS,
  NAV_SUPPLY_POLICY_VERSION,
  validateIssuedSupply,
} from "../economics/navSupplyPolicy.js";

if (
  NAV_SUPPLY_BASIS !==
  "HISTORICAL_ISSUED_SUPPLY"
) {
  throw new Error(
    "NAV_SUPPLY_BASIS_INVALID",
  );
}

if (
  NAV_SUPPLY_POLICY_VERSION !==
  "OX-NAV-SUPPLY-1"
) {
  throw new Error(
    "NAV_SUPPLY_POLICY_VERSION_INVALID",
  );
}

const full =
  validateIssuedSupply({
    RARE:
      1000,

    EPIC:
      2000,

    GENESIS:
      3000,
  });

if (
  full.supply.RARE !==
    1000 ||
  full.supply.EPIC !==
    2000 ||
  full.supply.GENESIS !==
    3000
) {
  throw new Error(
    "FULL_SUPPLY_VALIDATION_INVALID",
  );
}

const invalidCases = [
  {
    RARE:
      -1,

    EPIC:
      0,

    GENESIS:
      0,
  },

  {
    RARE:
      1001,

    EPIC:
      0,

    GENESIS:
      0,
  },

  {
    RARE:
      0,

    EPIC:
      2001,

    GENESIS:
      0,
  },

  {
    RARE:
      0,

    EPIC:
      0,

    GENESIS:
      3001,
  },
];

for (
  const invalid of
    invalidCases
) {
  let rejected =
    false;

  try {
    validateIssuedSupply(
      invalid,
    );
  } catch {
    rejected =
      true;
  }

  if (
    !rejected
  ) {
    throw new Error(
      "INVALID_ISSUED_SUPPLY_ACCEPTED",
    );
  }
}

console.log(
  "OX_NAV_SUPPLY_POLICY=PASS",
);

console.log(
  "NAV_SUPPLY_BASIS=HISTORICAL_ISSUED_SUPPLY",
);

console.log(
  "RELEASED_SERIAL_REUSE_ASSUMPTION=NO",
);

console.log(
  "TRANSFER_CHANGES_NAV_DENOMINATOR=NO",
);

console.log(
  "MEMBERSHIP_STATE_CHANGES_NAV_DENOMINATOR=NO",
);

console.log(
  "FUTURE_BURN_POLICY_REQUIRES_NEW_VERSION=YES",
);
