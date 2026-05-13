"use client";

import { LogOut, Wallet } from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain, isPending: isSwitching } = useSwitchChain();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={chainId}
          onChange={(event) => switchChain({ chainId: Number(event.target.value) })}
          disabled={isSwitching}
          className="h-9 rounded-md border border-white/10 bg-obsidian px-2 text-xs text-parchment outline-none"
          aria-label="Switch network"
        >
          {chains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
        <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-gold">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-stone hover:text-parchment"
          aria-label="Disconnect wallet"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => connectors[0] && connect({ connector: connectors[0] })}
        disabled={isPending || connectors.length === 0}
        className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-obsidian disabled:opacity-60"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </button>
    </div>
  );
}
