import {
  env,
} from "./config/env.js";

import {
  assertProductionRuntime,
} from "./config/productionRuntime.js";

import {
  createApp,
} from "./app.js";

assertProductionRuntime(
  env,
);

const app =
  createApp();

const server =
  app.listen(
    env.API_PORT,
    env.API_HOST,
    () => {
      console.log("");
      console.log(
        "============================================",
      );

      console.log(
        " Founding 6000",
      );

      console.log(
        "============================================",
      );

      console.log(
        `Listening on ${env.API_HOST}:${env.API_PORT}`,
      );

      console.log(
        `Environment: ${env.NODE_ENV}`,
      );

      console.log(
        `Public checkout: ${env.PUBLIC_CHECKOUT_ENABLED}`,
      );

      console.log(
        `Payment readiness: ${env.PAYMENT_READINESS}`,
      );

      console.log(
        `Real payments: ${env.REAL_PAYMENTS_ENABLED}`,
      );

      console.log("");
    },
  );

function shutdown(
  signal:
    string,
) {
  console.log(
    `Received ${signal}. Shutting down.`,
  );

  server.close(
    () => {
      process.exit(
        0,
      );
    },
  );
}

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM",
    ),
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT",
    ),
);
