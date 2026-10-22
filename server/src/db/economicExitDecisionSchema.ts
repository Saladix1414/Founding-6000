import {
  db,
} from "./database.js";

export function ensureEconomicExitDecisionSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economic_exit_decisions (
      id TEXT PRIMARY KEY,

      idempotency_key TEXT NOT NULL UNIQUE,

      serial_number INTEGER NOT NULL
        CHECK (
          serial_number BETWEEN 1 AND 6000
        ),

      collection_tier TEXT NOT NULL
        CHECK (
          collection_tier IN (
            'RARE',
            'EPIC',
            'GENESIS'
          )
        ),

      trigger TEXT NOT NULL
        CHECK (
          trigger IN (
            'MEMBERSHIP_REFUNDED',
            'MEMBERSHIP_REVOKED',
            'NFT_TRANSFERRED',
            'NFT_BURN_REQUESTED',
            'REDEMPTION_REQUESTED'
          )
        ),

      decision TEXT NOT NULL
        CHECK (
          decision IN (
            'NO_RESERVE_EFFECT',
            'DISABLED_REQUIRES_FUTURE_POLICY'
          )
        ),

      reserve_debit_authorized INTEGER NOT NULL
        CHECK (
          reserve_debit_authorized IN (
            0,
            1
          )
        ),

      nav_denominator_changes INTEGER NOT NULL
        CHECK (
          nav_denominator_changes IN (
            0,
            1
          )
        ),

      serial_reusable INTEGER NOT NULL
        CHECK (
          serial_reusable IN (
            0,
            1
          )
        ),

      burn_authorized INTEGER NOT NULL
        CHECK (
          burn_authorized IN (
            0,
            1
          )
        ),

      redemption_authorized INTEGER NOT NULL
        CHECK (
          redemption_authorized IN (
            0,
            1
          )
        ),

      exit_policy_version TEXT NOT NULL,

      nav_supply_policy_version TEXT NOT NULL,

      nav_supply_basis TEXT NOT NULL,

      evidence_json TEXT NOT NULL,

      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_exit_decisions_serial

    ON economic_exit_decisions(
      serial_number,
      created_at DESC
    );

    CREATE INDEX IF NOT EXISTS
      idx_economic_exit_decisions_trigger

    ON economic_exit_decisions(
      trigger,
      created_at DESC
    );

    /*
     * Append-only enforcement.
     *
     * Existing decisions may never be rewritten
     * or deleted.
     */
    CREATE TRIGGER IF NOT EXISTS
      trg_economic_exit_decisions_no_update

    BEFORE UPDATE
    ON economic_exit_decisions

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_EXIT_DECISIONS_APPEND_ONLY'
        );
    END;

    CREATE TRIGGER IF NOT EXISTS
      trg_economic_exit_decisions_no_delete

    BEFORE DELETE
    ON economic_exit_decisions

    BEGIN
      SELECT
        RAISE(
          ABORT,
          'ECONOMIC_EXIT_DECISIONS_APPEND_ONLY'
        );
    END;
  `);
}
