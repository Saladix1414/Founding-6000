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
      "ox-economy-history-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    tempDirectory,
    "history.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  /*
   * Minimal real SQLite schema required by
   * economyHistoryService.
   *
   * No network, payment or production database is used.
   */
  db.exec(`
    CREATE TABLE reserve_contributions (
      id TEXT PRIMARY KEY,
      serial_number INTEGER NOT NULL UNIQUE,
      sale_tier TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE reserve_allocations (
      id TEXT PRIMARY KEY,
      contribution_id TEXT NOT NULL,
      beneficiary_tier TEXT NOT NULL,
      amount_minor INTEGER NOT NULL
    );

    CREATE TABLE reserve_snapshots (
      id TEXT PRIMARY KEY,

      snapshot_version TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL UNIQUE,
      captured_at TEXT NOT NULL,

      network TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      token_contract TEXT NOT NULL,
      vault_address TEXT NOT NULL,

      total_liability_minor INTEGER NOT NULL,
      onchain_balance_minor INTEGER NOT NULL,
      surplus_deficit_minor INTEGER NOT NULL,
      coverage_bps TEXT,
      fully_covered INTEGER NOT NULL,

      rare_balance_minor INTEGER NOT NULL,
      epic_balance_minor INTEGER NOT NULL,
      genesis_balance_minor INTEGER NOT NULL,

      rare_issued_supply INTEGER NOT NULL,
      epic_issued_supply INTEGER NOT NULL,
      genesis_issued_supply INTEGER NOT NULL,

      rare_nav_minor TEXT,
      epic_nav_minor TEXT,
      genesis_nav_minor TEXT,

      created_at TEXT NOT NULL
    );
  `);

  const insertContribution =
    db.prepare(`
      INSERT INTO reserve_contributions (
        id,
        serial_number,
        sale_tier,
        created_at
      )
      VALUES (?, ?, ?, ?)
    `);

  const insertAllocation =
    db.prepare(`
      INSERT INTO reserve_allocations (
        id,
        contribution_id,
        beneficiary_tier,
        amount_minor
      )
      VALUES (?, ?, ?, ?)
    `);

  /*
   * Canonical own-tier economic baselines:
   *
   * RARE    50 USDT sale → 12.50 USDT own tier
   * EPIC    70 USDT sale →  5.25 USDT own tier
   * GENESIS 90 USDT sale →  6.75 USDT own tier
   */
  insertContribution.run(
    "c_rare",
    1,
    "RARE",
    "2026-10-21T10:00:00.000Z",
  );

  insertAllocation.run(
    "a_rare",
    "c_rare",
    "RARE",
    12_500_000,
  );

  insertContribution.run(
    "c_epic",
    1001,
    "EPIC",
    "2026-10-21T10:00:00.000Z",
  );

  insertAllocation.run(
    "a_epic",
    "c_epic",
    "EPIC",
    5_250_000,
  );

  insertContribution.run(
    "c_genesis",
    3001,
    "GENESIS",
    "2026-10-21T10:00:00.000Z",
  );

  insertAllocation.run(
    "a_genesis",
    "c_genesis",
    "GENESIS",
    6_750_000,
  );

  const insertSnapshot =
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
        created_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

  /*
   * Snapshot before token acquisition.
   * This MUST NEVER appear in the token timeline.
   */
  insertSnapshot.run(
    "s_pre",
    "OX-RESERVE-SNAPSHOT-1",
    "sha256:pre",
    "2026-10-21T09:00:00.000Z",
    "ethereum-mainnet",
    1,
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x1111111111111111111111111111111111111111",
    10_000_000,
    10_000_000,
    0,
    "10000",
    1,
    10_000_000,
    0,
    0,
    1,
    0,
    0,
    "10000000",
    null,
    null,
    "2026-10-21T09:00:00.000Z",
  );

  insertSnapshot.run(
    "s1",
    "OX-RESERVE-SNAPSHOT-1",
    "sha256:s1",
    "2026-10-21T11:00:00.000Z",
    "ethereum-mainnet",
    1,
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x1111111111111111111111111111111111111111",
    26_000_000,
    26_000_000,
    0,
    "10000",
    1,
    13_000_000,
    6_000_000,
    7_000_000,
    1,
    1,
    1,
    "13000000",
    "6000000",
    "7000000",
    "2026-10-21T11:00:00.000Z",
  );

  insertSnapshot.run(
    "s2",
    "OX-RESERVE-SNAPSHOT-1",
    "sha256:s2",
    "2026-10-21T12:00:00.000Z",
    "ethereum-mainnet",
    1,
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x1111111111111111111111111111111111111111",
    27_000_000,
    26_000_000,
    -1_000_000,
    "9629",
    0,
    14_000_000,
    6_150_000,
    6_850_000,
    1,
    1,
    1,
    "14000000",
    "6150000",
    "6850000",
    "2026-10-21T12:00:00.000Z",
  );

  insertSnapshot.run(
    "s3",
    "OX-RESERVE-SNAPSHOT-1",
    "sha256:s3",
    "2026-10-21T13:00:00.000Z",
    "ethereum-mainnet",
    1,
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x1111111111111111111111111111111111111111",
    28_050_000,
    28_050_000,
    0,
    "10000",
    1,
    15_000_000,
    6_300_000,
    6_750_000,
    1,
    1,
    1,
    "15000000",
    "6300000",
    "6750000",
    "2026-10-21T13:00:00.000Z",
  );

  const {
    getTokenEconomyHistory,
  } =
    await import(
      "../services/economyHistoryService.js"
    );

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
   * RARE #0001
   * -------------------------------------------------------
   *
   * Page 1 = s3, s2
   * Page 2 = s1
   *
   * s_pre is excluded because it predates acquisition.
   */
  const rarePage1 =
    getTokenEconomyHistory({
      tokenId:
        1,

      limit:
        2,
    });

  expect(
    rarePage1 !== null,
    "RARE_HISTORY_MISSING",
  );

  if (!rarePage1) {
    throw new Error(
      "RARE_HISTORY_MISSING",
    );
  }

  expect(
    rarePage1.items.length ===
      2,
    "RARE_PAGE_1_SIZE_INVALID",
  );

  expect(
    rarePage1.items[0]
      ?.snapshotHash ===
      "sha256:s3",
    "RARE_HISTORY_NOT_NEWEST_FIRST",
  );

  expect(
    rarePage1.items[1]
      ?.snapshotHash ===
      "sha256:s2",
    "RARE_SECOND_SNAPSHOT_INVALID",
  );

  expect(
    rarePage1.pagination
      .hasMore === true,
    "RARE_HAS_MORE_INVALID",
  );

  expect(
    rarePage1.pagination
      .nextCursor ===
      "sha256:s2",
    "RARE_CURSOR_INVALID",
  );

  expect(
    rarePage1.items[0]
      ?.reserve
      .navMinor ===
      "15000000",
    "RARE_NAV_INVALID",
  );

  expect(
    rarePage1.items[0]
      ?.growth
      .baseMinor ===
      "12500000",
    "RARE_BASE_INVALID",
  );

  expect(
    rarePage1.items[0]
      ?.growth
      .growthBps ===
      "2000",
    "RARE_GROWTH_INVALID",
  );

  expect(
    rarePage1.items[1]
      ?.proofOfReserve
      .status ===
      "NOT_FULLY_COVERED",
    "PROOF_HISTORY_STATUS_INVALID",
  );

  const rarePage2 =
    getTokenEconomyHistory({
      tokenId:
        1,

      limit:
        2,

      cursor:
        rarePage1
          .pagination
          .nextCursor,
    });

  expect(
    rarePage2 !== null,
    "RARE_PAGE_2_MISSING",
  );

  if (!rarePage2) {
    throw new Error(
      "RARE_PAGE_2_MISSING",
    );
  }

  expect(
    rarePage2.items.length ===
      1,
    "RARE_PAGE_2_SIZE_INVALID",
  );

  expect(
    rarePage2.items[0]
      ?.snapshotHash ===
      "sha256:s1",
    "RARE_PAGE_2_SNAPSHOT_INVALID",
  );

  expect(
    rarePage2.pagination
      .hasMore === false,
    "RARE_PAGE_2_HAS_MORE_INVALID",
  );

  expect(
    rarePage2.pagination
      .nextCursor === null,
    "RARE_FINAL_CURSOR_INVALID",
  );

  const rareHashes = [
    ...rarePage1.items,
    ...rarePage2.items,
  ].map(
    (
      item,
    ) =>
      item.snapshotHash,
  );

  expect(
    new Set(
      rareHashes,
    ).size ===
      rareHashes.length,
    "HISTORY_DUPLICATE_SNAPSHOT",
  );

  expect(
    !rareHashes.includes(
      "sha256:pre",
    ),
    "PRE_ACQUISITION_SNAPSHOT_EXPOSED",
  );

  /*
   * -------------------------------------------------------
   * EPIC #1001
   * -------------------------------------------------------
   */
  const epic =
    getTokenEconomyHistory({
      tokenId:
        1001,

      limit:
        10,
    });

  expect(
    epic !== null,
    "EPIC_HISTORY_MISSING",
  );

  if (!epic) {
    throw new Error(
      "EPIC_HISTORY_MISSING",
    );
  }

  expect(
    epic.collectionTier ===
      "EPIC",
    "EPIC_TIER_INVALID",
  );

  expect(
    epic.items[0]
      ?.growth
      .baseMinor ===
      "5250000",
    "EPIC_BASE_INVALID",
  );

  expect(
    epic.items[0]
      ?.reserve
      .navMinor ===
      "6300000",
    "EPIC_NAV_INVALID",
  );

  expect(
    epic.items[0]
      ?.growth
      .growthBps ===
      "2000",
    "EPIC_GROWTH_INVALID",
  );

  /*
   * -------------------------------------------------------
   * GENESIS #3001
   * -------------------------------------------------------
   */
  const genesis =
    getTokenEconomyHistory({
      tokenId:
        3001,

      limit:
        10,
    });

  expect(
    genesis !== null,
    "GENESIS_HISTORY_MISSING",
  );

  if (!genesis) {
    throw new Error(
      "GENESIS_HISTORY_MISSING",
    );
  }

  expect(
    genesis.collectionTier ===
      "GENESIS",
    "GENESIS_TIER_INVALID",
  );

  expect(
    genesis.items[0]
      ?.growth
      .baseMinor ===
      "6750000",
    "GENESIS_BASE_INVALID",
  );

  expect(
    genesis.items[0]
      ?.reserve
      .navMinor ===
      "6750000",
    "GENESIS_NAV_INVALID",
  );

  expect(
    genesis.items[0]
      ?.growth
      .growthBps ===
      "0",
    "GENESIS_GROWTH_INVALID",
  );

  /*
   * Unknown token must not inherit another
   * token's economic history.
   */
  const nonexistent =
    getTokenEconomyHistory({
      tokenId:
        999,

      limit:
        10,
    });

  expect(
    nonexistent ===
      null,
    "NONEXISTENT_TOKEN_HISTORY_LEAK",
  );

  /*
   * Invalid cursor must fail closed.
   */
  let invalidCursorRejected =
    false;

  try {
    getTokenEconomyHistory({
      tokenId:
        1,

      limit:
        2,

      cursor:
        "sha256:missing",
    });
  } catch (
    error
  ) {
    invalidCursorRejected =
      error instanceof
        Error &&
      error.message ===
        "ECONOMY_HISTORY_CURSOR_NOT_FOUND";
  }

  expect(
    invalidCursorRejected,
    "INVALID_CURSOR_NOT_REJECTED",
  );

  console.log(
    "OX_ECONOMY_HISTORY_SQLITE=PASS",
  );

  console.log(
    "REAL_SQLITE_QUERY=PASS",
  );

  console.log(
    "NEWEST_FIRST=PASS",
  );

  console.log(
    "KEYSET_PAGE_1=PASS",
  );

  console.log(
    "KEYSET_PAGE_2=PASS",
  );

  console.log(
    "DUPLICATE_SNAPSHOTS=NO",
  );

  console.log(
    "PRE_ACQUISITION_HISTORY_EXPOSED=NO",
  );

  console.log(
    "RARE_NAV_HISTORY=PASS",
  );

  console.log(
    "EPIC_NAV_HISTORY=PASS",
  );

  console.log(
    "GENESIS_NAV_HISTORY=PASS",
  );

  console.log(
    "PROOF_STATUS_HISTORY=PASS",
  );

  console.log(
    "INVALID_CURSOR_REJECTED=PASS",
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
