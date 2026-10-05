import {
  Router,
} from "express";

import { z } from "zod";

import {
  createOrder,
  getOrderByPublicId,
} from "../services/orderService.js";

export const ordersRouter =
  Router();

const createOrderSchema =
  z.object({
    email:
      z.string()
        .trim()
        .email()
        .max(320),
  });

ordersRouter.post(
  "/",
  (request, response) => {
    const parsed =
      createOrderSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_ORDER_REQUEST",

          details:
            parsed.error.flatten(),
        });
    }

    const idempotencyHeader =
      request.header(
        "Idempotency-Key",
      );

    if (
      idempotencyHeader &&
      idempotencyHeader.length > 128
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
        createOrder({
          email:
            parsed.data.email,

          idempotencyKey:
            idempotencyHeader ?? null,
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
          "NO_ACTIVE_PHASE"
      ) {
        return response
          .status(409)
          .json({
            error:
              "NO_ACTIVE_CAMPAIGN_PHASE",
          });
      }

      throw error;
    }
  },
);

ordersRouter.get(
  "/:publicId",
  (request, response) => {
    const publicId =
      request.params.publicId;

    const order =
      getOrderByPublicId(
        publicId,
      );

    if (!order) {
      return response
        .status(404)
        .json({
          error:
            "ORDER_NOT_FOUND",
        });
    }

    return response.json({
      order: {
        publicId:
          order.publicId,

        email:
          order.email,

        phase: {
          code:
            order.phaseCode,

          name:
            order.phaseName,
        },

        referencePriceUsd:
          order.referencePriceUsd,

        status:
          order.status,

        createdAt:
          order.createdAt,

        updatedAt:
          order.updatedAt,
      },
    });
  },
);
