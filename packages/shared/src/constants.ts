export const OG_TESTNET = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  faucet: "https://faucet.0g.ai",
  name: "0G Galileo Testnet",
} as const;

export const OG_MAINNET = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  name: "0G Mainnet",
} as const;

export const COMPUTE_PROVIDERS = {
  GEMMA_3_27B: "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08",
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
