import {
  existsSync,
} from "node:fs";

import {
  resolve,
  sep,
} from "node:path";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import {
  rateLimit,
} from "express-rate-limit";

import { env } from "./config/env.js";

import {
  initializeDatabase,
} from "./db/database.js";

import {
  healthRouter,
} from "./routes/health.js";

import {
  campaignRouter,
} from "./routes/campaign.js";

import {
  emailRegistrationsRouter,
} from "./routes/emailRegistrations.js";

import {
  ordersRouter,
} from "./routes/orders.js";

import {
  usdtPaymentsRouter,
} from "./routes/usdtPayments.js";

import {
  quotesRouter,
} from "./routes/quotes.js";

import {
  membershipsRouter,
} from "./routes/memberships.js";

import {
  requestIdMiddleware,
} from "./middleware/requestId.js";

import {
  errorHandler,
} from "./middleware/errorHandler.js";

export function createApp() {
  initializeDatabase();

  const app =
    express();

  app.disable(
    "x-powered-by",
  );

  /*
   * Disabled locally/default.
   * Enable only behind a trusted production reverse proxy.
   */
  app.set(
    "trust proxy",
    env.TRUST_PROXY,
  );

  app.use(
    requestIdMiddleware,
  );

  app.use(
    helmet(),
  );

  app.use(
    cors({
      origin(
        origin,
        callback,
      ) {
        /*
         * Requests without Origin are allowed:
         * CLI, server-to-server and health probes.
         */
        if (!origin) {
          callback(
            null,
            true,
          );

          return;
        }

        if (
          origin ===
          env.FRONTEND_ORIGIN
        ) {
          callback(
            null,
            true,
          );

          return;
        }

        callback(
          new Error(
            "CORS_ORIGIN_DENIED",
          ),
        );
      },

      methods: [
        "GET",
        "POST",
      ],

      allowedHeaders: [
        "Content-Type",
        "Idempotency-Key",
      ],

      exposedHeaders: [
        "X-Request-Id",
        "RateLimit",
        "RateLimit-Policy",
      ],

      credentials:
        false,

      maxAge:
        600,
    }),
  );

  app.use(
    express.json({
      limit:
        "32kb",

      strict:
        true,
    }),
  );

  app.use(
    "/api",
    rateLimit({
      windowMs:
        60_000,

      limit:
        120,

      standardHeaders:
        "draft-8",

      legacyHeaders:
        false,
    }),
  );

  /*
   * API responses should not be cached by
   * shared intermediaries unless explicitly
   * enabled by a future route.
   */
  app.use(
    "/api",
    (
      _request,
      response,
      next,
    ) => {
      response.setHeader(
        "Cache-Control",
        "no-store",
      );

      next();
    },
  );

  app.use(
    "/api/health",
    healthRouter,
  );

  app.use(
    "/api/campaign",
    campaignRouter,
  );

  app.use(
    "/api/email-registrations",
    emailRegistrationsRouter,
  );

  app.use(
    "/api/orders",
    ordersRouter,
  );

  app.use(
    "/api/payments/usdt",
    usdtPaymentsRouter,
  );

  app.use(
    "/api/quotes",
    quotesRouter,
  );

  app.use(
    "/api/memberships",
    membershipsRouter,
  );

  app.use(
    "/api",
    (
      _request,
      response,
    ) => {
      const requestId =
        typeof response.locals
          .requestId ===
          "string"
          ? response.locals
              .requestId
          : undefined;

      response
        .status(404)
        .json({
          error:
            "API_ROUTE_NOT_FOUND",

          ...(requestId
            ? {
                requestId,
              }
            : {}),
        });
    },
  );

  /*
   * -------------------------------------------------------
   * Production frontend
   * -------------------------------------------------------
   *
   * Express serves the compiled React application and API
   * from the same origin in production.
   *
   * /api has already reached its authoritative 404 boundary
   * above, so unknown API routes can never fall through to
   * React HTML.
   */
  if (
    env.NODE_ENV ===
    "production"
  ) {
    const frontendDist =
      resolve(
        process.cwd(),
        "dist",
      );

    const frontendIndex =
      resolve(
        frontendDist,
        "index.html",
      );

    if (
      existsSync(
        frontendIndex,
      )
    ) {
      app.use(
        express.static(
          frontendDist,
          {
            index:
              false,

            etag:
              true,

            setHeaders(
              response,
              filePath,
            ) {
              const segments =
                filePath.split(
                  sep,
                );

              if (
                segments.includes(
                  "assets",
                )
              ) {
                response.setHeader(
                  "Cache-Control",
                  "public, max-age=31536000, immutable",
                );

                return;
              }

              if (
                filePath.endsWith(
                  ".html",
                )
              ) {
                response.setHeader(
                  "Cache-Control",
                  "no-cache",
                );

                return;
              }

              response.setHeader(
                "Cache-Control",
                "public, max-age=3600",
              );
            },
          },
        ),
      );

      /*
       * SPA fallback for client-side routes.
       */
      app.use(
        (
          request,
          response,
          next,
        ) => {
          if (
            request.method !==
              "GET" ||
            !request.accepts(
              "html",
            )
          ) {
            next();
            return;
          }

          response.setHeader(
            "Cache-Control",
            "no-cache",
          );

          response.sendFile(
            frontendIndex,
            (error) => {
              if (error) {
                next(
                  error,
                );
              }
            },
          );
        },
      );
    }
  }

  app.use(
    errorHandler,
  );

  return app;
}
