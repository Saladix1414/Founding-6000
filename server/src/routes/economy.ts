import {
  Router,
} from "express";

import {
  rateLimit,
} from "express-rate-limit";

import {
  z,
} from "zod";

import {
  getTokenEconomy,
} from "../services/economyService.js";

import {
  getTokenEconomyHistory,
} from "../services/economyHistoryService.js";

import {
  getEconomicOperationsView,
} from "../services/economicOperationsViewService.js";

export const economyRouter =
  Router();

const tokenIdSchema =
  z.coerce
    .number()
    .int()
    .min(1)
    .max(6000);

const historyQuerySchema =
  z.object({
    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25),

    cursor:
      z.string()
        .trim()
        .min(1)
        .max(128)
        .optional(),
  })
    .strict();

const economyReadLimiter =
  rateLimit({
    windowMs:
      60_000,

    limit:
      120,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      error:
        "ECONOMY_RATE_LIMITED",
    },
  });

/*
 * Public-safe economic integrity / operations view.
 *
 * Read-only transparency surface.
 *
 * Deliberately excludes:
 * - PII
 * - order/payment identifiers
 * - incident fingerprints
 * - raw evidence_json
 * - detailed reconciliation check payloads
 * - signer/private material
 * - mutation controls
 */
economyRouter.get(
  "/operations",

  economyReadLimiter,

  (
    _request,
    response,
  ) => {
    const operations =
      getEconomicOperationsView();

    return response.json({
      operations,
    });
  },
);

/*
 * Public historical economy endpoint.
 *
 * Keyset pagination uses the public snapshot hash
 * as an opaque cursor.
 *
 * Snapshots are returned newest-first.
 */
economyRouter.get(
  "/tokens/:tokenId/history",

  economyReadLimiter,

  (
    request,
    response,
  ) => {
    const parsedTokenId =
      tokenIdSchema.safeParse(
        request.params.tokenId,
      );

    if (
      !parsedTokenId.success
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_TOKEN_ID",
        });
    }

    const parsedQuery =
      historyQuerySchema.safeParse(
        request.query,
      );

    if (
      !parsedQuery.success
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_ECONOMY_HISTORY_QUERY",
        });
    }

    try {
      const history =
        getTokenEconomyHistory({
          tokenId:
            parsedTokenId.data,

          limit:
            parsedQuery
              .data
              .limit,

          cursor:
            parsedQuery
              .data
              .cursor ??
            null,
        });

      if (!history) {
        return response
          .status(404)
          .json({
            error:
              "TOKEN_ECONOMY_NOT_FOUND",
          });
      }

      return response.json({
        history,
      });
    } catch (error) {
      if (
        error instanceof
          Error &&
        error.message ===
          "ECONOMY_HISTORY_CURSOR_NOT_FOUND"
      ) {
        return response
          .status(400)
          .json({
            error:
              "INVALID_ECONOMY_HISTORY_CURSOR",
          });
      }

      throw error;
    }
  },
);

/*
 * Public economic endpoint.
 *
 * Deliberately exposes only public-safe collection,
 * reserve, NAV and Proof-of-Reserve information.
 *
 * Never expose:
 * - customer email
 * - private order ids
 * - signer material
 * - auth credentials
 * - payment sender identity
 */
economyRouter.get(
  "/tokens/:tokenId",

  economyReadLimiter,

  (
    request,
    response,
  ) => {
    const parsed =
      tokenIdSchema.safeParse(
        request.params.tokenId,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_TOKEN_ID",
        });
    }

    const economy =
      getTokenEconomy(
        parsed.data,
      );

    if (!economy) {
      return response
        .status(404)
        .json({
          error:
            "TOKEN_ECONOMY_NOT_FOUND",
        });
    }

    return response.json({
      economy,
    });
  },
);
