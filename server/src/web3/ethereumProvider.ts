import {
  JsonRpcProvider,
} from "ethers";

import { env } from "../config/env.js";

export function getEthereumProvider() {
  if (
    !env.ETHEREUM_RPC_URL
  ) {
    throw new Error(
      "ETHEREUM_RPC_NOT_CONFIGURED",
    );
  }

  return new JsonRpcProvider(
    env.ETHEREUM_RPC_URL,
    1,
    {
      staticNetwork: true,
    },
  );
}
