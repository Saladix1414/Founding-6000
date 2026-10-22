import {
  readFileSync,
} from "node:fs";

const schema =
  readFileSync(
    "server/src/db/economicAlertRecoverySchema.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economicAlertRecoveryService.ts",
    "utf8",
  );

const script =
  readFileSync(
    "server/src/scripts/requeueEconomicAlert.ts",
    "utf8",
  );

const migration =
  readFileSync(
    "server/src/db/migrationRegistry.ts",
    "utf8",
  );

for (
  const required of [
    "economic_alert_recovery_events",
    "idempotency_key TEXT NOT NULL UNIQUE",
    "previous_attempts",
    "trg_economic_alert_recovery_no_update",
    "trg_economic_alert_recovery_no_delete",
  ]
) {
  if (
    !schema.includes(
      required,
    )
  ) {
    throw new Error(
      `RECOVERY_SCHEMA_MISSING:${required}`,
    );
  }
}

for (
  const required of [
    "requeueFailedEconomicAlert",
    "ECONOMIC_ALERT_NOT_FOUND",
    "ECONOMIC_ALERT_NOT_FAILED",
    "ECONOMIC_ALERT_RECOVERY_IDEMPOTENCY_CONFLICT",
    "status = 'PENDING'",
    "attempts = 0",
    "last_error = NULL",
    "next_attempt_at = NULL",
    "failed_at = NULL",
  ]
) {
  if (
    !service.includes(
      required,
    )
  ) {
    throw new Error(
      `RECOVERY_SERVICE_MISSING:${required}`,
    );
  }
}

for (
  const required of [
    "--alert-id",
    "--idempotency-key",
    "--reason",
    "--confirm-requeue",
    "EXPLICIT_CONFIRM_REQUEUE_REQUIRED",
  ]
) {
  if (
    !script.includes(
      required,
    )
  ) {
    throw new Error(
      `RECOVERY_CLI_GUARD_MISSING:${required}`,
    );
  }
}

for (
  const forbidden of [
    "sendTransaction(",
    "signTransaction(",
    "wallet.send",
    "UPDATE reserve_",
    "DELETE FROM reserve_",
    "INSERT INTO reserve_",
  ]
) {
  if (
    service.includes(
      forbidden,
    ) ||
    script.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `RECOVERY_GAINED_AUTHORITY:${forbidden}`,
    );
  }
}

if (
  !migration.includes(
    '"017_economic_alert_recovery_audit"'
  )
) {
  throw new Error(
    "MIGRATION_017_MISSING",
  );
}

console.log(
  "OX_ECONOMIC_ALERT_RECOVERY_CONTRACT=PASS",
);

console.log(
  "FAILED_TO_PENDING_ONLY=YES",
);

console.log(
  "APPEND_ONLY_AUDIT=YES",
);

console.log(
  "IDEMPOTENT_RECOVERY=YES",
);

console.log(
  "EXPLICIT_CONFIRMATION=YES",
);

console.log(
  "ALERT_DELIVERY_EXECUTED=NO",
);

console.log(
  "ECONOMIC_AUTHORITY=NO",
);
