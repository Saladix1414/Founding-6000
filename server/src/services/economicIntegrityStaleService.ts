import {
  ECONOMIC_RECONCILIATION_STALE_MS,
  resolveEconomicReconciliationHealth,
} from "../economics/economicReconciliationHealthPolicy.js";

import {
  getLatestEconomicReconciliationEvidence,
} from "./economicReconciliationEvidenceService.js";

import {
  recordEconomicIntegrityObservation,
} from "./economicIntegrityIncidentService.js";

export const ECONOMIC_STALE_FAILURE_CODE =
  "RECONCILIATION_STALE";

export function evaluateEconomicReconciliationStaleness(
  input?: {
    nowMs?:
      number;
  },
) {
  const latest =
    getLatestEconomicReconciliationEvidence();

  if (!latest) {
    return {
      state:
        "NOT_SEEN" as const,

      stale:
        false,

      incidentResult:
        null,

      ageMs:
        null,
    };
  }

  const now =
    input?.nowMs ??
    Date.now();

  const reconciledAtMs =
    Date.parse(
      latest.reconciledAt,
    );

  const ageMs =
    Number.isFinite(
      reconciledAtMs,
    )
      ? Math.max(
          0,
          now -
            reconciledAtMs,
        )
      : null;

  const state =
    resolveEconomicReconciliationHealth({
      status:
        latest.status,

      reconciledAt:
        latest.reconciledAt,

      nowMs:
        now,
    });

  if (
    state !==
    "STALE"
  ) {
    return {
      state,

      stale:
        false,

      incidentResult:
        null,

      ageMs,
    };
  }

  const incidentResult =
    recordEconomicIntegrityObservation({
      state:
        "STALE",

      reportHash:
        latest.reportHash,

      failingCodes: [
        ECONOMIC_STALE_FAILURE_CODE,
      ],

      evidence: {
        reason:
          ECONOMIC_STALE_FAILURE_CODE,

        reconciledAt:
          latest.reconciledAt,

        observedAt:
          new Date(
            now,
          ).toISOString(),

        ageMs,

        staleThresholdMs:
          ECONOMIC_RECONCILIATION_STALE_MS,
      },
    });

  return {
    state:
      "STALE" as const,

    stale:
      true,

    incidentResult,

    ageMs,
  };
}
