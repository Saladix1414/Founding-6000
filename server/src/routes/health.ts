import {
  Router,
} from "express";

import { env } from "../config/env.js";

export const healthRouter =
  Router();

healthRouter.get(
  "/",
  (_request, response) => {
    response.json({
      status: "ok",
      service:
        "founding-6000-api",

      environment:
        env.NODE_ENV,

      paymentReadiness:
        env.PAYMENT_READINESS,

      realPaymentsEnabled:
        env.REAL_PAYMENTS_ENABLED,

      timestamp:
        new Date().toISOString(),
    });
  },
);
