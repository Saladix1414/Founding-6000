import {
  readFileSync,
} from "node:fs";

const route =
  readFileSync(
    "server/src/routes/economy.ts",
    "utf8",
  );

const service =
  readFileSync(
    "server/src/services/economyService.ts",
    "utf8",
  );

const combined =
  `${route}\n${service}`;

const forbiddenPublicFields = [
  "email:",
  "senderAddress:",
  "privateKey:",
  "password:",
  "authToken:",
  "paymentAttemptId:",
  "normalizedEmail:",
];

for (
  const forbidden of
    forbiddenPublicFields
) {
  if (
    combined.includes(
      forbidden,
    )
  ) {
    throw new Error(
      `FORBIDDEN_PUBLIC_FIELD:${forbidden}`,
    );
  }
}

const requiredPublicFields = [
  "collectionTier:",
  "acquisition:",
  "reserveContribution:",
  "tierBaseAllocation:",
  "current:",
  "proofOfReserve:",
  "snapshotHash:",
  "coverageBps:",
];

for (
  const required of
    requiredPublicFields
) {
  if (
    !combined.includes(
      required,
    )
  ) {
    throw new Error(
      `REQUIRED_PUBLIC_FIELD_MISSING:${required}`,
    );
  }
}

console.log(
  "OX_ECONOMY_API_PRIVACY=PASS",
);

console.log(
  "EMAIL_EXPOSED=NO",
);

console.log(
  "PAYMENT_SENDER_EXPOSED=NO",
);

console.log(
  "PRIVATE_KEY_EXPOSED=NO",
);

console.log(
  "AUTH_SECRET_EXPOSED=NO",
);

console.log(
  "PROOF_OF_RESERVE_FIELDS=PASS",
);
