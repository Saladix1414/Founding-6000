import {
  env,
} from "../config/env.js";

import {
  assertProductionRuntime,
} from "../config/productionRuntime.js";

try {
  assertProductionRuntime(
    env,
  );

  console.log(
    "PRODUCTION_RUNTIME=PASS",
  );

  console.log(
    `API_BIND=${env.API_HOST}:${env.API_PORT}`,
  );

  console.log(
    "DATABASE_PATH=CONFIGURED",
  );

  console.log(
    "FRONTEND_ORIGIN=CONFIGURED",
  );

  console.log(
    `PUBLIC_CHECKOUT_ENABLED=${env.PUBLIC_CHECKOUT_ENABLED}`,
  );

  console.log(
    `PAYMENT_READINESS=${env.PAYMENT_READINESS}`,
  );

  console.log(
    `REAL_PAYMENTS_ENABLED=${env.REAL_PAYMENTS_ENABLED}`,
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "PRODUCTION_RUNTIME_INVALID",
  );

  process.exit(
    1,
  );
}
