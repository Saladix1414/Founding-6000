import {
  randomUUID,
} from "node:crypto";

import { db } from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  countIssuedForPhase,
  getHighestIssuedSerialForPhase,
  getAllocationByOrderId,
  getAllocationBySettlementReference,
} from "../repositories/inventoryRepository.js";

type OrderInventoryRow = {
  orderId: string;
  publicId: string;
  campaignId: string;
  phaseId: string;
  orderStatus: string;

  phaseCode: string;
  phaseName: string;
  phasePosition: number;

  capacity: number;

  serialStart: number;
  serialEnd: number;
};

export type InventoryAllocationResult = {
  allocationId: string;

  orderPublicId: string;

  campaignId: string;
  phaseId: string;

  phaseCode: string;
  phaseName: string;

  serialNumber: number;

  settlementReference: string;

  idempotentReplay: boolean;

  phaseTransitioned: boolean;
};

function getOrderInventoryContext(
  orderPublicId: string,
) {
  return db.prepare(`
    SELECT
      o.id AS orderId,
      o.public_id AS publicId,
      o.campaign_id AS campaignId,
      o.phase_id AS phaseId,
      o.status AS orderStatus,

      p.code AS phaseCode,
      p.name AS phaseName,
      p.position AS phasePosition,

      p.capacity AS capacity,

      p.serial_start AS serialStart,
      p.serial_end AS serialEnd

    FROM founding_orders o

    JOIN campaign_phases p
      ON p.id = o.phase_id

    WHERE o.public_id = ?
  `).get(
    orderPublicId,
  ) as OrderInventoryRow | undefined;
}

function activateNextPhase(
  campaignId: string,
  currentPosition: number,
) {
  const nextPhase =
    db.prepare(`
      SELECT
        id,
        position

      FROM campaign_phases

      WHERE
        campaign_id = ?
        AND position > ?

      ORDER BY position ASC

      LIMIT 1
    `).get(
      campaignId,
      currentPosition,
    ) as
      | {
          id: string;
          position: number;
        }
      | undefined;

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE campaign_phases

    SET
      active = 0,
      updated_at = ?

    WHERE campaign_id = ?
  `).run(
    now,
    campaignId,
  );

  if (!nextPhase) {
    return false;
  }

  db.prepare(`
    UPDATE campaign_phases

    SET
      active = 1,
      updated_at = ?

    WHERE id = ?
  `).run(
    now,
    nextPhase.id,
  );

  return true;
}

/*
 * INTERNAL FUNCTION.
 *
 * Caller MUST already hold the database transaction.
 */
export function allocateInventoryWithinTransaction(
  input: {
    orderPublicId: string;
    settlementReference: string;
  },
): InventoryAllocationResult {
  if (
    !input.settlementReference ||
    input.settlementReference.length < 8
  ) {
    throw new Error(
      "INVALID_SETTLEMENT_REFERENCE",
    );
  }

  const context =
    getOrderInventoryContext(
      input.orderPublicId,
    );

  if (!context) {
    throw new Error(
      "ORDER_NOT_FOUND",
    );
  }

  const existingByOrder =
    getAllocationByOrderId(
      context.orderId,
    );

  if (existingByOrder) {
    return {
      allocationId:
        existingByOrder.id,

      orderPublicId:
        context.publicId,

      campaignId:
        context.campaignId,

      phaseId:
        context.phaseId,

      phaseCode:
        context.phaseCode,

      phaseName:
        context.phaseName,

      serialNumber:
        existingByOrder.serialNumber,

      settlementReference:
        existingByOrder.settlementReference,

      idempotentReplay:
        true,

      phaseTransitioned:
        false,
    };
  }

  const existingBySettlement =
    getAllocationBySettlementReference(
      input.settlementReference,
    );

  if (existingBySettlement) {
    throw new Error(
      "SETTLEMENT_REFERENCE_ALREADY_USED",
    );
  }

  /*
   * Capacity is based on historical issuance, not only
   * currently ALLOCATED rows.
   *
   * A RELEASED Founding serial remains permanently
   * consumed and can never be reissued.
   */
  const issued =
    countIssuedForPhase(
      context.phaseId,
    );

  if (
    issued >=
    context.capacity
  ) {
    throw new Error(
      "PHASE_SOLD_OUT",
    );
  }

  const highestHistoricalSerial =
    getHighestIssuedSerialForPhase(
      context.phaseId,
    );

  const serialNumber =
    highestHistoricalSerial ===
    null
      ? context.serialStart
      : highestHistoricalSerial +
        1;

  if (
    serialNumber <
      context.serialStart ||
    serialNumber >
      context.serialEnd
  ) {
    throw new Error(
      "PHASE_SERIAL_RANGE_EXHAUSTED",
    );
  }

  const allocationId =
    randomUUID();

  const now =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO inventory_allocations (
      id,
      campaign_id,
      phase_id,
      order_id,
      serial_number,
      settlement_reference,
      status,
      allocated_at,
      released_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, 'ALLOCATED', ?, NULL
    )
  `).run(
    allocationId,
    context.campaignId,
    context.phaseId,
    context.orderId,
    serialNumber,
    input.settlementReference,
    now,
  );

  const newIssuedCount =
    issued + 1;

  let phaseTransitioned =
    false;

  if (
    newIssuedCount ===
    context.capacity
  ) {
    phaseTransitioned =
      activateNextPhase(
        context.campaignId,
        context.phasePosition,
      );
  }

  createAuditEvent({
    eventType:
      "INVENTORY_ALLOCATED",

    entityType:
      "FOUNDING_ORDER",

    entityId:
      context.orderId,

    payload: {
      orderPublicId:
        context.publicId,

      phaseCode:
        context.phaseCode,

      serialNumber,

      settlementReference:
        input.settlementReference,

      phaseTransitioned,
    },
  });

  return {
    allocationId,

    orderPublicId:
      context.publicId,

    campaignId:
      context.campaignId,

    phaseId:
      context.phaseId,

    phaseCode:
      context.phaseCode,

    phaseName:
      context.phaseName,

    serialNumber,

    settlementReference:
      input.settlementReference,

    idempotentReplay:
      false,

    phaseTransitioned,
  };
}

export function allocateInventoryForSettledOrder(
  input: {
    orderPublicId: string;
    settlementReference: string;
  },
): InventoryAllocationResult {
  db.exec(
    "BEGIN IMMEDIATE",
  );

  try {
    const result =
      allocateInventoryWithinTransaction(
        input,
      );

    db.exec(
      "COMMIT",
    );

    return result;
  } catch (error) {
    try {
      db.exec(
        "ROLLBACK",
      );
    } catch {
      // Transaction already closed.
    }

    throw error;
  }
}
