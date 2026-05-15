export const DEFAULT_AGENT_INFT_ADDRESS = "0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba" as const;
export const DEFAULT_AGENT_MARKETPLACE_ADDRESS = "0xF2f6C9AD336efAe3Af7CA54A0a585DBC00Bbfa09" as const;
export const DEFAULT_AGENT_INFT_MAINNET_ADDRESS = "0x6ed8b09371e133dab2AC87Da81615D3152092E3A" as const;
export const DEFAULT_AGENT_MARKETPLACE_MAINNET_ADDRESS = "0xd41C837e0c91024b41A2F456DF4100d0c964bBb1" as const;
export const DEFAULT_OG_GALILEO_RPC_URL = "https://evmrpc-testnet.0g.ai" as const;
export const DEFAULT_OG_MAINNET_RPC_URL = "https://evmrpc.0g.ai" as const;

export function getAgentInftAddress(chainId?: number) {
  const galileoAddress = process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS || DEFAULT_AGENT_INFT_ADDRESS;
  const mainnetAddress = process.env.NEXT_PUBLIC_AGENT_INFT_MAINNET_ADDRESS || DEFAULT_AGENT_INFT_MAINNET_ADDRESS;

  return chainId === 16661 ? mainnetAddress : galileoAddress;
}

export function getAgentMarketplaceAddress(chainId?: number) {
  const galileoAddress = process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS || DEFAULT_AGENT_MARKETPLACE_ADDRESS;
  const mainnetAddress =
    process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_MAINNET_ADDRESS || DEFAULT_AGENT_MARKETPLACE_MAINNET_ADDRESS;

  return chainId === 16661 ? mainnetAddress : galileoAddress;
}

export function getOgRpcUrl(chainId?: number) {
  return chainId === 16661
    ? process.env.NEXT_PUBLIC_OG_MAINNET_RPC_URL || DEFAULT_OG_MAINNET_RPC_URL
    : process.env.NEXT_PUBLIC_OG_RPC_URL || DEFAULT_OG_GALILEO_RPC_URL;
}

export const DEFAULT_OG_GALILEO_STORAGE_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai" as const;
export const DEFAULT_OG_MAINNET_STORAGE_INDEXER = "https://indexer-storage-turbo.0g.ai" as const;

export function getOgStorageIndexer(chainId?: number) {
  if (chainId === 16661) {
    return process.env.OG_MAINNET_STORAGE_INDEXER || DEFAULT_OG_MAINNET_STORAGE_INDEXER;
  }
  return (
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO ||
    DEFAULT_OG_GALILEO_STORAGE_INDEXER
  );
}
