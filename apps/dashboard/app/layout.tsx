import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "0GClawForge — Sovereign Agent OS",
  description:
    "Mint, orchestrate, own, and evolve multi-agent swarms as ERC-7857 iNFTs on 0G.",
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
          <nav className="fixed top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold text-accent-primary">
                  0G
                </span>
                <span className="text-xl font-bold">ClawForge</span>
              </a>
              <div className="hidden gap-6 md:flex">
                <a href="/forge" className="text-text-muted hover:text-text-primary transition">
                  Forge
                </a>
                <a href="/swarm" className="text-text-muted hover:text-text-primary transition">
                  Swarm
                </a>
                <a href="/memory" className="text-text-muted hover:text-text-primary transition">
                  Memory
                </a>
                <a href="/marketplace" className="text-text-muted hover:text-text-primary transition">
                  Marketplace
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
