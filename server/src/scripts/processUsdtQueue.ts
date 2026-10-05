import {
  processPendingUsdtVerifications,
} from "../services/usdtVerificationPipeline.js";

console.log("");
console.log(
  "============================================",
);

console.log(
  " Founding 6000 — USDT Verification Worker",
);

console.log(
  "============================================",
);

try {
  const results =
    await processPendingUsdtVerifications({
      limit: 20,
    });

  console.log(
    `PROCESSED=${results.length}`,
  );

  for (
    const result of results
  ) {
    console.log(
      `${result.publicId} => ${result.outcome}`,
    );
  }

  console.log(
    "WORKER_STATUS=PASS",
  );
} catch (error) {
  console.error(
    "WORKER_STATUS=FAIL",
  );

  if (
    error instanceof Error
  ) {
    console.error(
      error.message,
    );
  } else {
    console.error(error);
  }

  process.exit(1);
}
