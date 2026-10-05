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
  registerPrelaunchEmail,
} from "../services/emailService.js";

export const emailRegistrationsRouter =
  Router();

/*
 * Public prelaunch interest form.
 *
 * Keep significantly below the global API limit so
 * automated submission abuse cannot flood the database.
 */
const registrationLimiter =
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
        "EMAIL_REGISTRATION_RATE_LIMITED",
    },
  });

const bodySchema =
  z.object({
    email:
      z.string()
        .trim()
        .email()
        .max(320),
  })
    .strict();

emailRegistrationsRouter.post(
  "/",
  registrationLimiter,
  (
    request,
    response,
  ) => {
    const parsed =
      bodySchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return response
        .status(400)
        .json({
          error:
            "INVALID_EMAIL",
        });
    }

    const registration =
      registerPrelaunchEmail(
        parsed.data.email,
      );

    return response
      .status(201)
      .json({
        registration,
      });
  },
);
