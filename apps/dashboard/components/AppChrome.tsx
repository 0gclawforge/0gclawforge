"use client";

import { Providers } from "../app/providers";
import { WalletConnect } from "./WalletConnect";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-obsidian/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-black text-ember">0G</span>
            <span className="text-xl font-black">ClawForge</span>
          </a>
          <div className="hidden gap-5 md:flex">
            <a href="/app" className="text-sm text-stone/80 transition hover:text-parchment">
              App
            </a>
            <a href="/play" className="text-sm text-stone/80 transition hover:text-parchment">
              Play
            </a>
            <a href="/marketplace" className="text-sm text-stone/80 transition hover:text-parchment">
              Marketplace
            </a>
            <a href="/docs" className="text-sm text-stone/80 transition hover:text-parchment">
              Docs
            </a>
          </div>
          <WalletConnect />
        </div>
      </nav>
      <main className="pt-16">{children}</main>
    </Providers>
  );
}
