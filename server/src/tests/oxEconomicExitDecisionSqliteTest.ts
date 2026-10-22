import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

const tempDirectory =
  mkdtempSync(
    join(
      tmpdir(),
      "ox-economic-exit-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    tempDirectory,
    "economic-exit.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    ensureEconomicExitDecisionSchema,
  } =
    await import(
      "../db/economicExitDecisionSchema.js"
    );

  const {
    recordEconomicExitDecision,
  } =
    await import(
      "../services/economicExitDecisionService.js"
    );

  ensureEconomicExitDecisionSchema();

  function expect(
    condition:
      boolean,

    message:
      string,
  ) {
    if (!condition) {
      throw new Error(
        message,
      );
    }
  }

  /*
   * -------------------------------------------------------
   * Membership refund:
   *
   * records policy evidence,
   * but gains NO reserve authority.
   * -------------------------------------------------------
   */
  const refund =
    recordEconomicExitDecision({
      serialNumber:
        1,

      tier:
        "RARE",

      trigger:
        "MEMBERSHIP_REFUNDED",

      externalReference:
        "refund-case-0001",

      evidence: {
        source:
          "sqlite-policy-test",
      },
    });

  expect(
    refund.idempotentReplay ===
      false,
    "FIRST_DECISION_MARKED_REPLAY",
  );

  expect(
    refund
      .decision
      .decision ===
      "NO_RESERVE_EFFECT",
    "REFUND_DECISION_INVALID",
  );

  expect(
    refund
      .decision
      .reserveDebitAuthorized ===
      false,
    "REFUND_AUTHORIZED_RESERVE_DEBIT",
  );

  expect(
    refund
      .decision
      .navDenominatorChanges ===
      false,
    "REFUND_CHANGED_NAV_DENOMINATOR",
  );

  expect(
    refund
      .decision
      .serialReusable ===
      false,
    "REFUND_REUSED_SERIAL",
  );

  /*
   * Idempotent replay.
   */
  const refundReplay =
    recordEconomicExitDecision({
      serialNumber:
        1,

      tier:
        "RARE",

      trigger:
        "MEMBERSHIP_REFUNDED",

      externalReference:
        "refund-case-0001",

      evidence: {
        source:
          "ignored-on-replay",
      },
    });

  expect(
    refundReplay.idempotentReplay ===
      true,
    "IDEMPOTENT_REPLAY_NOT_DETECTED",
  );

  expect(
    refundReplay
      .decision
      .id ===
      refund
        .decision
        .id,
    "IDEMPOTENT_REPLAY_CREATED_NEW_DECISION",
  );

  /*
   * -------------------------------------------------------
   * Redemption request:
   *
   * explicitly persisted as disabled.
   * -------------------------------------------------------
   */
  const redemption =
    recordEconomicExitDecision({
      serialNumber:
        1001,

      tier:
        "EPIC",

      trigger:
        "REDEMPTION_REQUESTED",

      externalReference:
        "redemption-case-1001",
    });

  expect(
    redemption
      .decision
      .decision ===
      "DISABLED_REQUIRES_FUTURE_POLICY",
    "REDEMPTION_NOT_FAIL_CLOSED",
  );

  expect(
    redemption
      .decision
      .redemptionAuthorized ===
      false,
    "REDEMPTION_AUTHORIZED",
  );

  expect(
    redemption
      .decision
      .reserveDebitAuthorized ===
      false,
    "REDEMPTION_AUTHORIZED_RESERVE_DEBIT",
  );

  /*
   * -------------------------------------------------------
   * Burn request:
   *
   * no burn authority, no denominator mutation.
   * -------------------------------------------------------
   */
  const burn =
    recordEconomicExitDecision({
      serialNumber:
        3001,

      tier:
        "GENESIS",

      trigger:
        "NFT_BURN_REQUESTED",

      externalReference:
        "burn-case-3001",
    });

  expect(
    burn
      .decision
      .burnAuthorized ===
      false,
    "BURN_AUTHORIZED",
  );

  expect(
    burn
      .decision
      .navDenominatorChanges ===
      false,
    "BURN_CHANGED_NAV_DENOMINATOR",
  );

  expect(
    burn
      .decision
      .serialReusable ===
      false,
    "BURN_REUSED_SERIAL",
  );

  /*
   * -------------------------------------------------------
   * Transfer:
   *
   * ownership event has no reserve effect.
   * -------------------------------------------------------
   */
  const transfer =
    recordEconomicExitDecision({
      serialNumber:
        2,

      tier:
        "RARE",

      trigger:
        "NFT_TRANSFERRED",

      externalReference:
        "transfer-case-0002",
    });

  expect(
    transfer
      .decision
      .decision ===
      "NO_RESERVE_EFFECT",
    "TRANSFER_DECISION_INVALID",
  );

  expect(
    transfer
      .decision
      .reserveDebitAuthorized ===
      false,
    "TRANSFER_CHANGED_RESERVE",
  );

  /*
   * -------------------------------------------------------
   * Verify exact number of records.
   * Replay must not have created another row.
   * -------------------------------------------------------
   */
  const count =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM economic_exit_decisions
    `).get() as {
      count:
        number;
    };

  expect(
    Number(
      count.count,
    ) ===
      4,
    "DECISION_COUNT_INVALID",
  );

  /*
   * -------------------------------------------------------
   * Append-only enforcement.
   * -------------------------------------------------------
   */
  let updateRejected =
    false;

  try {
    db.prepare(`
      UPDATE economic_exit_decisions

      SET decision =
        'DISABLED_REQUIRES_FUTURE_POLICY'

      WHERE id = ?
    `).run(
      refund
        .decision
        .id,
    );
  } catch {
    updateRejected =
      true;
  }

  expect(
    updateRejected,
    "APPEND_ONLY_UPDATE_ALLOWED",
  );

  let deleteRejected =
    false;

  try {
    db.prepare(`
      DELETE FROM economic_exit_decisions

      WHERE id = ?
    `).run(
      refund
        .decision
        .id,
    );
  } catch {
    deleteRejected =
      true;
  }

  expect(
    deleteRejected,
    "APPEND_ONLY_DELETE_ALLOWED",
  );

  /*
   * Evidence must preserve policy identity.
   */
  const evidenceRow =
    db.prepare(`
      SELECT
        evidence_json AS evidenceJson

      FROM economic_exit_decisions

      WHERE id = ?
    `).get(
      refund
        .decision
        .id,
    ) as {
      evidenceJson:
        string;
    };

  const evidence =
    JSON.parse(
      evidenceRow
        .evidenceJson,
    ) as Record<
      string,
      unknown
    >;

  expect(
    evidence.policyVersion ===
      "OX-ECONOMIC-EXIT-1",
    "EVIDENCE_POLICY_VERSION_MISSING",
  );

  expect(
    evidence.navSupplyBasis ===
      "HISTORICAL_ISSUED_SUPPLY",
    "EVIDENCE_NAV_SUPPLY_BASIS_MISSING",
  );

  console.log(
    "OX_ECONOMIC_EXIT_DECISION_SQLITE=PASS",
  );

  console.log(
    "APPEND_ONLY=PASS",
  );

  console.log(
    "UPDATE_REJECTED=PASS",
  );

  console.log(
    "DELETE_REJECTED=PASS",
  );

  console.log(
    "IDEMPOTENT_REPLAY=PASS",
  );

  console.log(
    "REFUND_RESERVE_DEBIT=NO",
  );

  console.log(
    "REDEMPTION_AUTHORIZED=NO",
  );

  console.log(
    "BURN_AUTHORIZED=NO",
  );

  console.log(
    "TRANSFER_RESERVE_EFFECT=NO",
  );

  console.log(
    "NAV_DENOMINATOR_MUTATION=NO",
  );

  console.log(
    "SERIAL_REUSE=NO",
  );
} finally {
  rmSync(
    tempDirectory,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
