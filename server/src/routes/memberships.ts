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
  requireAdminAuthority,
} from "../middleware/adminAuthority.js";

import {
  activateMembership,
  getMembershipByPublicId,
} from "../services/membershipService.js";

export const membershipsRouter =
  Router();

/*
 * Membership IDs are generated as:
 *
 * mem_<UUID>
 *
 * They are high-entropy public references,
 * not authentication credentials.
 */
const membershipPublicIdSchema =
  z.string()
    .trim()
    .regex(
      /^mem_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

const activationBodySchema =
  z.object({
    activatedAt:
      z.string()
        .datetime()
        .optional(),
  })
    .strict();

/*
 * Public membership reads expose no email,
 * auth secret, payment credential, or wallet
 * private information.
 *
 * Enumeration is additionally constrained by
 * UUID entropy and endpoint rate limiting.
 */
const membershipReadLimiter =
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
        "MEMBERSHIP_RATE_LIMITED",
    },
  });

/*
 * Administrative activation gets a much tighter
 * brute-force / abuse budget.
 */
const membershipActivationLimiter =
  rateLimit({
    windowMs:
      60_000,

    limit:
      10,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      error:
        "MEMBERSHIP_RATE_LIMITED",
    },
  });

membershipsRouter.get(
  "/:publicId",

  membershipReadLimiter,

  (
    request,
    response,
  ) => {
    const parsedPublicId =
      membershipPublicIdSchema
        .safeParse(
          request.params.publicId,
        );

    if (!parsedPublicId.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_MEMBERSHIP_ID",
        });
    }

    const membership =
      getMembershipByPublicId(
        parsedPublicId.data,
      );

    if (!membership) {
      return response
        .status(404)
        .json({
          error:
            "MEMBERSHIP_NOT_FOUND",
        });
    }

    return response.json({
      membership,
    });
  },
);

/*
 * SECURITY BOUNDARY
 * ---------------------------------------------------------
 * Membership activation is NEVER buyer-controlled.
 *
 * Authentication executes before public-id/body validation
 * so an unauthenticated caller cannot use this endpoint as
 * a membership existence/format oracle.
 *
 * The token is backend-only and must never be exposed in
 * frontend code or a VITE_* variable.
 */
membershipsRouter.post(
  "/:publicId/activate",

  membershipActivationLimiter,

  requireAdminAuthority,

  (
    request,
    response,
  ) => {
    const parsedPublicId =
      membershipPublicIdSchema
        .safeParse(
          request.params.publicId,
        );

    if (!parsedPublicId.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_MEMBERSHIP_ID",
        });
    }

    const parsedBody =
      activationBodySchema
        .safeParse(
          request.body ?? {},
        );

    if (!parsedBody.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_MEMBERSHIP_ACTIVATION_REQUEST",
        });
    }

    try {
      const result =
        activateMembership({
          membershipPublicId:
            parsedPublicId.data,

          activatedAt:
            parsedBody.data
              .activatedAt
              ? new Date(
                  parsedBody.data
                    .activatedAt,
                )
              : undefined,
        });

      return response.json(
        result,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "MEMBERSHIP_NOT_FOUND"
      ) {
        return response
          .status(404)
          .json({
            error:
              "MEMBERSHIP_NOT_FOUND",
          });
      }

      if (
        error instanceof Error &&
        error.message.startsWith(
          "MEMBERSHIP_NOT_ACTIVATABLE_FROM_",
        )
      ) {
        return response
          .status(409)
          .json({
            error:
              "MEMBERSHIP_NOT_ACTIVATABLE",
          });
      }

      throw error;
    }
  },
);
