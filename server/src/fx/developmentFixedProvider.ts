import { Decimal } from "decimal.js";

import { env } from "../config/env.js";

import type {
  FxProvider,
  FxRateSnapshot,
} from "./types.js";

export class DevelopmentFixedFxProvider
  implements FxProvider
{
  async getUsdArsRate():
    Promise<FxRateSnapshot>
  {
    if (
      env.NODE_ENV === "production"
    ) {
      throw new Error(
        "DEVELOPMENT_FX_PROVIDER_FORBIDDEN_IN_PRODUCTION",
      );
    }

    const configuredRate =
      env.DEV_FX_RATE_ARS_PER_USD;

    if (!configuredRate) {
      throw new Error(
        "FX_RATE_NOT_CONFIGURED",
      );
    }

    let rate: Decimal;

    try {
      rate =
        new Decimal(
          configuredRate,
        );
    } catch {
      throw new Error(
        "INVALID_FX_RATE",
      );
    }

    if (
      !rate.isFinite() ||
      rate.lte(0)
    ) {
      throw new Error(
        "INVALID_FX_RATE",
      );
    }

    return {
      source:
        "DEVELOPMENT_FIXED_RATE",

      baseCurrency:
        "USD",

      quoteCurrency:
        "ARS",

      rateArsPerUsd:
        rate.toString(),

      observedAt:
        new Date().toISOString(),

      metadata: {
        authoritative:
          false,

        environment:
          env.NODE_ENV,

        warning:
          "Development/test rate only",
      },
    };
  }
}
