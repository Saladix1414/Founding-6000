import {
  ECONOMIC_ALERT_DELIVERY_POLICY_VERSION,
  ECONOMIC_ALERT_MAX_ATTEMPTS,
  ECONOMIC_ALERT_RETRY_BASE_MS,
  ECONOMIC_ALERT_RETRY_MAX_MS,
  nextEconomicAlertRetryDelayMs,
  shouldTerminallyFailEconomicAlert,
} from "../economics/economicAlertDeliveryPolicy.js";

if (
  ECONOMIC_ALERT_DELIVERY_POLICY_VERSION !==
  "OX-ECONOMIC-ALERT-DELIVERY-1"
) {
  throw new Error(
    "DELIVERY_POLICY_VERSION_INVALID",
  );
}

if (
  nextEconomicAlertRetryDelayMs(
    1,
  ) !==
  ECONOMIC_ALERT_RETRY_BASE_MS
) {
  throw new Error(
    "RETRY_ATTEMPT_1_INVALID",
  );
}

if (
  nextEconomicAlertRetryDelayMs(
    2,
  ) !==
  ECONOMIC_ALERT_RETRY_BASE_MS *
    2
) {
  throw new Error(
    "RETRY_ATTEMPT_2_INVALID",
  );
}

if (
  nextEconomicAlertRetryDelayMs(
    100,
  ) >
  ECONOMIC_ALERT_RETRY_MAX_MS
) {
  throw new Error(
    "RETRY_CAP_INVALID",
  );
}

if (
  shouldTerminallyFailEconomicAlert(
    ECONOMIC_ALERT_MAX_ATTEMPTS -
      1,
  )
) {
  throw new Error(
    "TERMINAL_FAILURE_TOO_EARLY",
  );
}

if (
  !shouldTerminallyFailEconomicAlert(
    ECONOMIC_ALERT_MAX_ATTEMPTS,
  )
) {
  throw new Error(
    "TERMINAL_FAILURE_NOT_REACHED",
  );
}

console.log(
  "OX_ECONOMIC_ALERT_DELIVERY_POLICY=PASS",
);

console.log(
  "MAX_ATTEMPTS=" +
    ECONOMIC_ALERT_MAX_ATTEMPTS,
);

console.log(
  "EXPONENTIAL_BACKOFF=YES",
);

console.log(
  "RETRY_CAP_MS=" +
    ECONOMIC_ALERT_RETRY_MAX_MS,
);

console.log(
  "ALERT_DELIVERY_IS_AUTHORITY=NO",
);
