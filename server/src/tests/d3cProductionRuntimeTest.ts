import {
  getProductionRuntimeProblems,
} from "../config/productionRuntime.js";

type Config =
  Parameters<
    typeof getProductionRuntimeProblems
  >[0];

function base():
  Config {
  return {
    NODE_ENV:
      "production",

    API_HOST:
      "0.0.0.0",

    API_PORT:
      8787,

    DATABASE_PATH:
      "/var/lib/founding-6000/founding-6000.sqlite",

    DATABASE_BACKUP_DIR:
      "/var/lib/founding-6000/backups",

    DATABASE_BACKUP_RETENTION:
      14,

    FRONTEND_ORIGIN:
      "https://founding.example.com",

    ADMIN_API_TOKEN:
      "a".repeat(
        64,
      ),

    PUBLIC_CHECKOUT_ENABLED:
      false,

    PAYMENT_READINESS:
      false,

    REAL_PAYMENTS_ENABLED:
      false,
  };
}

function expectProblem(
  config:
    Config,

  expected:
    string,
) {
  const problems =
    getProductionRuntimeProblems(
      config,
    );

  if (
    !problems.includes(
      expected,
    )
  ) {
    throw new Error(
      `EXPECTED_${expected}_GOT_${problems.join(",")}`,
    );
  }
}

const safe =
  getProductionRuntimeProblems(
    base(),
  );

if (
  safe.length !==
    0
) {
  throw new Error(
    `SAFE_PRELAUNCH_REJECTED_${safe.join(",")}`,
  );
}

console.log(
  "[PASS] Safe production prelaunch accepted",
);

expectProblem(
  {
    ...base(),

    DATABASE_PATH:
      "./server/data/founding.sqlite",
  },
  "DATABASE_PATH_MUST_BE_ABSOLUTE",
);

console.log(
  "[PASS] Relative production DB rejected",
);

expectProblem(
  {
    ...base(),

    FRONTEND_ORIGIN:
      "http://localhost:5173",
  },
  "FRONTEND_ORIGIN_MUST_BE_PUBLIC_HTTPS_ORIGIN",
);

console.log(
  "[PASS] Local/insecure production origin rejected",
);

expectProblem(
  {
    ...base(),

    ADMIN_API_TOKEN:
      undefined,
  },
  "ADMIN_API_TOKEN_REQUIRED",
);

console.log(
  "[PASS] Missing admin secret rejected",
);

expectProblem(
  {
    ...base(),

    PUBLIC_CHECKOUT_ENABLED:
      true,
  },
  "PUBLIC_CHECKOUT_REQUIRES_PAYMENT_READINESS",
);

expectProblem(
  {
    ...base(),

    PUBLIC_CHECKOUT_ENABLED:
      true,
  },
  "PUBLIC_CHECKOUT_REQUIRES_REAL_PAYMENTS",
);

console.log(
  "[PASS] Checkout cannot open alone",
);

expectProblem(
  {
    ...base(),

    REAL_PAYMENTS_ENABLED:
      true,
  },
  "REAL_PAYMENTS_REQUIRE_PAYMENT_READINESS",
);

console.log(
  "[PASS] Real payments cannot activate alone",
);

expectProblem(
  {
    ...base(),

    PUBLIC_CHECKOUT_ENABLED:
      true,

    PAYMENT_READINESS:
      true,

    REAL_PAYMENTS_ENABLED:
      true,
  },
  "PAYMENT_READINESS_REQUIRES_HTTPS_RPC",
);

console.log(
  "[PASS] Payment readiness requires RPC",
);

const fullyReady =
  getProductionRuntimeProblems({
    ...base(),

    PUBLIC_CHECKOUT_ENABLED:
      true,

    PAYMENT_READINESS:
      true,

    REAL_PAYMENTS_ENABLED:
      true,

    ETHEREUM_RPC_URL:
      "https://ethereum.example-rpc.com",

    SELLER_DISPLAY_NAME:
      "German Luna",

    SUPPORT_EMAIL:
      "digitalboostorigin@gmail.com",

    TERMS_URL:
      "https://founding.example.com/legal/terms.html",

    PRIVACY_URL:
      "https://founding.example.com/legal/privacy.html",

    REFUND_POLICY_URL:
      "https://founding.example.com/legal/refunds.html",
  });

if (
  fullyReady.length !==
    0
) {
  throw new Error(
    `VALID_PAYMENT_CONFIGURATION_REJECTED_${fullyReady.join(",")}`,
  );
}

console.log(
  "[PASS] Explicit complete payment configuration accepted",
);

console.log("");
console.log(
  "============================================",
);

console.log(
  " D3-C PRODUCTION RUNTIME TEST PASS",
);

console.log(
  "============================================",
);

console.log(
  "SAFE_PRELAUNCH=PASS",
);

console.log(
  "ABSOLUTE_DATABASE_PATH=ENFORCED",
);

console.log(
  "PUBLIC_HTTPS_ORIGIN=ENFORCED",
);

console.log(
  "ADMIN_SECRET=ENFORCED",
);

console.log(
  "PAYMENT_FLAGS=FAIL_CLOSED",
);
