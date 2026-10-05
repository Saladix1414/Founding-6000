import { env } from "./config/env.js";
import { createApp } from "./app.js";

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
        " Founding 6000 API",
      );

      console.log(
        "============================================",
      );

      console.log(
        `http://${env.API_HOST}:${env.API_PORT}`,
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
  signal: string,
) {
  console.log(
    `Received ${signal}. Shutting down.`,
  );

  server.close(() => {
    process.exit(0);
  });
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM"),
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT"),
);
