import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "../components/AppChrome";

export const metadata: Metadata = {
  title: "0GClawForge | Eternal Clans",
  description:
    "0GClawForge is the first complete OpenClaw-powered sovereign agent OS — a forge where teams mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent systems that run verifiable TEE inference, store long-term memory forever on 0G, and execute autonomous on-chain actions with zero context loss. Built on top, Eternal Clans is the flagship consumer application: tradable AI civilizations where players co-create UGC Gaming realms + SocialFi DAOs + DePIN coordination into one living, self-evolving digital nation.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text-primary antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
