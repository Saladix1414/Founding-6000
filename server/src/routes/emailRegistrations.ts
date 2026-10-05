import {
  Router,
} from "express";

import { z } from "zod";

import {
  registerEmail,
} from "../services/emailService.js";

export const emailRegistrationsRouter =
  Router();

const bodySchema =
  z.object({
    email:
      z.string()
        .trim()
        .email()
        .max(320),
  });

emailRegistrationsRouter.post(
  "/",
  (request, response) => {
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

          details:
            parsed.error.flatten(),
        });
    }

    const registration =
      registerEmail(
        parsed.data.email,
      );

    return response
      .status(201)
      .json({
        registration,
      });
  },
);
