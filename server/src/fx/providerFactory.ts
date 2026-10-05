import { env } from "../config/env.js";

import {
  DevelopmentFixedFxProvider,
} from "./developmentFixedProvider.js";

import type {
  FxProvider,
} from "./types.js";

export function getFxProvider():
  FxProvider
{
  switch (env.FX_PROVIDER) {
    case "development-fixed":
      return new DevelopmentFixedFxProvider();

    default:
      throw new Error(
        "UNSUPPORTED_FX_PROVIDER",
      );
  }
}
