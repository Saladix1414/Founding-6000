import {
  env,
} from "../config/env.js";

import type {
  EconomicAlertDeliveryAdapter,
  EconomicAlertDeliveryPayload,
} from "./economicAlertDeliveryService.js";

const WEBHOOK_TIMEOUT_MS =
  10_000;

export function createEconomicAlertWebhookAdapter():
  EconomicAlertDeliveryAdapter {
  const url =
    env
      .ECONOMIC_ALERT_WEBHOOK_URL
      ?.trim();

  const bearerToken =
    env
      .ECONOMIC_ALERT_WEBHOOK_BEARER_TOKEN
      ?.trim();

  if (!url) {
    throw new Error(
      "ECONOMIC_ALERT_WEBHOOK_URL_NOT_CONFIGURED",
    );
  }

  if (!bearerToken) {
    throw new Error(
      "ECONOMIC_ALERT_WEBHOOK_BEARER_TOKEN_NOT_CONFIGURED",
    );
  }

  const parsed =
    new URL(
      url,
    );

  if (
    parsed.protocol !==
    "https:"
  ) {
    throw new Error(
      "ECONOMIC_ALERT_WEBHOOK_REQUIRES_HTTPS",
    );
  }

  return {
    async deliver(
      payload:
        EconomicAlertDeliveryPayload,
    ) {
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => {
            controller.abort();
          },
          WEBHOOK_TIMEOUT_MS,
        );

      try {
        const response =
          await fetch(
            url,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "Authorization":
                  `Bearer ${bearerToken}`,

                "X-OriginX-Alert-Policy":
                  payload.policyVersion,

                "X-OriginX-Alert-Key":
                  payload.alertKey,
              },

              body:
                JSON.stringify(
                  payload,
                ),

              signal:
                controller.signal,
            },
          );

        if (
          !response.ok
        ) {
          throw new Error(
            `ECONOMIC_ALERT_WEBHOOK_HTTP_${response.status}`,
          );
        }
      } finally {
        clearTimeout(
          timeout,
        );
      }
    },
  };
}
