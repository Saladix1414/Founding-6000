import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import { db } from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  getActivePhase,
} from "../repositories/campaignRepository.js";

import {
  normalizeEmail,
} from "./emailService.js";

import {
  queueFoundingEmailWithinTransaction,
} from "./emailOutboxService.js";

export type FoundingOrderView = {
  publicId: string;
  email: string;

  phase: {
    code: string;
    name: string;
  };

  referencePriceUsd: number;
  status: string;
  createdAt: string;
};

export type CreateOrderResult = {
  order: FoundingOrderView;
  idempotentReplay: boolean;
};

type ExistingOrderRow = {
  publicId: string;
  email: string;
  phaseCode: string;
  phaseName: string;
  referencePriceUsd: number;
  status: string;
  createdAt: string;
};

type OrderLookupRow = {
  publicId: string;
  email: string;
  referencePriceUsd: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  phaseCode: string;
  phaseName: string;
};

function createPublicId() {
  return `F6K-${randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

export function createOrder(input: {
  email: string;
  idempotencyKey?: string | null;
}): CreateOrderResult {
  if (input.idempotencyKey) {
    const existing =
      db.prepare(`
        SELECT
          o.public_id AS publicId,
          o.email,
          p.code AS phaseCode,
          p.name AS phaseName,
          o.reference_price_usd AS referencePriceUsd,
          o.status,
          o.created_at AS createdAt

        FROM founding_orders o

        JOIN campaign_phases p
          ON p.id = o.phase_id

        WHERE o.idempotency_key = ?
      `).get(
        input.idempotencyKey,
      ) as ExistingOrderRow | undefined;

    if (existing) {
      return {
        order: {
          publicId:
            existing.publicId,

          email:
            existing.email,

          phase: {
            code:
              existing.phaseCode,

            name:
              existing.phaseName,
          },

          referencePriceUsd:
            Number(
              existing.referencePriceUsd,
            ),

          status:
            existing.status,

          createdAt:
            existing.createdAt,
        },

        idempotentReplay:
          true,
      };
    }
  }

  const activePhase =
    getActivePhase();

  if (!activePhase) {
    throw new Error(
      "NO_ACTIVE_PHASE",
    );
  }

  const id =
    randomUUID();

  const publicId =
    createPublicId();

  const normalizedEmail =
    normalizeEmail(
      input.email,
    );

  const now =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO founding_orders (
      id,
      public_id,
      campaign_id,
      phase_id,
      email,
      normalized_email,
      reference_price_usd,
      status,
      idempotency_key,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    publicId,
    activePhase.campaignId,
    activePhase.id,
    input.email.trim(),
    normalizedEmail,
    activePhase.referencePriceUsd,
    "CREATED",
    input.idempotencyKey ?? null,
    now,
    now,
  );

  createAuditEvent({
    eventType:
      "FOUNDING_ORDER_CREATED",

    entityType:
      "FOUNDING_ORDER",

    entityId:
      id,

    payload: {
      publicId,

      phase:
        activePhase.code,

      referencePriceUsd:
        activePhase.referencePriceUsd,
    },
  });

    queueFoundingEmailWithinTransaction({
      recipientEmail:
        input.email.trim(),

      template:
        "REGISTRATION_RECEIVED",

      payload: {
        orderPublicId:
          publicId,
      },

      idempotencyKey:
        `registration:${publicId}`,
    });

  return {
    order: {
      publicId,

      email:
        input.email.trim(),

      phase: {
        code:
          activePhase.code,

        name:
          activePhase.name,
      },

      referencePriceUsd:
        activePhase.referencePriceUsd,

      status:
        "CREATED",

      createdAt:
        now,
    },

    idempotentReplay:
      false,
  };
}

export function getOrderByPublicId(
  publicId: string,
) {
  return db.prepare(`
    SELECT
      o.public_id AS publicId,
      o.email,
      o.reference_price_usd AS referencePriceUsd,
      o.status,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt,
      p.code AS phaseCode,
      p.name AS phaseName

    FROM founding_orders o

    JOIN campaign_phases p
      ON p.id = o.phase_id

    WHERE o.public_id = ?
  `).get(
    publicId,
  ) as OrderLookupRow | undefined;
}
