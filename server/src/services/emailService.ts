import {
  randomUUID,
} from "node:crypto";

import { db } from "../db/database.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

export function normalizeEmail(
  email: string,
) {
  return email
    .trim()
    .toLowerCase();
}

export function registerEmail(
  email: string,
) {
  const normalizedEmail =
    normalizeEmail(email);

  const id =
    randomUUID();

  const createdAt =
    new Date().toISOString();

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
    "FOUNDING_6000_CHECKOUT",
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
      source:
        "FOUNDING_6000_CHECKOUT",
    },
  });

  return {
    id,
    email:
      email.trim(),
    createdAt,
  };
}
