import {
  isEconomicAlertOperationallyHealthy,
  shouldEconomicAlertHealthBlockCoreReadiness,
} from "../economics/economicAlertHealthPolicy.js";

for (
  const state of [
    "DISABLED",
    "IDLE",
    "ACTIVE",
  ] as const
) {
  if (
    !isEconomicAlertOperationallyHealthy(
      state,
    )
  ) {
    throw new Error(
      `EXPECTED_HEALTHY:${state}`,
    );
  }
}

for (
  const state of [
    "DEGRADED",
    "FAILED",
  ] as const
) {
  if (
    isEconomicAlertOperationallyHealthy(
      state,
    )
  ) {
    throw new Error(
      `EXPECTED_DEGRADED:${state}`,
    );
  }
}

for (
  const state of [
    "DISABLED",
    "IDLE",
    "ACTIVE",
    "DEGRADED",
    "FAILED",
  ] as const
) {
  if (
    shouldEconomicAlertHealthBlockCoreReadiness(
      state,
    )
  ) {
    throw new Error(
      `ALERT_HEALTH_GAINED_CORE_AUTHORITY:${state}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_ALERT_HEALTH_POLICY=PASS",
);

console.log(
  "DISABLED_READY=YES",
);

console.log(
  "FAILED_DEGRADES_OPERATIONS=YES",
);

console.log(
  "FAILED_BLOCKS_CORE_READINESS=NO",
);

console.log(
  "ALERT_HEALTH_IS_AUTHORITY=NO",
);
