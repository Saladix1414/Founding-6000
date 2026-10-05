import type {
  ErrorRequestHandler,
} from "express";

type HttpErrorLike = {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
};

function safeStatus(
  error: HttpErrorLike,
) {
  if (
    error.type ===
      "entity.too.large"
  ) {
    return 413;
  }

  if (
    error.type ===
      "entity.parse.failed"
  ) {
    return 400;
  }

  if (
    error.message ===
      "CORS_ORIGIN_DENIED"
  ) {
    return 403;
  }

  const candidate =
    error.statusCode ??
    error.status;

  if (
    typeof candidate ===
      "number" &&
    candidate >= 400 &&
    candidate <= 599
  ) {
    return candidate;
  }

  return 500;
}

function publicErrorCode(
  status: number,
) {
  switch (status) {
    case 400:
      return "INVALID_REQUEST";

    case 403:
      return "FORBIDDEN";

    case 413:
      return "PAYLOAD_TOO_LARGE";

    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

export const errorHandler:
  ErrorRequestHandler =
  (
    error,
    _request,
    response,
    _next,
  ) => {
    const typedError =
      error as HttpErrorLike;

    const status =
      safeStatus(
        typedError,
      );

    const requestId =
      typeof response.locals
        .requestId === "string"
        ? response.locals
            .requestId
        : undefined;

    /*
     * Do not print the entire error object,
     * request body, headers, stack,
     * secrets or RPC URLs.
     */
    console.error({
      event:
        "HTTP_REQUEST_ERROR",

      requestId,

      status,

      errorType:
        typedError.type ??
        error?.constructor
          ?.name ??
        "Error",
    });

    response
      .status(status)
      .json({
        error:
          publicErrorCode(
            status,
          ),

        ...(requestId
          ? {
              requestId,
            }
          : {}),
      });
  };
