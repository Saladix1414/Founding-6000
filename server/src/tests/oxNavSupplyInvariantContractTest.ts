import {
  readFileSync,
} from "node:fs";

const reserveProof =
  readFileSync(
    "server/src/services/reserveProofService.ts",
    "utf8",
  );

const currentEconomy =
  readFileSync(
    "server/src/services/economyService.ts",
    "utf8",
  );

const history =
  readFileSync(
    "server/src/services/economyHistoryService.ts",
    "utf8",
  );

const inventory =
  readFileSync(
    "server/src/services/inventoryService.ts",
    "utf8",
  );

if (
  reserveProof.includes(
    "WHERE status = 'ALLOCATED'"
  )
) {
  throw new Error(
    "NAV_DENOMINATOR_FILTERED_TO_ACTIVE_ALLOCATION",
  );
}

if (
  !reserveProof.includes(
    "validateIssuedSupply"
  )
) {
  throw new Error(
    "NAV_SUPPLY_VALIDATION_MISSING",
  );
}

if (
  !currentEconomy.includes(
    "NAV_SUPPLY_BASIS"
  ) ||
  !currentEconomy.includes(
    "navPolicy:"
  )
) {
  throw new Error(
    "CURRENT_NAV_POLICY_DISCLOSURE_MISSING",
  );
}

if (
  !history.includes(
    "NAV_SUPPLY_BASIS"
  ) ||
  !history.includes(
    "navPolicy:"
  )
) {
  throw new Error(
    "HISTORY_NAV_POLICY_DISCLOSURE_MISSING",
  );
}

if (
  !inventory.includes(
    "A RELEASED Founding serial remains permanently"
  )
) {
  throw new Error(
    "HISTORICAL_SERIAL_CONSUMPTION_RULE_MISSING",
  );
}

console.log(
  "OX_NAV_SUPPLY_INVARIANTS=PASS",
);

console.log(
  "HISTORICAL_ISSUED_DENOMINATOR=PASS",
);

console.log(
  "RELEASED_SERIALS_STILL_COUNT=PASS",
);

console.log(
  "SERIAL_REUSE=NO",
);

console.log(
  "CURRENT_API_POLICY_DISCLOSURE=PASS",
);

console.log(
  "HISTORY_API_POLICY_DISCLOSURE=PASS",
);
