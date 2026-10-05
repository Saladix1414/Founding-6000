import {
  DatabaseSync,
} from "node:sqlite";

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { env } from "../config/env.js";
import { ensureInventorySchema } from "./inventorySchema.js";
import { ensureQuoteSchema } from "./quoteSchema.js";
import { ensureUsdtPaymentSchema } from "./usdtPaymentSchema.js";

const databasePath =
  resolve(env.DATABASE_PATH);

mkdirSync(
  dirname(databasePath),
  {
    recursive: true,
  },
);

export const db =
  new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      total_capacity INTEGER NOT NULL,
      target_launch_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_phases (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL UNIQUE,
      capacity INTEGER NOT NULL,
      reference_price_usd INTEGER NOT NULL,
      serial_start INTEGER NOT NULL,
      serial_end INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (
        campaign_id
      )
      REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS email_registrations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      normalized_email TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_email_registrations_normalized_email
      ON email_registrations(
        normalized_email
      );

    CREATE TABLE IF NOT EXISTS founding_orders (
      id TEXT PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,
      campaign_id TEXT NOT NULL,
      phase_id TEXT NOT NULL,
      email TEXT NOT NULL,
      normalized_email TEXT NOT NULL,
      reference_price_usd INTEGER NOT NULL,
      status TEXT NOT NULL,
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (
        campaign_id
      )
      REFERENCES campaigns(id),

      FOREIGN KEY (
        phase_id
      )
      REFERENCES campaign_phases(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_founding_orders_idempotency
      ON founding_orders(
        idempotency_key
      )
      WHERE idempotency_key IS NOT NULL;

    CREATE INDEX IF NOT EXISTS
      idx_founding_orders_email
      ON founding_orders(
        normalized_email
      );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_audit_events_entity
      ON audit_events(
        entity_type,
        entity_id
      );
  `);

  seedCampaign();
  ensureInventorySchema();
  ensureQuoteSchema();
  ensureUsdtPaymentSchema();
}

function seedCampaign() {
  const campaignId =
    "campaign_founding_6000";

  const now =
    new Date().toISOString();

  const campaign =
    db.prepare(`
      SELECT id
      FROM campaigns
      WHERE id = ?
    `).get(campaignId);

  if (!campaign) {
    db.prepare(`
      INSERT INTO campaigns (
        id,
        slug,
        name,
        total_capacity,
        target_launch_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      "founding-6000",
      "DigitalBoost Origin — Founding 6000",
      6000,
      "2027-01-05T00:00:00-03:00",
      now,
      now,
    );
  }

  const phases = [
    {
      id: "phase_genesis",
      code: "GENESIS",
      name: "Genesis",
      position: 1,
      capacity: 1000,
      price: 50,
      start: 1,
      end: 1000,
      active: 1,
    },
    {
      id: "phase_early_access",
      code: "EARLY_ACCESS",
      name: "Early Access",
      position: 2,
      capacity: 2000,
      price: 70,
      start: 1001,
      end: 3000,
      active: 0,
    },
    {
      id: "phase_founding_access",
      code: "FOUNDING_ACCESS",
      name: "Founding Access",
      position: 3,
      capacity: 3000,
      price: 90,
      start: 3001,
      end: 6000,
      active: 0,
    },
  ];

  const insertPhase =
    db.prepare(`
      INSERT OR IGNORE INTO campaign_phases (
        id,
        campaign_id,
        code,
        name,
        position,
        capacity,
        reference_price_usd,
        serial_start,
        serial_end,
        active,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

  for (const phase of phases) {
    insertPhase.run(
      phase.id,
      campaignId,
      phase.code,
      phase.name,
      phase.position,
      phase.capacity,
      phase.price,
      phase.start,
      phase.end,
      phase.active,
      now,
      now,
    );
  }
}
