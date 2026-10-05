import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

export type EmailRegistrationSource =
  | "FOUNDING_6000_CHECKOUT"
  | "FOUNDING_6000_PRELAUNCH";

export function normalizeEmail(
  email: string,
) {
  return email
    .trim()
    .toLowerCase();
}

function createEmailRegistration(
  email: string,
  source:
    EmailRegistrationSource,
) {
  const normalizedEmail =
    normalizeEmail(
      email,
    );

  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO email_registrations (
      id,
      email,
      normalized_email,
      source,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    email.trim(),
    normalizedEmail,
    source,
    createdAt,
  );

  createAuditEvent({
    eventType:
      "EMAIL_REGISTERED",

    entityType:
      "EMAIL_REGISTRATION",

    entityId:
      id,

    payload: {
      source,
    },
  });

  return {
    id,

    email:
      email.trim(),

    createdAt,
  };
}

/*
 * Existing checkout-oriented registration API.
 * Kept for backwards compatibility.
 */
export function registerEmail(
  email: string,
) {
  return createEmailRegistration(
    email,
    "FOUNDING_6000_CHECKOUT",
  );
}

/*
 * Public prelaunch interest registration.
 *
 * This does NOT create:
 * - an order
 * - a payment
 * - inventory
 * - a Founding serial
 * - a membership
 */
export function registerPrelaunchEmail(
  email: string,
) {
  return createEmailRegistration(
    email,
    "FOUNDING_6000_PRELAUNCH",
  );
}
