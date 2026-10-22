import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureAkashicEconomicOutboxSchema,
} from "../db/akashicEconomicOutboxSchema.js";

import {
  economicSha256,
} from "../economics/economicCanonical.js";

ensureAkashicEconomicOutboxSchema();

export const AKASHIC_ECONOMIC_BRIDGE_VERSION =
  "OX-AKASHIC-ECONOMIC-BRIDGE-1";

export function queueReserveSnapshotForAkashic(
  input: {
    snapshotHash:
      string;

    capturedAt:
      string;

    totalLiabilityMinor:
      string;

    onchainVaultBalanceMinor:
      string;

    coverageBps:
      string | null;

    fullyCovered:
      boolean;

    vaultAddress:
      string;
  },
) {
  ensureAkashicEconomicOutboxSchema();

  const lifecycleReference =
    `RESERVE-SNAPSHOT:${input.snapshotHash}`;

  const existing =
    db.prepare(`
      SELECT
        id,
        status

      FROM akashic_economic_outbox

      WHERE lifecycle_reference = ?
    `).get(
      lifecycleReference,
    ) as
      | {
          id: string;
          status: string;
        }
      | undefined;

  if (existing) {
    return {
      id:
        existing.id,

      status:
        existing.status,

      idempotentReplay:
        true,
    };
  }

  const payload = {
    bridgeVersion:
      AKASHIC_ECONOMIC_BRIDGE_VERSION,

    eventType:
      "RESERVE_SNAPSHOT_PUBLISHED",

    lifecycleReference,

    publicSafe:
      true,

    containsPII:
      false,

    snapshot: {
      snapshotHash:
        input.snapshotHash,

      capturedAt:
        input.capturedAt,

      totalLiabilityMinor:
        input.totalLiabilityMinor,

      onchainVaultBalanceMinor:
        input.onchainVaultBalanceMinor,

      coverageBps:
        input.coverageBps,

      fullyCovered:
        input.fullyCovered,

      vaultAddress:
        input.vaultAddress,
    },
  };

  const payloadHash =
    economicSha256(
      payload,
    );

  const id =
    randomUUID();

  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO akashic_economic_outbox (
      id,
      event_type,
      lifecycle_reference,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status,
      created_at
    )
    VALUES (
      ?,
      'RESERVE_SNAPSHOT_PUBLISHED',
      ?,
      'FOUNDING_RESERVE_SNAPSHOT',
      ?,
      ?,
      ?,
      'PENDING',
      ?
    )
  `).run(
    id,
    lifecycleReference,
    input.snapshotHash,
    JSON.stringify(
      payload,
    ),
    payloadHash,
    now,
  );

  return {
    id,

    status:
      "PENDING" as const,

    payload,

    payloadHash,

    idempotentReplay:
      false,
  };
}
