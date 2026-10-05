import {
  Router,
} from "express";

import { z } from "zod";

import {
  assertArsQuoteUsable,
  createArsQuote,
  getArsQuote,
} from "../services/quoteService.js";

export const quotesRouter =
  Router();

const createQuoteSchema =
  z.object({
    orderPublicId:
      z.string()
        .trim()
        .min(5)
        .max(100),
  });

quotesRouter.post(
  "/ars",
  async (
    request,
    response,
    next,
  ) => {
    const parsed =
      createQuoteSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_QUOTE_REQUEST",

          details:
            parsed.error.flatten(),
        });
    }

    const idempotencyKey =
      request.header(
        "Idempotency-Key",
      );

    if (
      idempotencyKey &&
      idempotencyKey.length > 128
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_IDEMPOTENCY_KEY",
        });
    }

    try {
      const result =
        await createArsQuote({
          orderPublicId:
            parsed.data.orderPublicId,

          idempotencyKey:
            idempotencyKey ?? null,
        });

      return response
        .status(
          result.idempotentReplay
            ? 200
            : 201,
        )
        .json(result);
    } catch (error) {
      if (
        error instanceof Error
      ) {
        if (
          error.message ===
          "ORDER_NOT_FOUND"
        ) {
          return response
            .status(404)
            .json({
              error:
                "ORDER_NOT_FOUND",
            });
        }

        if (
          error.message ===
          "ORDER_NOT_QUOTABLE"
        ) {
          return response
            .status(409)
            .json({
              error:
                "ORDER_NOT_QUOTABLE",
            });
        }

        if (
          error.message ===
          "FX_RATE_NOT_CONFIGURED"
        ) {
          return response
            .status(503)
            .json({
              error:
                "FX_RATE_NOT_CONFIGURED",
            });
        }

        if (
          error.message ===
          "DEVELOPMENT_FX_PROVIDER_FORBIDDEN_IN_PRODUCTION"
        ) {
          return response
            .status(503)
            .json({
              error:
                "FX_PROVIDER_NOT_PRODUCTION_READY",
            });
        }
      }

      return next(error);
    }
  },
);

quotesRouter.get(
  "/ars/:publicId",
  (
    request,
    response,
  ) => {
    const quote =
      getArsQuote(
        request.params.publicId,
      );

    if (!quote) {
      return response
        .status(404)
        .json({
          error:
            "QUOTE_NOT_FOUND",
        });
    }

    return response.json({
      quote,
    });
  },
);

quotesRouter.get(
  "/ars/:publicId/validate",
  (
    request,
    response,
  ) => {
    try {
      const quote =
        assertArsQuoteUsable(
          request.params.publicId,
        );

      return response.json({
        usable: true,
        quote,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "QUOTE_NOT_FOUND"
      ) {
        return response
          .status(404)
          .json({
            usable: false,
            error:
              "QUOTE_NOT_FOUND",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "QUOTE_NOT_ACTIVE"
      ) {
        return response
          .status(409)
          .json({
            usable: false,
            error:
              "QUOTE_NOT_ACTIVE",
          });
      }

      throw error;
    }
  },
);
