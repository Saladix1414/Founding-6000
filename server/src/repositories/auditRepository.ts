import {
  randomUUID,
} from "node:crypto";

import { db } from "../db/database.js";

export function createAuditEvent(input: {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const id =
    randomUUID();

  const createdAt =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_events (
      id,
      event_type,
      entity_type,
      entity_id,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.eventType,
    input.entityType,
    input.entityId ?? null,
    JSON.stringify(
      input.payload ?? {},
    ),
    createdAt,
  );

  return {
    id,
    createdAt,
  };
}
