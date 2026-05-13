"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { useState } from "react";

const ogTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602),
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_OG_RPC_URL || "https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: {
      name: "0G Explorer",
      url: process.env.NEXT_PUBLIC_OG_EXPLORER || "https://chainscan-galileo.0g.ai",
    },
  },
});

const ogMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_OG_MAINNET_RPC_URL || "https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: {
      name: "0G Explorer",
      url: process.env.NEXT_PUBLIC_OG_MAINNET_EXPLORER || "https://chainscan.0g.ai",
    },
  },
});

const config = createConfig({
  chains: [ogTestnet, ogMainnet],
  transports: {
    [ogTestnet.id]: http(),
    [ogMainnet.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
