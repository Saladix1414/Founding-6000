export const WALLET_TREASURY_AUTHORITY_VERSION =
  "OX-WALLET-TREASURY-AUTHORITY-1" as const;

export const WALLET_AUTHORITY_ROLES = [
  "PAYMENT_RECEIVER",
  "OPERATING_TREASURY",
  "RESERVE_VAULT",
  "NFT_MINTER",
  "ADMIN",
] as const;

export type WalletAuthorityRole =
  (typeof WALLET_AUTHORITY_ROLES)[number];

export interface WalletAuthorityAssignment {
  role: WalletAuthorityRole;
  address: string | null;
}

export interface WalletAuthorityState {
  assignments: WalletAuthorityAssignment[];

  nftMintEnabled: boolean;
  reserveSweepEnabled: boolean;
  treasuryActionAuthorized: boolean;
  mainnetMintAuthorized: boolean;
}

export interface WalletAuthorityValidation {
  valid: boolean;
  blockingReasons: string[];
}

const NORMALIZED_ADDRESS =
  /^0x[a-fA-F0-9]{40}$/;

const REQUIRED_SEPARATION:
  ReadonlyArray<
    readonly [
      WalletAuthorityRole,
      WalletAuthorityRole,
    ]
  > = [
    ["PAYMENT_RECEIVER", "NFT_MINTER"],
    ["RESERVE_VAULT", "NFT_MINTER"],
    ["OPERATING_TREASURY", "NFT_MINTER"],
    ["ADMIN", "NFT_MINTER"],
    ["RESERVE_VAULT", "OPERATING_TREASURY"],
    ["RESERVE_VAULT", "PAYMENT_RECEIVER"],
  ];

function normalizeAddress(
  value: string,
): string {
  return value.toLowerCase();
}

export function validateWalletAuthorityState(
  state: WalletAuthorityState,
): WalletAuthorityValidation {
  const blockingReasons: string[] = [];

  const seenRoles =
    new Set<WalletAuthorityRole>();

  const byRole =
    new Map<
      WalletAuthorityRole,
      string | null
    >();

  for (const assignment of state.assignments) {
    if (seenRoles.has(assignment.role)) {
      blockingReasons.push(
        `DUPLICATE_ROLE_ASSIGNMENT:${assignment.role}`,
      );
      continue;
    }

    seenRoles.add(assignment.role);

    if (
      assignment.address !== null &&
      !NORMALIZED_ADDRESS.test(
        assignment.address,
      )
    ) {
      blockingReasons.push(
        `INVALID_ADDRESS:${assignment.role}`,
      );
      continue;
    }

    byRole.set(
      assignment.role,
      assignment.address === null
        ? null
        : normalizeAddress(
            assignment.address,
          ),
    );
  }

  for (
    const role of WALLET_AUTHORITY_ROLES
  ) {
    if (!seenRoles.has(role)) {
      blockingReasons.push(
        `MISSING_ROLE:${role}`,
      );
    }
  }

  for (
    const [
      leftRole,
      rightRole,
    ] of REQUIRED_SEPARATION
  ) {
    const left =
      byRole.get(leftRole);

    const right =
      byRole.get(rightRole);

    if (
      left &&
      right &&
      left === right
    ) {
      blockingReasons.push(
        `ROLE_COLLISION:${leftRole}:${rightRole}`,
      );
    }
  }

  if (state.nftMintEnabled) {
    blockingReasons.push(
      "NFT_MINT_MUST_REMAIN_DISABLED",
    );
  }

  if (state.reserveSweepEnabled) {
    blockingReasons.push(
      "RESERVE_SWEEP_MUST_REMAIN_DISABLED",
    );
  }

  if (state.treasuryActionAuthorized) {
    blockingReasons.push(
      "TREASURY_ACTION_MUST_REMAIN_UNAUTHORIZED",
    );
  }

  if (state.mainnetMintAuthorized) {
    blockingReasons.push(
      "MAINNET_MINT_MUST_REMAIN_UNAUTHORIZED",
    );
  }

  return {
    valid:
      blockingReasons.length === 0,
    blockingReasons,
  };
}

export function assertWalletAuthorityState(
  state: WalletAuthorityState,
): void {
  const result =
    validateWalletAuthorityState(state);

  if (!result.valid) {
    throw new Error(
      [
        "WALLET_TREASURY_AUTHORITY_INVALID",
        ...result.blockingReasons,
      ].join("\n"),
    );
  }
}
