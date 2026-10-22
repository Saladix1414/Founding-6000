import {
  db,
} from "../db/database.js";

import {
  ECONOMIC_OPERATIONS_VIEW_VERSION,
  calculateCoverageBps,
  resolvePublicEconomicIntegrityState,
} from "../economics/economicOperationsViewPolicy.js";

import {
  getLatestEconomicReconciliationEvidence,
} from "./economicReconciliationEvidenceService.js";

import {
  getLatestEconomicIntegrityIncidentEvent,
} from "./economicIntegrityIncidentService.js";

import {
  getEconomicAlertOperationsSnapshot,
} from "./economicAlertOperationsService.js";


type PublicIncidentEventRow = {
  eventType:
    "OPENED" |
    "OBSERVED" |
    "RESOLVED";

  severity:
    "WARNING" |
    "CRITICAL" |
    null;

  integrityState:
    "OK" |
    "WARNING" |
    "CRITICAL" |
    "STALE";

  reportHash:
    string |
    null;

  createdAt:
    string;
};

function getRecentPublicIncidentEvents(
  limit:
    number,
) {
  const rows =
    db.prepare(`
      SELECT
        event_type
          AS eventType,

        severity,

        integrity_state
          AS integrityState,

        report_hash
          AS reportHash,

        created_at
          AS createdAt

      FROM economic_integrity_incident_events

      ORDER BY
        rowid DESC

      LIMIT ?
    `).all(
      limit,
    ) as
      PublicIncidentEventRow[];

  return rows.map(
    (row) => ({
      eventType:
        row.eventType,

      severity:
        row.severity,

      integrityState:
        row.integrityState,

      reportHash:
        row.reportHash,

      createdAt:
        row.createdAt,
    }),
  );
}

export function getEconomicOperationsView() {
  const reconciliation =
    getLatestEconomicReconciliationEvidence();

  const alertDelivery =
    getEconomicAlertOperationsSnapshot();

  const latestIncident =
    getLatestEconomicIntegrityIncidentEvent();

  const reconciliationState =
    resolvePublicEconomicIntegrityState({
      reconciliationStatus:
        reconciliation?.status ??
        null,

      reconciledAt:
        reconciliation
          ?.reconciledAt ??
        null,
    });

  const report =
    reconciliation
      ?.report as
      | {
          latestSnapshot?: {
            snapshotHash?:
              string;

            capturedAt?:
              string;

            totalLiabilityMinor?:
              string;

            onchainBalanceMinor?:
              string;
          } | null;

          navPolicy?: {
            version?:
              string;

            supplyBasis?:
              string;
          };
        }
      | undefined;

  const snapshot =
    report
      ?.latestSnapshot ??
    null;

  const totalLiabilityMinor =
    snapshot
      ?.totalLiabilityMinor ??
    null;

  const onchainBalanceMinor =
    snapshot
      ?.onchainBalanceMinor ??
    null;

  const coverageBps =
    totalLiabilityMinor &&
    onchainBalanceMinor
      ? calculateCoverageBps({
          liabilityMinor:
            totalLiabilityMinor,

          onchainMinor:
            onchainBalanceMinor,
        })
      : null;

  const fullyCovered =
    totalLiabilityMinor !==
      null &&
    onchainBalanceMinor !==
      null
      ? BigInt(
          onchainBalanceMinor,
        ) >=
        BigInt(
          totalLiabilityMinor,
        )
      : false;

  return {
    viewVersion:
      ECONOMIC_OPERATIONS_VIEW_VERSION,

    integrity: {
      state:
        reconciliationState,

      reconciliationVersion:
        reconciliation
          ?.reconciliationVersion ??
        null,

      reconciledAt:
        reconciliation
          ?.reconciledAt ??
        null,

      reportHash:
        reconciliation
          ?.reportHash ??
        null,

      criticalFailures:
        reconciliation
          ?.criticalFailures ??
        0,

      warnings:
        reconciliation
          ?.warnings ??
        0,
    },

    incident: {
      state:
        !latestIncident
          ? "NONE"
          : latestIncident
              .eventType ===
              "RESOLVED"
            ? "RESOLVED"
            : "OPEN",

      severity:
        latestIncident
          ?.severity ??
        null,

      eventType:
        latestIncident
          ?.eventType ??
        null,

      updatedAt:
        latestIncident
          ?.createdAt ??
        null,

      reportHash:
        latestIncident
          ?.reportHash ??
        null,
    },

    proofOfReserve: {
      available:
        snapshot !==
        null,

      snapshotHash:
        snapshot
          ?.snapshotHash ??
        null,

      capturedAt:
        snapshot
          ?.capturedAt ??
        null,

      totalLiabilityMinor,

      onchainBalanceMinor,

      coverageBps,

      fullyCovered,
    },

    navPolicy: {
      version:
        report
          ?.navPolicy
          ?.version ??
        null,

      supplyBasis:
        report
          ?.navPolicy
          ?.supplyBasis ??
        null,
    },

    alertDelivery,

    incidentTimeline:
      getRecentPublicIncidentEvents(
        12,
      ),
  };
}
