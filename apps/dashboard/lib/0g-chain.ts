import { ethers } from "ethers";

export function getProvider() {
  return new ethers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_OG_MAINNET_RPC_URL || "https://evmrpc.0g.ai"
  );
}

export function getSigner() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
  return new ethers.Wallet(process.env.PRIVATE_KEY, getProvider());
}

export const OG_MAINNET_CHAIN = {
  chainId: 16661,
  name: "0G Mainnet",
  rpcUrl: "https://evmrpc.0g.ai",
  explorer: "https://chainscan.0g.ai",
} as const;

export const OG_TESTNET_CHAIN = {
  chainId: 16602,
  name: "0G Galileo Testnet",
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
} as const;
