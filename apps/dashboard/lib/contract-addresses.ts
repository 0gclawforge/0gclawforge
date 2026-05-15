export const DEFAULT_AGENT_INFT_ADDRESS = "0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba" as const;
export const DEFAULT_AGENT_MARKETPLACE_ADDRESS = "0xF2f6C9AD336efAe3Af7CA54A0a585DBC00Bbfa09" as const;
export const DEFAULT_AGENT_INFT_MAINNET_ADDRESS = "0x6ed8b09371e133dab2AC87Da81615D3152092E3A" as const;
export const DEFAULT_AGENT_MARKETPLACE_MAINNET_ADDRESS = "0xd41C837e0c91024b41A2F456DF4100d0c964bBb1" as const;

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
