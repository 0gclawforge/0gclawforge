export const DEFAULT_AGENT_INFT_ADDRESS = "0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba" as const;

export function getAgentInftAddress(chainId?: number) {
  const galileoAddress = process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS || DEFAULT_AGENT_INFT_ADDRESS;
  const mainnetAddress = process.env.NEXT_PUBLIC_AGENT_INFT_MAINNET_ADDRESS;

  return chainId === 16661 ? mainnetAddress || galileoAddress : galileoAddress;
}
