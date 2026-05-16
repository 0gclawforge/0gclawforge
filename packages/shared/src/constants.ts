const readEnv = (key: string): string | undefined => {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.process?.env?.[key];
};

export const OG_TESTNET = {
  chainId: Number(readEnv("VITE_CHAIN_ID") ?? readEnv("NEXT_PUBLIC_OG_CHAIN_ID") ?? 16602),
  rpcUrl: readEnv("VITE_RPC_URL") ?? readEnv("NEXT_PUBLIC_OG_RPC_URL") ?? "https://evmrpc-testnet.0g.ai",
  explorer: readEnv("VITE_EXPLORER_URL") ?? readEnv("NEXT_PUBLIC_OG_EXPLORER") ?? "https://chainscan-galileo.0g.ai",
  storageIndexer: readEnv("VITE_STORAGE_INDEXER") ?? readEnv("NEXT_PUBLIC_STORAGE_INDEXER") ?? "https://indexer-storage-testnet-turbo.0g.ai",
  faucet: "https://faucet.0g.ai",
  name: "0G Galileo Testnet",
} as const;

export const OG_MAINNET = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  explorer: "https://chainscan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  name: "0G Mainnet",
} as const;

export const PRODUCT_DESCRIPTION =
  "0GClawForge is the first complete OpenClaw-powered sovereign agent OS — a forge where teams mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent systems that run verifiable TEE inference, store long-term memory forever on 0G, and execute autonomous on-chain actions with zero context loss. Built on top, Eternal Clans is the flagship consumer application: tradable AI civilizations where players co-create UGC Gaming realms + SocialFi DAOs + DePIN coordination into one living, self-evolving digital nation.";

export const COMPUTE_PROVIDERS = {
  "0GM_1_0_35B_A3B": "0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9",
  DEEPSEEK_V3: "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0",
  GLM_5_FP8: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
} as const;

export const AGENT_CAPABILITIES = [
  "research",
  "trading",
  "writing",
  "analysis",
  "coding",
  "scheduling",
  "data",
  "security",
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export const PLATFORM_FEE_BPS = 250; // 2.5%
export const MAX_SWARM_WORKERS = 5;
export const MAX_MEMORY_ENTRIES = 500;
