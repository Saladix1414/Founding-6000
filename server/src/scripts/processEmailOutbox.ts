import {
  dispatchEmailOutbox,
} from "../services/emailDispatcher.js";

console.log("");
console.log(
  "============================================",
);

console.log(
  " DigitalBoost Origin — Email Worker",
);

console.log(
  "============================================",
);

const results =
  await dispatchEmailOutbox({
    limit: 25,
  });

console.log(
  `PROCESSED=${results.length}`,
);

for (
  const result of results
) {
  console.log(
    `${result.publicId} => ${result.status}`,
  );
}

console.log(
  "EMAIL_WORKER_STATUS=PASS",
);

console.log(
  "EMAIL_TRANSPORT=LOG_ONLY",
);
