import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  env,
} from "../config/env.js";

/*
 * Development and test environments retain access
 * to the checkout APIs so existing regression suites
 * and local development remain functional.
 *
 * Production fails closed unless explicitly enabled.
 */
export function isPublicCheckoutOpen() {
  if (
    env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  return (
    env.PUBLIC_CHECKOUT_ENABLED
  );
}

export function arePublicPaymentsOpen() {
  if (
    env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  return (
    env.PUBLIC_CHECKOUT_ENABLED &&
    env.PAYMENT_READINESS &&
    env.REAL_PAYMENTS_ENABLED
  );
}

export function requirePublicCheckoutEnabled(
  _request:
    Request,

  response:
    Response,

  next:
    NextFunction,
) {
  if (
    isPublicCheckoutOpen()
  ) {
    next();
    return;
  }

  response
    .status(503)
    .json({
      error:
        "CHECKOUT_NOT_OPEN",

      message:
        "Public reservations are not open yet.",
    });
}

export function requirePublicPaymentsEnabled(
  _request:
    Request,

  response:
    Response,

  next:
    NextFunction,
) {
  if (
    arePublicPaymentsOpen()
  ) {
    next();
    return;
  }

  response
    .status(503)
    .json({
      error:
        "PAYMENTS_NOT_OPEN",

      message:
        "Public payments are not open yet.",
    });
}
