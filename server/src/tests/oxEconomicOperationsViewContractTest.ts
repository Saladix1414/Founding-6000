import {
  readFileSync,
} from "node:fs";

const service =
  readFileSync(
    "server/src/services/economicOperationsViewService.ts",
    "utf8",
  );

const route =
  readFileSync(
    "server/src/routes/economy.ts",
    "utf8",
  );

const client =
  readFileSync(
    "src/lib/foundingApi.ts",
    "utf8",
  );

const required = [
  "OX-ECONOMIC-OPS-VIEW-1",
  "integrity",
  "incidentTimeline",
  "proofOfReserve",
  "coverageBps",
  "fullyCovered",
];

for (
  const value of
    required
) {
  if (
    !service.includes(
      value,
    ) &&
    !client.includes(
      value,
    )
  ) {
    throw new Error(
      `OPERATIONS_VIEW_REQUIREMENT_MISSING:${value}`,
    );
  }
}

if (
  !route.includes(
    '"/operations"'
  )
) {
  throw new Error(
    "OPERATIONS_ROUTE_MISSING",
  );
}

const forbiddenPublicFields = [
  "evidenceJson",
  "fingerprint:",
  "email:",
  "privateKey",
  "senderAddress",
];

for (
  const value of
    forbiddenPublicFields
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `PUBLIC_OPERATIONS_VIEW_LEAK:${value}`,
    );
  }
}

const forbiddenAuthority = [
  ".run(",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "sendTransaction(",
  "signTransaction(",
];

for (
  const value of
    forbiddenAuthority
) {
  if (
    service.includes(
      value,
    )
  ) {
    throw new Error(
      `OPERATIONS_VIEW_GAINED_MUTATION_AUTHORITY:${value}`,
    );
  }
}

console.log(
  "OX_ECONOMIC_OPERATIONS_VIEW_CONTRACT=PASS",
);

console.log(
  "PUBLIC_SAFE=YES",
);

console.log(
  "PII_EXPOSED=NO",
);

console.log(
  "RAW_INCIDENT_EVIDENCE_EXPOSED=NO",
);

console.log(
  "MUTATION_AUTHORITY=NO",
);
