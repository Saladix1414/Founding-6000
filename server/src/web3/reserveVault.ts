import {
  Contract,
  JsonRpcProvider,
  getAddress,
} from "ethers";

import {
  env,
} from "../config/env.js";

const ERC20_BALANCE_ABI = [
  "function balanceOf(address account) view returns (uint256)",
] as const;

export async function readReserveVaultBalanceMinor() {
  if (
    !env.RESERVE_PROOF_ENABLED
  ) {
    throw new Error(
      "RESERVE_PROOF_DISABLED",
    );
  }

  if (
    !env.ETHEREUM_RPC_URL
  ) {
    throw new Error(
      "ETHEREUM_RPC_URL_REQUIRED",
    );
  }

  if (
    !env.RESERVE_VAULT_ADDRESS
  ) {
    throw new Error(
      "RESERVE_VAULT_ADDRESS_REQUIRED",
    );
  }

  const provider =
    new JsonRpcProvider(
      env.ETHEREUM_RPC_URL,
      env.USDT_CHAIN_ID,
    );

  const token =
    new Contract(
      getAddress(
        env.USDT_TOKEN_CONTRACT,
      ),
      ERC20_BALANCE_ABI,
      provider,
    );

  const balanceOf =
    token.getFunction(
      "balanceOf",
    );

  const balance =
    await balanceOf(
      getAddress(
        env.RESERVE_VAULT_ADDRESS,
      ),
    );

  return {
    network:
      env.USDT_NETWORK,

    chainId:
      env.USDT_CHAIN_ID,

    tokenContract:
      getAddress(
        env.USDT_TOKEN_CONTRACT,
      ),

    vaultAddress:
      getAddress(
        env.RESERVE_VAULT_ADDRESS,
      ),

    balanceMinor:
      BigInt(
        balance.toString(),
      ),
  };
}
