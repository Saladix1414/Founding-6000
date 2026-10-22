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

export const economyRouter =
  Router();

const tokenIdSchema =
  z.coerce
    .number()
    .int()
    .min(1)
    .max(6000);

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
