import {
  Router,
} from "express";

import {
  rateLimit,
} from "express-rate-limit";

import {
  isHexString,
} from "ethers";

import { z } from "zod";

import {
  createUsdtPaymentAttempt,
  getUsdtPaymentAttempt,
  submitUsdtTransactionHash,
} from "../services/usdtPaymentService.js";

export const usdtPaymentsRouter =
  Router();

/*
 * Canonical public identifiers.
 *
 * Founding order:
 * F6K- + 12 hexadecimal chars
 *
 * USDT payment attempt:
 * PAY-USDT- + 12 hexadecimal chars
 */
const orderPublicIdSchema =
  z.string()
    .trim()
    .regex(
      /^F6K-[A-F0-9]{12}$/,
    );

const paymentPublicIdSchema =
  z.string()
    .trim()
    .regex(
      /^PAY-USDT-[A-F0-9]{12}$/,
    );

const idempotencyKeySchema =
  z.string()
    .trim()
    .min(8)
    .max(128)
    .regex(
      /^[A-Za-z0-9._:-]+$/,
    );

const attemptSchema =
  z.object({
    orderPublicId:
      orderPublicIdSchema,
  })
    .strict();

const txSchema =
  z.object({
    txHash:
      z.string()
        .trim()
        .min(66)
        .max(66),
  })
    .strict();

/*
 * Endpoint-specific abuse controls.
 *
 * General /api rate limit still applies in app.ts.
 */
const createAttemptLimiter =
  rateLimit({
    windowMs:
      60_000,

    limit:
      12,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      error:
        "PAYMENT_RATE_LIMITED",
    },
  });

const readAttemptLimiter =
  rateLimit({
    windowMs:
      60_000,

    limit:
      60,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      error:
        "PAYMENT_RATE_LIMITED",
    },
  });

const submitHashLimiter =
  rateLimit({
    windowMs:
      60_000,

    limit:
      20,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      error:
        "PAYMENT_RATE_LIMITED",
    },
  });

usdtPaymentsRouter.post(
  "/attempts",
  createAttemptLimiter,
  (
    request,
    response,
  ) => {
    const parsed =
      attemptSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_USDT_ATTEMPT_REQUEST",
        });
    }

    const rawIdempotencyKey =
      request.header(
        "Idempotency-Key",
      );

    if (!rawIdempotencyKey) {
      return response
        .status(400)
        .json({
          error:
            "IDEMPOTENCY_KEY_REQUIRED",
        });
    }

    const parsedIdempotencyKey =
      idempotencyKeySchema
        .safeParse(
          rawIdempotencyKey,
        );

    if (
      !parsedIdempotencyKey
        .success
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
        createUsdtPaymentAttempt({
          orderPublicId:
            parsed.data
              .orderPublicId,

          idempotencyKey:
            parsedIdempotencyKey
              .data,
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
        error instanceof Error &&
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
        error instanceof Error &&
        error.message ===
          "ORDER_NOT_PAYABLE"
      ) {
        return response
          .status(409)
          .json({
            error:
              "ORDER_NOT_PAYABLE",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "IDEMPOTENCY_KEY_CONFLICT"
      ) {
        return response
          .status(409)
          .json({
            error:
              "IDEMPOTENCY_KEY_CONFLICT",
          });
      }

      throw error;
    }
  },
);

usdtPaymentsRouter.get(
  "/attempts/:publicId",
  readAttemptLimiter,
  (
    request,
    response,
  ) => {
    const parsedPublicId =
      paymentPublicIdSchema
        .safeParse(
          request.params
            .publicId,
        );

    if (
      !parsedPublicId.success
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_PAYMENT_ATTEMPT_ID",
        });
    }

    const attempt =
      getUsdtPaymentAttempt(
        parsedPublicId.data,
      );

    if (!attempt) {
      return response
        .status(404)
        .json({
          error:
            "PAYMENT_ATTEMPT_NOT_FOUND",
        });
    }

    return response.json({
      attempt,
    });
  },
);

usdtPaymentsRouter.post(
  "/attempts/:publicId/submit",
  submitHashLimiter,
  (
    request,
    response,
  ) => {
    const parsedPublicId =
      paymentPublicIdSchema
        .safeParse(
          request.params
            .publicId,
        );

    if (
      !parsedPublicId.success
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_PAYMENT_ATTEMPT_ID",
        });
    }

    const parsed =
      txSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_TX_HASH",
        });
    }

    if (
      !isHexString(
        parsed.data.txHash,
        32,
      )
    ) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_TX_HASH",
        });
    }

    try {
      const result =
        submitUsdtTransactionHash({
          paymentAttemptPublicId:
            parsedPublicId.data,

          txHash:
            parsed.data.txHash,
        });

      return response.json({
        attempt:
          result.attempt,

        idempotentReplay:
          result.idempotentReplay,

        paymentVerified:
          false,

        settlementCreated:
          false,

        message:
          "Transaction hash received as evidence only. Payment has not been verified.",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "PAYMENT_ATTEMPT_NOT_FOUND"
      ) {
        return response
          .status(404)
          .json({
            error:
              "PAYMENT_ATTEMPT_NOT_FOUND",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "TX_HASH_ALREADY_SUBMITTED"
      ) {
        return response
          .status(409)
          .json({
            error:
              "TX_HASH_ALREADY_SUBMITTED",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "PAYMENT_ATTEMPT_ALREADY_VERIFIED"
      ) {
        return response
          .status(409)
          .json({
            error:
              "PAYMENT_ATTEMPT_ALREADY_VERIFIED",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "PAYMENT_ATTEMPT_NOT_SUBMITTABLE"
      ) {
        return response
          .status(409)
          .json({
            error:
              "PAYMENT_ATTEMPT_NOT_SUBMITTABLE",
          });
      }

      if (
        error instanceof Error &&
        error.message ===
          "PAYMENT_ATTEMPT_HASH_LOCKED"
      ) {
        return response
          .status(409)
          .json({
            error:
              "PAYMENT_ATTEMPT_HASH_LOCKED",
          });
      }

      throw error;
    }
  },
);
