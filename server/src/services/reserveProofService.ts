import {
  randomUUID,
} from "node:crypto";

import {
  db,
} from "../db/database.js";

import {
  ensureReserveProofSchema,
} from "../db/reserveProofSchema.js";

import {
  createAuditEvent,
} from "../repositories/auditRepository.js";

import {
  getReserveBalances,
} from "./reserveService.js";

import {
  buildReserveSnapshot,
} from "../economics/reserveSnapshotPolicy.js";

import {
  readReserveVaultBalanceMinor,
} from "../web3/reserveVault.js";

ensureReserveProofSchema();

function getIssuedSupply() {
  const row =
    db.prepare(`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 1 AND 1000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS rare,

        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 1001 AND 3000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS epic,

        COALESCE(
          SUM(
            CASE
              WHEN serial_number
                BETWEEN 3001 AND 6000
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS genesis

      FROM inventory_allocations
    `).get() as {
      rare: number;
      epic: number;
      genesis: number;
    };

  return {
    RARE:
      Number(
        row.rare,
      ),

    EPIC:
      Number(
        row.epic,
      ),

    GENESIS:
      Number(
        row.genesis,
      ),
  };
}

export async function captureReserveProofSnapshot() {
  ensureReserveProofSchema();

  const ledgerBalances =
    getReserveBalances();

  const issuedSupply =
    getIssuedSupply();

  const onchain =
    await readReserveVaultBalanceMinor();

  const snapshot =
    buildReserveSnapshot({
      capturedAt:
        new Date()
          .toISOString(),

      network:
        onchain.network,

      chainId:
        onchain.chainId,

      tokenContract:
        onchain.tokenContract,

      vaultAddress:
        onchain.vaultAddress,

      ledgerBalancesMinor:
        ledgerBalances,

      issuedSupply,

      onchainVaultBalanceMinor:
        onchain.balanceMinor,
    });

  const id =
    randomUUID();

  const createdAt =
    new Date()
      .toISOString();

  db.prepare(`
    INSERT INTO reserve_snapshots (
      id,
      snapshot_version,
      snapshot_hash,
      captured_at,
      network,
      chain_id,
      token_contract,
      vault_address,
      total_liability_minor,
      onchain_balance_minor,
      surplus_deficit_minor,
      coverage_bps,
      fully_covered,
      rare_balance_minor,
      epic_balance_minor,
      genesis_balance_minor,
      rare_issued_supply,
      epic_issued_supply,
      genesis_issued_supply,
      rare_nav_minor,
      epic_nav_minor,
      genesis_nav_minor,
      snapshot_json,
      created_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    snapshot.snapshotVersion,
    snapshot.snapshotHash,
    snapshot.capturedAt,
    snapshot.network.name,
    snapshot.network.chainId,
    snapshot.network.tokenContract,
    snapshot.network.vaultAddress,
    Number(
      BigInt(
        snapshot
          .ledger
          .totalLiabilityMinor,
      ),
    ),
    Number(
      BigInt(
        snapshot
          .proof
          .onchainVaultBalanceMinor,
      ),
    ),
    Number(
      BigInt(
        snapshot
          .proof
          .surplusDeficitMinor,
      ),
    ),
    snapshot
      .proof
      .coverageBps,
    snapshot
      .proof
      .fullyCovered
      ? 1
      : 0,
    Number(
      ledgerBalances.RARE,
    ),
    Number(
      ledgerBalances.EPIC,
    ),
    Number(
      ledgerBalances.GENESIS,
    ),
    issuedSupply.RARE,
    issuedSupply.EPIC,
    issuedSupply.GENESIS,
    snapshot
      .navMinorPerIssuedNft
      .RARE,
    snapshot
      .navMinorPerIssuedNft
      .EPIC,
    snapshot
      .navMinorPerIssuedNft
      .GENESIS,
    JSON.stringify(
      snapshot,
    ),
    createdAt,
  );

  createAuditEvent({
    eventType:
      "RESERVE_SNAPSHOT_PUBLISHED",

    entityType:
      "FOUNDING_RESERVE",

    entityId:
      id,

    payload: {
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
  });

  return snapshot;
}

export function getLatestReserveSnapshot() {
  ensureReserveProofSchema();

  const row =
    db.prepare(`
      SELECT
        snapshot_json
          AS snapshotJson

      FROM reserve_snapshots

      ORDER BY
        captured_at DESC,
        created_at DESC

      LIMIT 1
    `).get() as
      | {
          snapshotJson:
            string;
        }
      | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(
    row.snapshotJson,
  ) as Record<
    string,
    unknown
  >;
}
