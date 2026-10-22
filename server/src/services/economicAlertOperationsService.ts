import {
  db,
} from "../db/database.js";

import {
  env,
} from "../config/env.js";

import {
  ensureEconomicAlertOutboxSchema,
} from "../db/economicAlertOutboxSchema.js";

import {
  ECONOMIC_ALERT_OPERATIONS_VERSION,
  resolveEconomicAlertDeliveryHealth,
} from "../economics/economicAlertOperationsPolicy.js";

ensureEconomicAlertOutboxSchema();

type AlertAggregateRow = {
  total:
    number;

  pending:
    number;

  retrying:
    number;

  delivered:
    number;

  failed:
    number;

  leased:
    number;
};

type AlertTimestampRow = {
  lastCreatedAt:
    string |
    null;

  lastDeliveredAt:
    string |
    null;

  lastFailedAt:
    string |
    null;

  nextRetryAt:
    string |
    null;
};

export function getEconomicAlertOperationsSnapshot(
  input?: {
    nowMs?:
      number;
  },
) {
  ensureEconomicAlertOutboxSchema();

  const now =
    input?.nowMs ??
    Date.now();

  const nowIso =
    new Date(
      now,
    ).toISOString();

  const aggregates =
    db.prepare(`
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'PENDING'
            THEN 1
            ELSE 0
          END
        ) AS pending,

        SUM(
          CASE
            WHEN
              status = 'PENDING'
              AND next_attempt_at IS NOT NULL
            THEN 1
            ELSE 0
          END
        ) AS retrying,

        SUM(
          CASE
            WHEN status = 'DELIVERED'
            THEN 1
            ELSE 0
          END
        ) AS delivered,

        SUM(
          CASE
            WHEN status = 'FAILED'
            THEN 1
            ELSE 0
          END
        ) AS failed,

        SUM(
          CASE
            WHEN
              status = 'PENDING'
              AND lease_until IS NOT NULL
              AND lease_until > ?
            THEN 1
            ELSE 0
          END
        ) AS leased

      FROM economic_alert_outbox
    `).get(
      nowIso,
    ) as
      AlertAggregateRow;

  const timestamps =
    db.prepare(`
      SELECT
        MAX(created_at)
          AS lastCreatedAt,

        MAX(delivered_at)
          AS lastDeliveredAt,

        MAX(failed_at)
          AS lastFailedAt,

        MIN(
          CASE
            WHEN
              status = 'PENDING'
              AND next_attempt_at IS NOT NULL
            THEN next_attempt_at
            ELSE NULL
          END
        )
          AS nextRetryAt

      FROM economic_alert_outbox
    `).get() as
      AlertTimestampRow;

  const total =
    Number(
      aggregates
        ?.total ??
        0,
    );

  const pending =
    Number(
      aggregates
        ?.pending ??
        0,
    );

  const retrying =
    Number(
      aggregates
        ?.retrying ??
        0,
    );

  const delivered =
    Number(
      aggregates
        ?.delivered ??
        0,
    );

  const failed =
    Number(
      aggregates
        ?.failed ??
        0,
    );

  const leased =
    Number(
      aggregates
        ?.leased ??
        0,
    );

  const health =
    resolveEconomicAlertDeliveryHealth({
      enabled:
        env
          .ECONOMIC_ALERT_DELIVERY_ENABLED,

      pending,

      retrying,

      failed,

      leased,
    });

  return {
    version:
      ECONOMIC_ALERT_OPERATIONS_VERSION,

    enabled:
      env
        .ECONOMIC_ALERT_DELIVERY_ENABLED,

    health,

    counts: {
      total,

      pending,

      retrying,

      delivered,

      failed,

      leased,
    },

    timestamps: {
      lastCreatedAt:
        timestamps
          ?.lastCreatedAt ??
        null,

      lastDeliveredAt:
        timestamps
          ?.lastDeliveredAt ??
        null,

      lastFailedAt:
        timestamps
          ?.lastFailedAt ??
        null,

      nextRetryAt:
        timestamps
          ?.nextRetryAt ??
        null,
    },

    authority: {
      governance:
        false,

      reserveMutation:
        false,

      blockchainTransaction:
        false,

      treasuryAction:
        false,

      autoRepair:
        false,
    },
  };
}
