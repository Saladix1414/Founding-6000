import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  calculateReserveContribution,
} from "../economics/foundingEconomicsPolicy.js";

export const ECONOMIC_MODEL_VERSION =
  "OX-FOUNDING-ECONOMICS-1";

export const WATERFALL_VERSION =
  "OX-FOUNDING-WATERFALL-1";

export function recordReserveContributionWithinTransaction(
  input: {
    settlementId:
      string;

    orderId:
      string;

    serialNumber:
      number;

    grossAmountMinor:
      bigint;

    externalReference:
      string;
  },
) {
  const existing =
    db.prepare(`
      SELECT
        id,
        reserve_amount_minor
          AS reserveAmountMinor,

        sale_tier
          AS saleTier

      FROM reserve_contributions

      WHERE settlement_id = ?
    `).get(
      input.settlementId,
    ) as
      | {
          id: string;
          reserveAmountMinor: number;
          saleTier: string;
        }
      | undefined;

  if (existing) {
    return {
      contributionId:
        existing.id,

      reserveAmountMinor:
        BigInt(
          existing.reserveAmountMinor,
        ),

      saleTier:
        existing.saleTier,

      idempotentReplay:
        true,
    };
  }

  const economics =
    calculateReserveContribution({
      serialNumber:
        input.serialNumber,

      grossAmountMinor:
        input.grossAmountMinor,
    });

  const contributionId =
    randomUUID();

  const now =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO reserve_contributions (
      id,
      settlement_id,
      order_id,
      serial_number,
      sale_tier,
      gross_amount_minor,
      reserve_bps,
      reserve_amount_minor,
      external_reference,
      economic_model_version,
      waterfall_version,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    contributionId,
    input.settlementId,
    input.orderId,
    input.serialNumber,
    economics.saleTier,
    Number(
      economics.grossAmountMinor,
    ),
    economics.reserveBps,
    Number(
      economics.reserveAmountMinor,
    ),
    input.externalReference,
    ECONOMIC_MODEL_VERSION,
    WATERFALL_VERSION,
    now,
  );

  for (
    const allocation of
      economics.allocations
  ) {
    db.prepare(`
      INSERT INTO reserve_allocations (
        id,
        contribution_id,
        beneficiary_tier,
        weight_bps,
        amount_minor,
        created_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `).run(
      randomUUID(),
      contributionId,
      allocation.beneficiaryTier,
      allocation.weightBps,
      Number(
        allocation.amountMinor,
      ),
      now,
    );
  }

  createAuditEvent({
    eventType:
      "RESERVE_CONTRIBUTION_RECORDED",

    entityType:
      "FOUNDING_ORDER",

    entityId:
      input.orderId,

    payload: {
      economicModelVersion:
        ECONOMIC_MODEL_VERSION,

      waterfallVersion:
        WATERFALL_VERSION,

      settlementId:
        input.settlementId,

      serialNumber:
        input.serialNumber,

      saleTier:
        economics.saleTier,

      grossAmountMinor:
        economics.grossAmountMinor
          .toString(),

      reserveBps:
        economics.reserveBps,

      reserveAmountMinor:
        economics.reserveAmountMinor
          .toString(),

      externalReference:
        input.externalReference,

      allocations:
        economics.allocations
          .map(
            (
              allocation,
            ) => ({
              beneficiaryTier:
                allocation.beneficiaryTier,

              weightBps:
                allocation.weightBps,

              amountMinor:
                allocation.amountMinor
                  .toString(),
            }),
          ),
    },
  });

  return {
    contributionId,

    saleTier:
      economics.saleTier,

    reserveAmountMinor:
      economics.reserveAmountMinor,

    allocations:
      economics.allocations,

    idempotentReplay:
      false,
  };
}

export function getReserveBalances() {
  const rows =
    db.prepare(`
      SELECT
        beneficiary_tier
          AS beneficiaryTier,

        COALESCE(
          SUM(amount_minor),
          0
        )
          AS amountMinor

      FROM reserve_allocations

      GROUP BY beneficiary_tier
    `).all() as Array<{
      beneficiaryTier:
        "RARE" |
        "EPIC" |
        "GENESIS";

      amountMinor:
        number;
    }>;

  const balances = {
    RARE:
      0n,

    EPIC:
      0n,

    GENESIS:
      0n,
  };

  for (
    const row of rows
  ) {
    balances[
      row.beneficiaryTier
    ] =
      BigInt(
        row.amountMinor,
      );
  }

  return balances;
}
