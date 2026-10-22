import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureReserveSweepSchema,
} from "../db/reserveSweepSchema.js";

import {
  env,
} from "../config/env.js";

import {
  buildReserveSweepAmount,
  RESERVE_SWEEP_VERSION,
} from "../economics/reserveSweepPolicy.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

ensureReserveSweepSchema();

type PendingContributionRow = {
  id:
    string;

  amountMinor:
    number;
};

export function createPendingReserveSweep() {
  ensureReserveSweepSchema();

  if (
    !env.RESERVE_SWEEP_ENABLED
  ) {
    return {
      created:
        false,

      reason:
        "RESERVE_SWEEP_DISABLED" as const,
    };
  }

  if (
    !env.RESERVE_VAULT_ADDRESS ||
    !env.RESERVE_SWEEP_TREASURY_ADDRESS
  ) {
    throw new Error(
      "RESERVE_SWEEP_ADDRESS_CONFIG_REQUIRED",
    );
  }

  db.exec(
    "BEGIN IMMEDIATE",
  );

  try {
    const rows =
      db.prepare(`
        SELECT
          rc.id,

          rc.reserve_amount_minor
            AS amountMinor

        FROM reserve_contributions rc

        LEFT JOIN reserve_sweep_items rsi
          ON rsi.contribution_id =
             rc.id

        WHERE
          rsi.contribution_id
            IS NULL

        ORDER BY
          rc.created_at ASC,
          rc.id ASC

        LIMIT ?
      `).all(
        env.RESERVE_SWEEP_MAX_CONTRIBUTIONS,
      ) as PendingContributionRow[];

    if (
      rows.length === 0
    ) {
      db.exec(
        "COMMIT",
      );

      return {
        created:
          false,

        reason:
          "NO_PENDING_CONTRIBUTIONS" as const,
      };
    }

    const calculation =
      buildReserveSweepAmount(
        rows.map(
          (row) => ({
            contributionId:
              row.id,

            amountMinor:
              BigInt(
                row.amountMinor,
              ),
          }),
        ),
      );

    if (
      calculation.totalAmountMinor <
      BigInt(
        env.RESERVE_SWEEP_MIN_AMOUNT_MINOR,
      )
    ) {
      db.exec(
        "COMMIT",
      );

      return {
        created:
          false,

        reason:
          "BELOW_MINIMUM_SWEEP_AMOUNT" as const,

        pendingAmountMinor:
          calculation
            .totalAmountMinor
            .toString(),
      };
    }

    const id =
      randomUUID();

    const publicId =
      `rsw_${randomUUID()}`;

    const now =
      new Date()
        .toISOString();

    db.prepare(`
      INSERT INTO reserve_sweeps (
        id,
        public_id,
        sweep_version,
        status,
        network,
        chain_id,
        token_contract,
        treasury_address,
        vault_address,
        amount_minor,
        contribution_count,
        attempts,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?,
        'PENDING',
        ?, ?, ?, ?, ?, ?, ?,
        0,
        ?, ?
      )
    `).run(
      id,
      publicId,
      RESERVE_SWEEP_VERSION,
      env.USDT_NETWORK,
      env.USDT_CHAIN_ID,
      env.USDT_TOKEN_CONTRACT,
      env.RESERVE_SWEEP_TREASURY_ADDRESS,
      env.RESERVE_VAULT_ADDRESS,
      Number(
        calculation.totalAmountMinor,
      ),
      calculation.contributionCount,
      now,
      now,
    );

    const insertItem =
      db.prepare(`
        INSERT INTO reserve_sweep_items (
          id,
          sweep_id,
          contribution_id,
          amount_minor,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `);

    for (
      const row of rows
    ) {
      insertItem.run(
        randomUUID(),
        id,
        row.id,
        row.amountMinor,
        now,
      );
    }

    createAuditEvent({
      eventType:
        "RESERVE_SWEEP_CREATED",

      entityType:
        "FOUNDING_RESERVE",

      entityId:
        id,

      payload: {
        publicId,

        amountMinor:
          calculation
            .totalAmountMinor
            .toString(),

        contributionCount:
          calculation
            .contributionCount,

        vaultAddress:
          env.RESERVE_VAULT_ADDRESS,
      },
    });

    db.exec(
      "COMMIT",
    );

    return {
      created:
        true,

      sweepId:
        id,

      publicId,

      amountMinor:
        calculation
          .totalAmountMinor,

      contributionCount:
        calculation
          .contributionCount,
    };
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

export function getNextExecutableReserveSweep() {
  ensureReserveSweepSchema();

  return db.prepare(`
    SELECT
      id,

      public_id
        AS publicId,

      status,

      network,

      chain_id
        AS chainId,

      token_contract
        AS tokenContract,

      treasury_address
        AS treasuryAddress,

      vault_address
        AS vaultAddress,

      amount_minor
        AS amountMinor,

      contribution_count
        AS contributionCount,

      transaction_nonce
        AS transactionNonce,

      transaction_hash
        AS transactionHash,

      transaction_json
        AS transactionJson,

      attempts,

      last_error
        AS lastError

    FROM reserve_sweeps

    WHERE status IN (
      'PENDING',
      'PREPARED',
      'SUBMITTED'
    )

    ORDER BY
      created_at ASC,
      id ASC

    LIMIT 1
  `).get();
}

export function markReserveSweepPrepared(
  input: {
    sweepId:
      string;

    nonce:
      number;

    transactionHash:
      string;

    transactionJson:
      string;
  },
) {
  const now =
    new Date()
      .toISOString();

  const result =
    db.prepare(`
      UPDATE reserve_sweeps

      SET
        status = 'PREPARED',

        transaction_nonce = ?,

        transaction_hash = ?,

        transaction_json = ?,

        attempts =
          attempts + 1,

        last_error = NULL,

        prepared_at =
          COALESCE(
            prepared_at,
            ?
          ),

        updated_at = ?

      WHERE id = ?
        AND status IN (
          'PENDING',
          'PREPARED'
        )
    `).run(
      input.nonce,
      input.transactionHash,
      input.transactionJson,
      now,
      now,
      input.sweepId,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "RESERVE_SWEEP_PREPARE_CONFLICT",
    );
  }
}

export function markReserveSweepSubmitted(
  input: {
    sweepId:
      string;

    transactionHash:
      string;
  },
) {
  const now =
    new Date()
      .toISOString();

  const result =
    db.prepare(`
      UPDATE reserve_sweeps

      SET
        status = 'SUBMITTED',

        transaction_hash = ?,

        submitted_at =
          COALESCE(
            submitted_at,
            ?
          ),

        last_error = NULL,

        updated_at = ?

      WHERE id = ?
        AND status IN (
          'PREPARED',
          'SUBMITTED'
        )
    `).run(
      input.transactionHash,
      now,
      now,
      input.sweepId,
    );

  if (
    Number(
      result.changes,
    ) !== 1
  ) {
    throw new Error(
      "RESERVE_SWEEP_SUBMIT_CONFLICT",
    );
  }
}

export function markReserveSweepConfirmed(
  input: {
    sweepId:
      string;

    transactionHash:
      string;
  },
) {
  const now =
    new Date()
      .toISOString();

  db.exec(
    "BEGIN IMMEDIATE",
  );

  try {
    const result =
      db.prepare(`
        UPDATE reserve_sweeps

        SET
          status = 'CONFIRMED',

          transaction_hash = ?,

          confirmed_at =
            COALESCE(
              confirmed_at,
              ?
            ),

          last_error = NULL,

          updated_at = ?

        WHERE id = ?
          AND status IN (
            'PREPARED',
            'SUBMITTED'
          )
      `).run(
        input.transactionHash,
        now,
        now,
        input.sweepId,
      );

    if (
      Number(
        result.changes,
      ) !== 1
    ) {
      throw new Error(
        "RESERVE_SWEEP_CONFIRM_CONFLICT",
      );
    }

    createAuditEvent({
      eventType:
        "RESERVE_SWEEP_CONFIRMED",

      entityType:
        "FOUNDING_RESERVE",

      entityId:
        input.sweepId,

      payload: {
        transactionHash:
          input.transactionHash,
      },
    });

    db.exec(
      "COMMIT",
    );
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

export function markReserveSweepFailed(
  input: {
    sweepId:
      string;

    errorCode:
      string;
  },
) {
  const now =
    new Date()
      .toISOString();

  db.prepare(`
    UPDATE reserve_sweeps

    SET
      status = 'FAILED',

      last_error = ?,

      updated_at = ?

    WHERE id = ?
      AND status != 'CONFIRMED'
  `).run(
    input.errorCode,
    now,
    input.sweepId,
  );
}
