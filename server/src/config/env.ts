import "dotenv/config";

import {
  z,
} from "zod";

const envSchema =
  z.object({
    NODE_ENV:
      z.enum([
        "development",
        "test",
        "production",
      ])
        .default(
          "development",
        ),

    /*
     * API_HOST remains optional so:
     *
     * development/test → 127.0.0.1
     * production       → 0.0.0.0
     *
     * Explicit configuration always wins.
     */
    API_HOST:
      z.string()
        .trim()
        .min(1)
        .optional(),

    /*
     * PORT is supported for cloud platforms.
     *
     * Resolution order:
     * PORT → API_PORT → 8787
     */
    PORT:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .optional(),

    API_PORT:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .optional(),

    DATABASE_PATH:
      z.string()
        .trim()
        .min(1)
        .default(
          "./server/data/founding-6000.sqlite",
        ),

    DATABASE_BACKUP_DIR:
      z.string()
        .trim()
        .min(1)
        .default(
          "./server/backups",
        ),

    DATABASE_BACKUP_RETENTION:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(
          14,
        ),

    FRONTEND_ORIGIN:
      z.string()
        .trim()
        .min(1)
        .default(
          "http://localhost:5173",
        ),

    TRUST_PROXY:
      z.enum([
        "true",
        "false",
      ])
        .default(
          "false",
        ),

    PUBLIC_CHECKOUT_ENABLED:
      z.enum([
        "true",
        "false",
      ])
        .default(
          "false",
        ),

    PAYMENT_READINESS:
      z.enum([
        "true",
        "false",
      ])
        .default(
          "false",
        ),

    REAL_PAYMENTS_ENABLED:
      z.enum([
        "true",
        "false",
      ])
        .default(
          "false",
        ),

    FX_PROVIDER:
      z.enum([
        "development-fixed",
      ])
        .default(
          "development-fixed",
        ),

    DEV_FX_RATE_ARS_PER_USD:
      z.string()
        .optional(),

    FX_QUOTE_TTL_SECONDS:
      z.coerce
        .number()
        .int()
        .min(30)
        .max(3600)
        .default(
          900,
        ),

    USDT_NETWORK:
      z.literal(
        "ethereum-mainnet",
      )
        .default(
          "ethereum-mainnet",
        ),

    USDT_CHAIN_ID:
      z.coerce
        .number()
        .int()
        .default(
          1,
        ),

    USDT_TOKEN_CONTRACT:
      z.string()
        .default(
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        ),

    USDT_DECIMALS:
      z.coerce
        .number()
        .int()
        .default(
          6,
        ),

    USDT_RECEIVER_ADDRESS:
      z.string()
        .default(
          "0xe695Bc03A11D5DE3f5e38B4acB66D13AEDE3B840",
        ),

    ETHEREUM_RPC_URL:
      z.string()
        .trim()
        .optional(),

    USDT_CONFIRMATIONS_REQUIRED:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(128)
        .default(
          12,
        ),

    /*
     * Backend-only credential.
     *
     * Never expose through VITE_*, frontend responses
     * or application logs.
     */
    ADMIN_API_TOKEN:
      z.string()
        .trim()
        .min(32)
        .max(512)
        .optional(),

    SELLER_DISPLAY_NAME:
      z.string()
        .trim()
        .optional(),

    SUPPORT_EMAIL:
      z.string()
        .email()
        .optional(),

    TERMS_URL:
      z.string()
        .url()
        .optional(),

    PRIVACY_URL:
      z.string()
        .url()
        .optional(),

    REFUND_POLICY_URL:
      z.string()
        .url()
        .optional(),
  });

const parsed =
  envSchema.safeParse(
    process.env,
  );

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten(),
  );

  process.exit(
    1,
  );
}

const resolvedApiHost =
  parsed.data.API_HOST ??
  (
    parsed.data.NODE_ENV ===
      "production"
      ? "0.0.0.0"
      : "127.0.0.1"
  );

const resolvedApiPort =
  parsed.data.PORT ??
  parsed.data.API_PORT ??
  8787;

export const env = {
  ...parsed.data,

  API_HOST:
    resolvedApiHost,

  API_PORT:
    resolvedApiPort,

  PUBLIC_CHECKOUT_ENABLED:
    parsed.data
      .PUBLIC_CHECKOUT_ENABLED ===
    "true",

  PAYMENT_READINESS:
    parsed.data
      .PAYMENT_READINESS ===
    "true",

  REAL_PAYMENTS_ENABLED:
    parsed.data
      .REAL_PAYMENTS_ENABLED ===
    "true",

  TRUST_PROXY:
    parsed.data
      .TRUST_PROXY ===
    "true",
};
