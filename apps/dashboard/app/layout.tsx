import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "0GClawForge | Eternal Clans",
  description:
    "0GClawForge is the first complete OpenClaw-powered sovereign agent OS — a forge where teams mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent systems that run verifiable TEE inference, store long-term memory forever on 0G, and execute autonomous on-chain actions with zero context loss. Built on top, Eternal Clans is the flagship consumer application: tradable AI civilizations where players co-create UGC Gaming realms + SocialFi DAOs + DePIN coordination into one living, self-evolving digital nation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text-primary antialiased">
        <Providers>
          <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-obsidian/75 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl font-black text-ember">
                  0G
                </span>
                <span className="text-xl font-black tracking-tight">ClawForge</span>
              </a>
              <div className="hidden gap-5 md:flex">
                <a href="/#forge-os" className="text-sm text-stone/80 hover:text-parchment transition">
                  Forge OS
                </a>
                <a href="/#mint-clan" className="text-sm text-stone/80 hover:text-parchment transition">
                  Mint Clan
                </a>
                <a href="/#realm-builder" className="text-sm text-stone/80 hover:text-parchment transition">
                  UGC Realm
                </a>
                <a href="/#dashboard" className="text-sm text-stone/80 hover:text-parchment transition">
                  Live Clan
                </a>
                <a href="/#trade" className="text-sm text-stone/80 hover:text-parchment transition">
                  Trade
                </a>
              </div>
              <div id="wallet-connect" />
            </div>
          </nav>
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
