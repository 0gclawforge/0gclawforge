import { networks, getNetwork } from "@foundryprotocol/0gkit-core";
import type { FoundryEnv, FoundryNetwork } from "./types";

/**
 * Resolve a FoundryEnv from process.env + an optional override. Reads the
 * same variables 0gclawforge already uses (RPC_URL, PRIVATE_KEY,
 * NEXT_PUBLIC_*) and falls back to the 0gkit network preset for endpoints.
 *
 * Why: the bridge has to coexist with the existing .env without forcing
 * 0gclawforge to invent a new variable set.
 */
export function resolveFoundryEnv(overrides: Partial<FoundryEnv> = {}): FoundryEnv {
  const chainId = pickChainId(overrides);
  const network = pickNetwork(chainId, overrides);
  const preset = getNetwork(network);

  const rpcUrl =
    overrides.rpcUrl ??
    process.env.NEXT_PUBLIC_OG_RPC_URL ??
    process.env.OG_RPC_URL ??
    process.env.RPC_URL ??
    preset.rpcUrl ??
    "";

  const indexerUrl =
    overrides.indexerUrl ??
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ??
    process.env.STORAGE_INDEXER ??
    process.env.OG_INDEXER ??
    defaultIndexer(network);

  return {
    network,
    chainId,
    rpcUrl,
    indexerUrl,
    daEncoderUrl: overrides.daEncoderUrl ?? process.env.OG_DA_ENCODER_URL,
    daApiKey: overrides.daApiKey ?? process.env.OG_DA_API_KEY,
    privateKey: overrides.privateKey ?? process.env.PRIVATE_KEY,
    computeProvider: overrides.computeProvider ?? process.env.OG_COMPUTE_PROVIDER_ADDR,
    agentInftAddress:
      overrides.agentInftAddress ?? process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS,
    marketplaceAddress:
      overrides.marketplaceAddress ?? process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS,
  };
}

function pickChainId(overrides: Partial<FoundryEnv>): number {
  if (overrides.chainId) return overrides.chainId;
  const raw =
    process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? process.env.OG_CHAIN_ID ?? "16602";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 16602;
}

function pickNetwork(chainId: number, overrides: Partial<FoundryEnv>): FoundryNetwork {
  if (overrides.network && (overrides.network === "aristotle" || overrides.network === "galileo")) {
    return overrides.network;
  }
  if (chainId === 16661) return "aristotle";
  return "galileo";
}

function defaultIndexer(network: FoundryNetwork): string {
  return network === "aristotle"
    ? "https://indexer-storage-turbo.0g.ai"
    : "https://indexer-storage-testnet-turbo.0g.ai";
}

export { networks as foundryNetworks };
