import {
  readFileSync,
} from "node:fs";

const schema =
  readFileSync(
    "server/src/db/economicExitDecisionSchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicExitDecisionService.ts",
    "utf8",
  );

const migrations =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

const requiredSchema = [
  "economic_exit_decisions",
  "idempotency_key TEXT NOT NULL UNIQUE",
  "evidence_json TEXT NOT NULL",
  "trg_economic_exit_decisions_no_update",
  "trg_economic_exit_decisions_no_delete",
  "ECONOMIC_EXIT_DECISIONS_APPEND_ONLY",
];

for (
  const value of
    requiredSchema
) {
  if (
    !schema.includes(
      value,
    )
  ) {
    throw new Error(
      `EXIT_DECISION_SCHEMA_CONTRACT_MISSING:${value}`,
    );
  }
}

const requiredService = [
  "evaluateEconomicExit",
  "buildEconomicExitIdempotencyKey",
  "recordEconomicExitDecision",
  "ECONOMIC_EXIT_POLICY_AUTHORITY_NOT_SUPPORTED",
  "idempotentReplay",
];

for (
  const value of
    requiredService
) {
  if (
    !service.includes(
      value,
    )
  ) {
    throw new Error(
      `EXIT_DECISION_SERVICE_CONTRACT_MISSING:${value}`,
    );
  }
}

if (
  !migrations.includes(
    '"011_economic_exit_decisions"'
  )
) {
  throw new Error(
    "MIGRATION_011_MISSING",
  );
}

/*
 * This phase is evidence/policy only.
 * It must contain no blockchain send path.
 */
const forbiddenExecution = [
  ".sendTransaction(",
  ".transfer(",
  "wallet.send",
  "signTransaction",
];

for (
  const value of
    forbiddenExecution
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `EXIT_DECISION_SERVICE_GAINED_EXECUTION_AUTHORITY:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_EXIT_DECISION_CONTRACT=PASS",
);

console.log(
  "MIGRATION_011=PASS",
);

console.log(
  "APPEND_ONLY_SCHEMA=PASS",
);

console.log(
  "IDEMPOTENCY=PASS",
);

console.log(
  "POLICY_EVIDENCE=PASS",
);

console.log(
  "BLOCKCHAIN_EXECUTION_AUTHORITY=NO",
);
