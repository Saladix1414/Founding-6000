import {
  env,
} from "../config/env.js";

import {
  createPendingReserveSweep,
} from "./reserveSweepService.js";

import {
  processReserveSweepOnce,
} from "../web3/reserveSweepExecutor.js";

import {
  captureReserveProofSnapshot,
} from "./reserveProofService.js";

export async function runReserveAutomationCycle() {
  if (
    !env.RESERVE_SWEEP_ENABLED
  ) {
    return {
      status:
        "disabled" as const,

      sweep:
        null,

      snapshot:
        null,
    };
  }

  const sweepCreation =
    createPendingReserveSweep();

  const execution =
    await processReserveSweepOnce();

  /*
   * A Proof-of-Reserve snapshot is created only
   * after an on-chain sweep has reached the required
   * confirmation threshold.
   *
   * No optimistic accounting.
   */
  if (
    execution.status !==
    "confirmed"
  ) {
    return {
      status:
        execution.status,

      sweep:
        sweepCreation,

      execution,

      snapshot:
        null,
    };
  }

  if (
    !env.RESERVE_PROOF_ENABLED
  ) {
    return {
      status:
        "confirmed_without_snapshot" as const,

      sweep:
        sweepCreation,

      execution,

      snapshot:
        null,
    };
  }

  const snapshot =
    await captureReserveProofSnapshot();

  return {
    status:
      "confirmed_and_snapshotted" as const,

    sweep:
      sweepCreation,

    execution,

    snapshot: {
      snapshotHash:
        snapshot.snapshotHash,

      totalLiabilityMinor:
        snapshot
          .ledger
          .totalLiabilityMinor,

      onchainVaultBalanceMinor:
        snapshot
          .proof
          .onchainVaultBalanceMinor,

      coverageBps:
        snapshot
          .proof
          .coverageBps,

      fullyCovered:
        snapshot
          .proof
          .fullyCovered,
    },
  };
}
