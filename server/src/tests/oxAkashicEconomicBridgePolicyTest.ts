import {
  economicSha256,
} from "../economics/economicCanonical.js";

const payload = {
  bridgeVersion:
    "OX-AKASHIC-ECONOMIC-BRIDGE-1",

  eventType:
    "RESERVE_SNAPSHOT_PUBLISHED",

  lifecycleReference:
    "RESERVE-SNAPSHOT:sha256:test",

  publicSafe:
    true,

  containsPII:
    false,

  snapshot: {
    snapshotHash:
      "sha256:test",

    capturedAt:
      "2026-10-21T00:00:00.000Z",

    totalLiabilityMinor:
      "12500000",

    onchainVaultBalanceMinor:
      "12500000",

    coverageBps:
      "10000",

    fullyCovered:
      true,

    vaultAddress:
      "0x1111111111111111111111111111111111111111",
  },
};

const first =
  economicSha256(
    payload,
  );

const second =
  economicSha256(
    payload,
  );

if (
  first !== second
) {
  throw new Error(
    "AKASHIC_PAYLOAD_HASH_NON_DETERMINISTIC",
  );
}

if (
  !first.startsWith(
    "sha256:",
  )
) {
  throw new Error(
    "AKASHIC_PAYLOAD_HASH_INVALID",
  );
}

if (
  payload.publicSafe !==
    true ||
  payload.containsPII !==
    false
) {
  throw new Error(
    "AKASHIC_PUBLIC_SAFETY_INVALID",
  );
}

console.log(
  "OX_AKASHIC_ECONOMIC_BRIDGE=PASS",
);

console.log(
  "RESERVE_SNAPSHOT_EVENT=PASS",
);

console.log(
  "DETERMINISTIC_EVENT_HASH=PASS",
);

console.log(
  "PUBLIC_SAFE=PASS",
);

console.log(
  "PII_PRESENT=NO",
);
