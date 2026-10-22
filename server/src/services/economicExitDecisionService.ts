import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureEconomicExitDecisionSchema,
} from "../db/economicExitDecisionSchema.js";

import {
  evaluateEconomicExit,
  type EconomicExitTrigger,
} from "../economics/economicExitPolicy.js";

import {
  type FoundingCollectionTier,
} from "../economics/foundingEconomicsPolicy.js";

ensureEconomicExitDecisionSchema();

type EconomicExitDecisionRow = {
  id:
    string;

  idempotencyKey:
    string;

  serialNumber:
    number;

  collectionTier:
    FoundingCollectionTier;

  trigger:
    EconomicExitTrigger;

  decision:
    | "NO_RESERVE_EFFECT"
    | "DISABLED_REQUIRES_FUTURE_POLICY";

  reserveDebitAuthorized:
    number;

  navDenominatorChanges:
    number;

  serialReusable:
    number;

  burnAuthorized:
    number;

  redemptionAuthorized:
    number;

  exitPolicyVersion:
    string;

  navSupplyPolicyVersion:
    string;

  navSupplyBasis:
    string;

  evidenceJson:
    string;

  createdAt:
    string;
};

function normalizeDecision(
  row:
    EconomicExitDecisionRow,
) {
  return {
    id:
      row.id,

    idempotencyKey:
      row.idempotencyKey,

    serialNumber:
      Number(
        row.serialNumber,
      ),

    collectionTier:
      row.collectionTier,

    trigger:
      row.trigger,

    decision:
      row.decision,

    reserveDebitAuthorized:
      Boolean(
        row.reserveDebitAuthorized,
      ),

    navDenominatorChanges:
      Boolean(
        row.navDenominatorChanges,
      ),

    serialReusable:
      Boolean(
        row.serialReusable,
      ),

    burnAuthorized:
      Boolean(
        row.burnAuthorized,
      ),

    redemptionAuthorized:
      Boolean(
        row.redemptionAuthorized,
      ),

    exitPolicyVersion:
      row.exitPolicyVersion,

    navSupplyPolicyVersion:
      row.navSupplyPolicyVersion,

    navSupplyBasis:
      row.navSupplyBasis,

    evidence:
      JSON.parse(
        row.evidenceJson,
      ) as Record<
        string,
        unknown
      >,

    createdAt:
      row.createdAt,
  };
}

function selectDecisionByIdempotencyKey(
  idempotencyKey:
    string,
) {
  return db.prepare(`
    SELECT
      id,

      idempotency_key
        AS idempotencyKey,

      serial_number
        AS serialNumber,

      collection_tier
        AS collectionTier,

      trigger,

      decision,

      reserve_debit_authorized
        AS reserveDebitAuthorized,

      nav_denominator_changes
        AS navDenominatorChanges,

      serial_reusable
        AS serialReusable,

      burn_authorized
        AS burnAuthorized,

      redemption_authorized
        AS redemptionAuthorized,

      exit_policy_version
        AS exitPolicyVersion,

      nav_supply_policy_version
        AS navSupplyPolicyVersion,

      nav_supply_basis
        AS navSupplyBasis,

      evidence_json
        AS evidenceJson,

      created_at
        AS createdAt

    FROM economic_exit_decisions

    WHERE idempotency_key = ?

    LIMIT 1
  `).get(
    idempotencyKey,
  ) as
    | EconomicExitDecisionRow
    | undefined;
}

export function buildEconomicExitIdempotencyKey(
  input: {
    serialNumber:
      number;

    trigger:
      EconomicExitTrigger;

    externalReference:
      string;
  },
) {
  const externalReference =
    input.externalReference
      .trim();

  if (
    externalReference.length <
      8
  ) {
    throw new Error(
      "INVALID_ECONOMIC_EXIT_EXTERNAL_REFERENCE",
    );
  }

  return createHash(
    "sha256",
  )
    .update(
      [
        "ORIGINX",
        "ECONOMIC_EXIT",
        input.serialNumber,
        input.trigger,
        externalReference,
      ].join(
        ":",
      ),
    )
    .digest(
      "hex",
    );
}

export function recordEconomicExitDecision(
  input: {
    serialNumber:
      number;

    tier:
      FoundingCollectionTier;

    trigger:
      EconomicExitTrigger;

    externalReference:
      string;

    evidence?:
      Record<
        string,
        unknown
      >;
  },
) {
  ensureEconomicExitDecisionSchema();

  const idempotencyKey =
    buildEconomicExitIdempotencyKey({
      serialNumber:
        input.serialNumber,

      trigger:
        input.trigger,

      externalReference:
        input.externalReference,
    });

  const existing =
    selectDecisionByIdempotencyKey(
      idempotencyKey,
    );

  if (existing) {
    /*
     * Same idempotency identity may replay only
     * the same semantic request.
     */
    if (
      existing.serialNumber !==
        input.serialNumber ||
      existing.collectionTier !==
        input.tier ||
      existing.trigger !==
        input.trigger
    ) {
      throw new Error(
        "ECONOMIC_EXIT_IDEMPOTENCY_CONFLICT",
      );
    }

    return {
      decision:
        normalizeDecision(
          existing,
        ),

      idempotentReplay:
        true,
    };
  }

  const policy =
    evaluateEconomicExit({
      serialNumber:
        input.serialNumber,

      tier:
        input.tier,

      trigger:
        input.trigger,
    });

  /*
   * OX-ECONOMIC-EXIT-1 is fail-closed.
   *
   * This guard protects the persistence layer as well:
   * this service must not currently record an
   * authorized reserve debit, redemption or burn.
   */
  if (
    policy.reserveDebitAuthorized ||
    policy.navDenominatorChanges ||
    policy.serialReusable ||
    policy.burnAuthorized ||
    policy.redemptionAuthorized
  ) {
    throw new Error(
      "ECONOMIC_EXIT_POLICY_AUTHORITY_NOT_SUPPORTED",
    );
  }

  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

  const evidence = {
    externalReference:
      input.externalReference,

    policyVersion:
      policy.policyVersion,

    trigger:
      input.trigger,

    decision:
      policy.decision,

    reserveDebitAuthorized:
      policy.reserveDebitAuthorized,

    navDenominatorChanges:
      policy.navDenominatorChanges,

    serialReusable:
      policy.serialReusable,

    burnAuthorized:
      policy.burnAuthorized,

    redemptionAuthorized:
      policy.redemptionAuthorized,

    navSupplyPolicyVersion:
      policy.navSupplyPolicyVersion,

    navSupplyBasis:
      policy.navSupplyBasis,

    context:
      input.evidence ??
      {},
  };

  db.prepare(`
    INSERT INTO economic_exit_decisions (
      id,
      idempotency_key,
      serial_number,
      collection_tier,
      trigger,
      decision,
      reserve_debit_authorized,
      nav_denominator_changes,
      serial_reusable,
      burn_authorized,
      redemption_authorized,
      exit_policy_version,
      nav_supply_policy_version,
      nav_supply_basis,
      evidence_json,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    idempotencyKey,
    input.serialNumber,
    input.tier,
    input.trigger,
    policy.decision,
    policy.reserveDebitAuthorized
      ? 1
      : 0,
    policy.navDenominatorChanges
      ? 1
      : 0,
    policy.serialReusable
      ? 1
      : 0,
    policy.burnAuthorized
      ? 1
      : 0,
    policy.redemptionAuthorized
      ? 1
      : 0,
    policy.policyVersion,
    policy.navSupplyPolicyVersion,
    policy.navSupplyBasis,
    JSON.stringify(
      evidence,
    ),
    createdAt,
  );

  const created =
    selectDecisionByIdempotencyKey(
      idempotencyKey,
    );

  if (!created) {
    throw new Error(
      "ECONOMIC_EXIT_DECISION_PERSISTENCE_FAILED",
    );
  }

  return {
    decision:
      normalizeDecision(
        created,
      ),

    idempotentReplay:
      false,
  };
}
