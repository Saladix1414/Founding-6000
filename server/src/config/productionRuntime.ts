import {
  isAbsolute,
} from "node:path";

type ProductionRuntimeConfig = {
  NODE_ENV:
    "development" |
    "test" |
    "production";

  API_HOST:
    string;

  API_PORT:
    number;

  DATABASE_PATH:
    string;

  DATABASE_BACKUP_DIR:
    string;

  DATABASE_BACKUP_RETENTION:
    number;

  FRONTEND_ORIGIN:
    string;

  ADMIN_API_TOKEN?:
    string;

  PUBLIC_CHECKOUT_ENABLED:
    boolean;

  PAYMENT_READINESS:
    boolean;

  REAL_PAYMENTS_ENABLED:
    boolean;

  ETHEREUM_RPC_URL?:
    string;

  SELLER_DISPLAY_NAME?:
    string;

  SUPPORT_EMAIL?:
    string;

  TERMS_URL?:
    string;

  PRIVACY_URL?:
    string;

  REFUND_POLICY_URL?:
    string;
};

function isSecurePublicUrl(
  value:
    string | undefined,
) {
  if (!value) {
    return false;
  }

  try {
    const parsed =
      new URL(
        value,
      );

    if (
      parsed.protocol !==
      "https:"
    ) {
      return false;
    }

    const hostname =
      parsed.hostname
        .toLowerCase();

    if (
      hostname ===
        "localhost" ||
      hostname ===
        "127.0.0.1" ||
      hostname ===
        "::1"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isCanonicalOrigin(
  value:
    string,
) {
  try {
    const parsed =
      new URL(
        value,
      );

    return (
      parsed.origin ===
        value.replace(
          /\/$/,
          "",
        ) &&
      parsed.pathname ===
        "/" &&
      parsed.search ===
        "" &&
      parsed.hash ===
        ""
    );
  } catch {
    return false;
  }
}

function looksLikePlaceholder(
  value:
    string,
) {
  const normalized =
    value
      .trim()
      .toLowerCase();

  return (
    normalized.includes(
      "replace",
    ) ||
    normalized.includes(
      "change-me",
    ) ||
    normalized.includes(
      "changeme",
    ) ||
    normalized.includes(
      "placeholder",
    ) ||
    normalized.includes(
      "example-secret",
    )
  );
}

export function getProductionRuntimeProblems(
  config:
    ProductionRuntimeConfig,
) {
  const problems:
    string[] =
    [];

  if (
    config.NODE_ENV !==
    "production"
  ) {
    return problems;
  }

  if (
    !config.API_HOST
      .trim()
  ) {
    problems.push(
      "API_HOST_REQUIRED",
    );
  }

  if (
    !Number.isInteger(
      config.API_PORT,
    ) ||
    config.API_PORT < 1 ||
    config.API_PORT > 65535
  ) {
    problems.push(
      "API_PORT_INVALID",
    );
  }

  /*
   * Production SQLite must live at an explicit persistent
   * absolute location selected during deployment.
   */
  if (
    !isAbsolute(
      config.DATABASE_PATH,
    )
  ) {
    problems.push(
      "DATABASE_PATH_MUST_BE_ABSOLUTE",
    );
  }

  if (
    !isAbsolute(
      config.DATABASE_BACKUP_DIR,
    )
  ) {
    problems.push(
      "DATABASE_BACKUP_DIR_MUST_BE_ABSOLUTE",
    );
  }

  if (
    !Number.isInteger(
      config.DATABASE_BACKUP_RETENTION,
    ) ||
    config.DATABASE_BACKUP_RETENTION < 1 ||
    config.DATABASE_BACKUP_RETENTION > 100
  ) {
    problems.push(
      "DATABASE_BACKUP_RETENTION_INVALID",
    );
  }

  if (
    !isSecurePublicUrl(
      config.FRONTEND_ORIGIN,
    ) ||
    !isCanonicalOrigin(
      config.FRONTEND_ORIGIN,
    )
  ) {
    problems.push(
      "FRONTEND_ORIGIN_MUST_BE_PUBLIC_HTTPS_ORIGIN",
    );
  }

  if (
    !config.ADMIN_API_TOKEN ||
    config.ADMIN_API_TOKEN
      .length < 32 ||
    looksLikePlaceholder(
      config.ADMIN_API_TOKEN,
    )
  ) {
    problems.push(
      "ADMIN_API_TOKEN_REQUIRED",
    );
  }

  /*
   * Fail closed around payment activation.
   *
   * Public checkout cannot be opened independently from
   * readiness and real payment authority.
   */
  if (
    config.PUBLIC_CHECKOUT_ENABLED &&
    !config.PAYMENT_READINESS
  ) {
    problems.push(
      "PUBLIC_CHECKOUT_REQUIRES_PAYMENT_READINESS",
    );
  }

  if (
    config.PUBLIC_CHECKOUT_ENABLED &&
    !config.REAL_PAYMENTS_ENABLED
  ) {
    problems.push(
      "PUBLIC_CHECKOUT_REQUIRES_REAL_PAYMENTS",
    );
  }

  if (
    config.REAL_PAYMENTS_ENABLED &&
    !config.PAYMENT_READINESS
  ) {
    problems.push(
      "REAL_PAYMENTS_REQUIRE_PAYMENT_READINESS",
    );
  }

  if (
    config.REAL_PAYMENTS_ENABLED &&
    !config.PUBLIC_CHECKOUT_ENABLED
  ) {
    problems.push(
      "REAL_PAYMENTS_REQUIRE_PUBLIC_CHECKOUT",
    );
  }

  /*
   * These become mandatory only when payment readiness
   * is intentionally enabled.
   */
  if (
    config.PAYMENT_READINESS
  ) {
    if (
      !isSecurePublicUrl(
        config.ETHEREUM_RPC_URL,
      )
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_HTTPS_RPC",
      );
    }

    if (
      !config
        .SELLER_DISPLAY_NAME
        ?.trim()
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_SELLER",
      );
    }

    if (
      !config
        .SUPPORT_EMAIL
        ?.trim()
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_SUPPORT_EMAIL",
      );
    }

    if (
      !isSecurePublicUrl(
        config.TERMS_URL,
      )
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_TERMS_URL",
      );
    }

    if (
      !isSecurePublicUrl(
        config.PRIVACY_URL,
      )
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_PRIVACY_URL",
      );
    }

    if (
      !isSecurePublicUrl(
        config.REFUND_POLICY_URL,
      )
    ) {
      problems.push(
        "PAYMENT_READINESS_REQUIRES_REFUND_URL",
      );
    }
  }

  return problems;
}

export function assertProductionRuntime(
  config:
    ProductionRuntimeConfig,
) {
  const problems =
    getProductionRuntimeProblems(
      config,
    );

  if (
    problems.length ===
    0
  ) {
    return;
  }

  const error =
    new Error(
      [
        "PRODUCTION_RUNTIME_INVALID",
        ...problems,
      ].join(
        ":",
      ),
    );

  error.name =
    "ProductionRuntimeError";

  throw error;
}
