import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureMembershipSchema,
} from "../db/membershipSchema.js";

ensureMembershipSchema();

import {
  queueFoundingEmailWithinTransaction,
} from "./emailOutboxService.js";

export type MembershipStatus =
  | "RESERVED"
  | "PAID"
  | "ACTIVATION_PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "REFUNDED"
  | "REVOKED";

export type FoundingMembership = {
  publicId: string;

  orderPublicId: string;

  serialNumber: number;

  foundingMember: boolean;

  genesisMember: boolean;

  status:
    MembershipStatus;

  activationStartedAt:
    string | null;

  activationExpiresAt:
    string | null;

  createdAt: string;

  updatedAt: string;
};

type MembershipRow = {
  publicId: string;

  orderPublicId: string;

  serialNumber: number;

  foundingMember: number;

  genesisMember: number;

  status:
    MembershipStatus;

  activationStartedAt:
    string | null;

  activationExpiresAt:
    string | null;

  createdAt: string;

  updatedAt: string;
};

function normalizeMembership(
  row:
    MembershipRow,
): FoundingMembership {
  return {
    publicId:
      row.publicId,

    orderPublicId:
      row.orderPublicId,

    serialNumber:
      Number(
        row.serialNumber,
      ),

    foundingMember:
      Boolean(
        row.foundingMember,
      ),

    genesisMember:
      Boolean(
        row.genesisMember,
      ),

    status:
      row.status,

    activationStartedAt:
      row.activationStartedAt,

    activationExpiresAt:
      row.activationExpiresAt,

    createdAt:
      row.createdAt,

    updatedAt:
      row.updatedAt,
  };
}

function membershipSelect() {
  return `
    SELECT
      m.public_id AS publicId,

      o.public_id AS orderPublicId,

      m.serial_number AS serialNumber,

      m.founding_member AS foundingMember,

      m.genesis_member AS genesisMember,

      m.status,

      m.activation_started_at AS activationStartedAt,

      m.activation_expires_at AS activationExpiresAt,

      m.created_at AS createdAt,

      m.updated_at AS updatedAt

    FROM founding_memberships m

    JOIN founding_orders o
      ON o.id = m.order_id
  `;
}

export function createMembershipForPaidOrderWithinTransaction(
  input: {
    orderId: string;
  },
) {
  ensureMembershipSchema();

  const existing =
    db.prepare(`
      ${membershipSelect()}
      WHERE m.order_id = ?
    `).get(
      input.orderId,
    ) as
      | MembershipRow
      | undefined;

  if (existing) {
    return {
      membership:
        normalizeMembership(
          existing,
        ),

      created:
        false,
    };
  }

  const context =
    db.prepare(`
      SELECT
        o.id AS orderId,

        o.public_id AS orderPublicId,

        o.status AS orderStatus,

        ia.serial_number AS serialNumber

      FROM founding_orders o

      JOIN inventory_allocations ia
        ON ia.order_id = o.id
       AND ia.status = 'ALLOCATED'

      WHERE o.id = ?

      LIMIT 1
    `).get(
      input.orderId,
    ) as
      | {
          orderId: string;
          orderPublicId: string;
          orderStatus: string;
          serialNumber: number;
        }
      | undefined;

  if (!context) {
    throw new Error(
      "MEMBERSHIP_ALLOCATION_REQUIRED",
    );
  }

  /*
   * This function is called inside the same
   * settlement transaction.
   *
   * The order may still be transitioning to PAID
   * in that transaction, but inventory must already
   * have been allocated from verified settlement.
   */

  const serialNumber =
    Number(
      context.serialNumber,
    );

  if (
    !Number.isInteger(
      serialNumber,
    ) ||
    serialNumber < 1 ||
    serialNumber > 6000
  ) {
    throw new Error(
      "INVALID_FOUNDING_SERIAL",
    );
  }

  const now =
    new Date()
      .toISOString();

  const id =
    randomUUID();

  const publicId =
    `mem_${randomUUID()}`;

  const genesisMember =
    serialNumber <= 1000;

  db.prepare(`
    INSERT INTO founding_memberships (
      id,
      public_id,
      order_id,
      serial_number,
      founding_member,
      genesis_member,
      status,
      activation_started_at,
      activation_expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      1,
      ?,
      'ACTIVATION_PENDING',
      NULL,
      NULL,
      ?,
      ?
    )
  `).run(
    id,
    publicId,
    input.orderId,
    serialNumber,
    genesisMember
      ? 1
      : 0,
    now,
    now,
  );

  const created =
    db.prepare(`
      ${membershipSelect()}
      WHERE m.id = ?
    `).get(
      id,
    ) as MembershipRow;

  return {
    membership:
      normalizeMembership(
        created,
      ),

    created:
      true,
  };
}

export function getMembershipByPublicId(
  publicId: string,
) {
  ensureMembershipSchema();

  const row =
    db.prepare(`
      ${membershipSelect()}
      WHERE m.public_id = ?
    `).get(
      publicId,
    ) as
      | MembershipRow
      | undefined;

  return row
    ? normalizeMembership(
        row,
      )
    : null;
}

export function getMembershipForOrder(
  orderPublicId: string,
) {
  ensureMembershipSchema();

  const row =
    db.prepare(`
      ${membershipSelect()}
      WHERE o.public_id = ?
    `).get(
      orderPublicId,
    ) as
      | MembershipRow
      | undefined;

  return row
    ? normalizeMembership(
        row,
      )
    : null;
}

function addOneYearUtc(
  start:
    Date,
) {
  /*
   * Founding entitlement is twelve calendar months,
   * not a hardcoded 365-day approximation.
   *
   * Feb 29 is clamped safely to Feb 28 when needed.
   */
  const year =
    start.getUTCFullYear() + 1;

  const month =
    start.getUTCMonth();

  const day =
    start.getUTCDate();

  const result =
    new Date(
      Date.UTC(
        year,
        month,
        1,
        start.getUTCHours(),
        start.getUTCMinutes(),
        start.getUTCSeconds(),
        start.getUTCMilliseconds(),
      ),
    );

  const daysInTargetMonth =
    new Date(
      Date.UTC(
        year,
        month + 1,
        0,
      ),
    ).getUTCDate();

  result.setUTCDate(
    Math.min(
      day,
      daysInTargetMonth,
    ),
  );

  return result;
}

export function activateMembership(
  input: {
    membershipPublicId:
      string;

    activatedAt?:
      Date;
  },
) {
  ensureMembershipSchema();

  const membership =
    getMembershipByPublicId(
      input.membershipPublicId,
    );

  if (!membership) {
    throw new Error(
      "MEMBERSHIP_NOT_FOUND",
    );
  }

  if (
    membership.status ===
      "ACTIVE"
  ) {
    return {
      membership,
      idempotentReplay:
        true,
    };
  }

  if (
    membership.status !==
      "ACTIVATION_PENDING"
  ) {
    throw new Error(
      `MEMBERSHIP_NOT_ACTIVATABLE_FROM_${membership.status}`,
    );
  }

  const activatedAt =
    input.activatedAt ??
    new Date();

  const expiresAt =
    addOneYearUtc(
      activatedAt,
    );

  const activatedIso =
    activatedAt.toISOString();

  const expiresIso =
    expiresAt.toISOString();

  db.prepare(`
    UPDATE founding_memberships

    SET
      status = 'ACTIVE',
      activation_started_at = ?,
      activation_expires_at = ?,
      updated_at = ?

    WHERE public_id = ?
      AND status = 'ACTIVATION_PENDING'
  `).run(
    activatedIso,
    expiresIso,
    activatedIso,
    input.membershipPublicId,
  );

  const updated =
    getMembershipByPublicId(
      input.membershipPublicId,
    );

  if (!updated) {
    throw new Error(
      "MEMBERSHIP_ACTIVATION_FAILED",
    );
  }

    const activationEmailRow =
      db.prepare(`
        SELECT
          o.email,
          o.public_id AS orderPublicId

        FROM founding_orders o

        JOIN founding_memberships m
          ON m.order_id = o.id

        WHERE m.public_id = ?
      `).get(
        input.membershipPublicId,
      ) as
        | {
            email: string;
            orderPublicId: string;
          }
        | undefined;

    if (!activationEmailRow) {
      throw new Error(
        "MEMBERSHIP_ACTIVATION_EMAIL_CONTEXT_NOT_FOUND",
      );
    }

    queueFoundingEmailWithinTransaction({
      recipientEmail:
        activationEmailRow.email,

      template:
        "MEMBERSHIP_ACTIVATED",

      payload: {
        orderPublicId:
          activationEmailRow.orderPublicId,

        membershipPublicId:
          updated.publicId,

        serialNumber:
          updated.serialNumber,

        genesisMember:
          updated.genesisMember,

        activationStartedAt:
          updated.activationStartedAt ??
          undefined,

        activationExpiresAt:
          updated.activationExpiresAt ??
          undefined,
      },

      idempotencyKey:
        `membership-activated:${updated.publicId}`,
    });

  return {
    membership:
      updated,

    idempotentReplay:
      false,
  };
}

export function expireEligibleMemberships(
  now =
    new Date(),
) {
  ensureMembershipSchema();

  const nowIso =
    now.toISOString();

  const result =
    db.prepare(`
      UPDATE founding_memberships

      SET
        status = 'EXPIRED',
        updated_at = ?

      WHERE
        status = 'ACTIVE'
        AND activation_expires_at IS NOT NULL
        AND activation_expires_at <= ?
    `).run(
      nowIso,
      nowIso,
    );

  return {
    expiredCount:
      Number(
        result.changes,
      ),
  };
}
