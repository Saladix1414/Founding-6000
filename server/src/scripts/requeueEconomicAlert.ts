import {
  requeueFailedEconomicAlert,
} from "../services/economicAlertRecoveryService.js";

function argumentValue(
  name:
    string,
) {
  const index =
    process.argv.indexOf(
      name,
    );

  if (
    index ===
      -1 ||
    index +
      1 >=
      process.argv.length
  ) {
    return null;
  }

  return process.argv[
    index +
    1
  ] ??
    null;
}

const confirmed =
  process.argv.includes(
    "--confirm-requeue",
  );

if (!confirmed) {
  throw new Error(
    "EXPLICIT_CONFIRM_REQUEUE_REQUIRED",
  );
}

const alertId =
  argumentValue(
    "--alert-id",
  );

const idempotencyKey =
  argumentValue(
    "--idempotency-key",
  );

const reason =
  argumentValue(
    "--reason",
  );

if (
  !alertId ||
  !idempotencyKey ||
  !reason
) {
  throw new Error(
    "USAGE: --alert-id <id> --idempotency-key <key> --reason <reason> --confirm-requeue",
  );
}

const result =
  requeueFailedEconomicAlert({
    alertId,
    idempotencyKey,
    reason,
  });

console.log(
  JSON.stringify(
    {
      operation:
        "ECONOMIC_ALERT_REQUEUE",

      alertId:
        result.event.alertId,

      recovered:
        result.recovered,

      idempotentReplay:
        result.idempotentReplay,

      recoveredAt:
        result.event.recoveredAt,

      alertDeliveryExecuted:
        false,

      economicAuthority:
        false,
    },
  ),
);
