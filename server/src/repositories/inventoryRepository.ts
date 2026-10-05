import { db } from "../db/database.js";

export type AllocationRow = {
  id: string;
  campaignId: string;
  phaseId: string;
  orderId: string;
  serialNumber: number;
  settlementReference: string;
  status: "ALLOCATED" | "RELEASED";
  allocatedAt: string;
  releasedAt: string | null;
};

export function getAllocationByOrderId(
  orderId: string,
) {
  return db.prepare(`
    SELECT
      id,
      campaign_id AS campaignId,
      phase_id AS phaseId,
      order_id AS orderId,
      serial_number AS serialNumber,
      settlement_reference AS settlementReference,
      status,
      allocated_at AS allocatedAt,
      released_at AS releasedAt
    FROM inventory_allocations
    WHERE order_id = ?
  `).get(orderId) as
    | AllocationRow
    | undefined;
}

export function getAllocationBySettlementReference(
  settlementReference: string,
) {
  return db.prepare(`
    SELECT
      id,
      campaign_id AS campaignId,
      phase_id AS phaseId,
      order_id AS orderId,
      serial_number AS serialNumber,
      settlement_reference AS settlementReference,
      status,
      allocated_at AS allocatedAt,
      released_at AS releasedAt
    FROM inventory_allocations
    WHERE settlement_reference = ?
  `).get(
    settlementReference,
  ) as
    | AllocationRow
    | undefined;
}

export function countAllocatedForPhase(
  phaseId: string,
) {
  const result =
    db.prepare(`
      SELECT
        COUNT(*) AS count
      FROM inventory_allocations
      WHERE
        phase_id = ?
        AND status = 'ALLOCATED'
    `).get(
      phaseId,
    ) as {
      count: number;
    };

  return Number(
    result.count,
  );
}

/*
 * Historical issuance counters.
 *
 * RELEASED allocations remain part of the permanent
 * Founding serial history and must never make a serial
 * number available for reuse.
 */
export function countIssuedForPhase(
  phaseId: string,
) {
  const result =
    db.prepare(`
      SELECT
        COUNT(*) AS count
      FROM inventory_allocations
      WHERE phase_id = ?
    `).get(
      phaseId,
    ) as {
      count: number;
    };

  return Number(
    result.count,
  );
}

export function getHighestIssuedSerialForPhase(
  phaseId: string,
) {
  const result =
    db.prepare(`
      SELECT
        MAX(serial_number) AS highest
      FROM inventory_allocations
      WHERE phase_id = ?
    `).get(
      phaseId,
    ) as {
      highest:
        | number
        | null;
    };

  return result.highest === null
    ? null
    : Number(
        result.highest,
      );
}

export function countAllocatedForCampaign(
  campaignId: string,
) {
  const result =
    db.prepare(`
      SELECT
        COUNT(*) AS count
      FROM inventory_allocations
      WHERE
        campaign_id = ?
        AND status = 'ALLOCATED'
    `).get(
      campaignId,
    ) as {
      count: number;
    };

  return Number(
    result.count,
  );
}

export function getHighestAllocatedSerial(
  campaignId: string,
) {
  const result =
    db.prepare(`
      SELECT
        MAX(serial_number) AS highest
      FROM inventory_allocations
      WHERE
        campaign_id = ?
        AND status = 'ALLOCATED'
    `).get(
      campaignId,
    ) as {
      highest:
        | number
        | null;
    };

  return result.highest;
}
