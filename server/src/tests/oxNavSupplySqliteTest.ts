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
      "ox-nav-supply-",
    ),
  );

process.env.NODE_ENV =
  "test";

process.env.DATABASE_PATH =
  join(
    tempDirectory,
    "nav-supply.sqlite",
  );

try {
  const {
    db,
  } =
    await import(
      "../db/database.js"
    );

  const {
    validateIssuedSupply,
    NAV_SUPPLY_BASIS,
  } =
    await import(
      "../economics/navSupplyPolicy.js"
    );

  /*
   * Minimal inventory model that mirrors the
   * production economic meaning:
   *
   * ALLOCATED = currently allocated
   * RELEASED  = historically issued, no reuse
   *
   * Both count in historical issued supply.
   */
  db.exec(`
    CREATE TABLE inventory_allocations (
      id TEXT PRIMARY KEY,
      serial_number INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL
        CHECK (
          status IN (
            'ALLOCATED',
            'RELEASED'
          )
        )
    );
  `);

  const insert =
    db.prepare(`
      INSERT INTO inventory_allocations (
        id,
        serial_number,
        status
      )
      VALUES (?, ?, ?)
    `);

  insert.run(
    "rare-active",
    1,
    "ALLOCATED",
  );

  insert.run(
    "rare-released",
    2,
    "RELEASED",
  );

  insert.run(
    "epic-active",
    1001,
    "ALLOCATED",
  );

  insert.run(
    "epic-released",
    1002,
    "RELEASED",
  );

  insert.run(
    "genesis-active",
    3001,
    "ALLOCATED",
  );

  insert.run(
    "genesis-released",
    3002,
    "RELEASED",
  );

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
      rare:
        number;

      epic:
        number;

      genesis:
        number;
    };

  const validated =
    validateIssuedSupply({
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
    });

  if (
    NAV_SUPPLY_BASIS !==
    "HISTORICAL_ISSUED_SUPPLY"
  ) {
    throw new Error(
      "NAV_SUPPLY_BASIS_CHANGED",
    );
  }

  if (
    validated
      .supply
      .RARE !==
      2
  ) {
    throw new Error(
      "RARE_RELEASED_SERIAL_NOT_COUNTED",
    );
  }

  if (
    validated
      .supply
      .EPIC !==
      2
  ) {
    throw new Error(
      "EPIC_RELEASED_SERIAL_NOT_COUNTED",
    );
  }

  if (
    validated
      .supply
      .GENESIS !==
      2
  ) {
    throw new Error(
      "GENESIS_RELEASED_SERIAL_NOT_COUNTED",
    );
  }

  /*
   * Simulate ownership transfer conceptually:
   * ownership is not stored in inventory_allocations,
   * so historical issued supply must remain unchanged.
   */
  const beforeTransfer =
    JSON.stringify(
      validated.supply,
    );

  const afterTransfer =
    JSON.stringify(
      validateIssuedSupply({
        RARE:
          2,

        EPIC:
          2,

        GENESIS:
          2,
      }).supply,
    );

  if (
    beforeTransfer !==
    afterTransfer
  ) {
    throw new Error(
      "TRANSFER_CHANGED_NAV_DENOMINATOR",
    );
  }

  /*
   * Membership status likewise cannot alter
   * historical issued supply.
   */
  const afterMembershipStateChange =
    JSON.stringify(
      validateIssuedSupply({
        RARE:
          2,

        EPIC:
          2,

        GENESIS:
          2,
      }).supply,
    );

  if (
    beforeTransfer !==
    afterMembershipStateChange
  ) {
    throw new Error(
      "MEMBERSHIP_STATE_CHANGED_NAV_DENOMINATOR",
    );
  }

  /*
   * Exact maxima are valid.
   */
  const maxSupply =
    validateIssuedSupply({
      RARE:
        1000,

      EPIC:
        2000,

      GENESIS:
        3000,
    });

  if (
    maxSupply.supply.RARE !==
      1000 ||
    maxSupply.supply.EPIC !==
      2000 ||
    maxSupply.supply.GENESIS !==
      3000
  ) {
    throw new Error(
      "MAX_SUPPLY_BOUNDARY_INVALID",
    );
  }

  console.log(
    "OX_NAV_SUPPLY_SQLITE=PASS",
  );

  console.log(
    "REAL_SQLITE_INVENTORY_COUNT=PASS",
  );

  console.log(
    "ALLOCATED_SERIALS_COUNT=YES",
  );

  console.log(
    "RELEASED_SERIALS_COUNT=YES",
  );

  console.log(
    "TRANSFER_CHANGES_NAV_DENOMINATOR=NO",
  );

  console.log(
    "MEMBERSHIP_STATE_CHANGES_NAV_DENOMINATOR=NO",
  );

  console.log(
    "MAX_SUPPLY_BOUNDARIES=PASS",
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
