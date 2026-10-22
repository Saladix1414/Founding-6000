import {
  resolveEconomicAlertDeliveryHealth,
} from "../economics/economicAlertOperationsPolicy.js";

function expect(
  actual:
    string,

  expected:
    string,
) {
  if (
    actual !==
    expected
  ) {
    throw new Error(
      `EXPECTED_${expected}_GOT_${actual}`,
    );
  }
}

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      false,

    pending:
      10,

    retrying:
      3,

    failed:
      1,

    leased:
      1,
  }),
  "DISABLED",
);

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      true,

    pending:
      0,

    retrying:
      0,

    failed:
      0,

    leased:
      0,
  }),
  "IDLE",
);

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      true,

    pending:
      2,

    retrying:
      0,

    failed:
      0,

    leased:
      0,
  }),
  "ACTIVE",
);

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      true,

    pending:
      2,

    retrying:
      1,

    failed:
      0,

    leased:
      0,
  }),
  "DEGRADED",
);

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      true,

    pending:
      2,

    retrying:
      0,

    failed:
      0,

    leased:
      1,
  }),
  "DEGRADED",
);

expect(
  resolveEconomicAlertDeliveryHealth({
    enabled:
      true,

    pending:
      0,

    retrying:
      0,

    failed:
      1,

    leased:
      0,
  }),
  "FAILED",
);

console.log(
  "OX_ECONOMIC_ALERT_OPERATIONS_POLICY=PASS",
);

console.log(
  "DISABLED_STATE=PASS",
);

console.log(
  "IDLE_STATE=PASS",
);

console.log(
  "ACTIVE_STATE=PASS",
);

console.log(
  "DEGRADED_STATE=PASS",
);

console.log(
  "FAILED_STATE=PASS",
);

console.log(
  "OBSERVABILITY_IS_AUTHORITY=NO",
);
