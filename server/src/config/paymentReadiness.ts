import {
  getAddress,
} from "ethers";

import { env } from "./env.js";

import {
  OFFICIAL_USDT_ETHEREUM,
} from "../web3/usdtConfig.js";

export type PaymentReadinessCheck = {
  key: string;
  pass: boolean;
  detail: string;
};

function isPrivateProductionRpc(
  rpc?: string,
) {
  if (!rpc) {
    return false;
  }

  /*
   * Public shared RPC used during development
   * must never be accepted as our production
   * settlement infrastructure.
   */
  if (
    rpc.includes(
      "eth-mainnet.g.alchemy.com/public",
    )
  ) {
    return false;
  }

  return (
    rpc.startsWith("https://")
  );
}

export function getPaymentReadinessChecks():
  PaymentReadinessCheck[]
{
  let receiverValid =
    false;

  let tokenValid =
    false;

  try {
    receiverValid =
      Boolean(
        getAddress(
          env.USDT_RECEIVER_ADDRESS,
        ),
      );
  } catch {
    receiverValid =
      false;
  }

  try {
    tokenValid =
      getAddress(
        env.USDT_TOKEN_CONTRACT,
      ) ===
      getAddress(
        OFFICIAL_USDT_ETHEREUM,
      );
  } catch {
    tokenValid =
      false;
  }

  return [
    {
      key:
        "network",

      pass:
        env.USDT_NETWORK ===
          "ethereum-mainnet" &&
        env.USDT_CHAIN_ID === 1,

      detail:
        "Ethereum Mainnet / chainId 1",
    },

    {
      key:
        "token",

      pass:
        tokenValid &&
        env.USDT_DECIMALS === 6,

      detail:
        "Official configured USDT / 6 decimals",
    },

    {
      key:
        "receiver",

      pass:
        receiverValid,

      detail:
        "Valid Ethereum receiver address",
    },

    {
      key:
        "confirmations",

      pass:
        env.USDT_CONFIRMATIONS_REQUIRED >=
        1,

      detail:
        `${env.USDT_CONFIRMATIONS_REQUIRED} confirmations`,
    },

    {
      key:
        "productionRpc",

      pass:
        isPrivateProductionRpc(
          env.ETHEREUM_RPC_URL,
        ),

      detail:
        "Dedicated/private HTTPS Ethereum RPC",
    },

    {
      key:
        "seller",

      pass:
        Boolean(
          env.SELLER_DISPLAY_NAME,
        ),

      detail:
        "Seller identity configured",
    },

    {
      key:
        "support",

      pass:
        Boolean(
          env.SUPPORT_EMAIL,
        ),

      detail:
        "Support email configured",
    },

    {
      key:
        "terms",

      pass:
        Boolean(
          env.TERMS_URL,
        ),

      detail:
        "Terms URL configured",
    },

    {
      key:
        "privacy",

      pass:
        Boolean(
          env.PRIVACY_URL,
        ),

      detail:
        "Privacy URL configured",
    },

    {
      key:
        "refunds",

      pass:
        Boolean(
          env.REFUND_POLICY_URL,
        ),

      detail:
        "Refund/cancellation policy configured",
    },
  ];
}

export function assertRealPaymentReadiness() {
  const checks =
    getPaymentReadinessChecks();

  const failed =
    checks.filter(
      (check) =>
        !check.pass,
    );

  if (
    failed.length > 0
  ) {
    throw new Error(
      "PAYMENT_READINESS_FAILED:" +
      failed
        .map(
          (item) =>
            item.key,
        )
        .join(","),
    );
  }

  return checks;
}
