import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import type {
  RequestHandler,
} from "express";

import {
  env,
} from "../config/env.js";

export type AdminAuthorityResult =
  | "AUTHORIZED"
  | "UNAUTHORIZED"
  | "NOT_CONFIGURED";

function digestSecret(
  value: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest();
}

/*
 * We hash both values before timingSafeEqual so
 * comparison length is always identical.
 *
 * This avoids ordinary string comparison of the
 * administrative secret.
 */
export function verifyAdminBearerAuthorization(
  authorizationHeader:
    string | undefined,
  configuredToken:
    string | undefined,
): AdminAuthorityResult {
  if (!configuredToken) {
    return "NOT_CONFIGURED";
  }

  if (!authorizationHeader) {
    return "UNAUTHORIZED";
  }

  const match =
    authorizationHeader.match(
      /^Bearer[ \t]+(.+)$/i,
    );

  if (!match) {
    return "UNAUTHORIZED";
  }

  const suppliedToken =
    match[1]?.trim();

  if (
    !suppliedToken ||
    suppliedToken.length < 32 ||
    suppliedToken.length > 512
  ) {
    return "UNAUTHORIZED";
  }

  const suppliedDigest =
    digestSecret(
      suppliedToken,
    );

  const configuredDigest =
    digestSecret(
      configuredToken,
    );

  return timingSafeEqual(
    suppliedDigest,
    configuredDigest,
  )
    ? "AUTHORIZED"
    : "UNAUTHORIZED";
}

export const requireAdminAuthority:
  RequestHandler =
  (
    request,
    response,
    next,
  ) => {
    const result =
      verifyAdminBearerAuthorization(
        request.header(
          "Authorization",
        ),
        env.ADMIN_API_TOKEN,
      );

    if (
      result ===
      "NOT_CONFIGURED"
    ) {
      return response
        .status(503)
        .json({
          error:
            "ADMIN_AUTHORITY_UNAVAILABLE",
        });
    }

    if (
      result !==
      "AUTHORIZED"
    ) {
      response.setHeader(
        "WWW-Authenticate",
        'Bearer realm="founding-admin"',
      );

      return response
        .status(401)
        .json({
          error:
            "ADMIN_AUTHENTICATION_REQUIRED",
        });
    }

    return next();
  };
