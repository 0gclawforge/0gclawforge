"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const FORGE_ASCII = `
   ___  ___  _____ _                ______
  / _ \\/ _ \\/  __ \\ |               |  ___|
 | | | / /_\\ \\ /  \\/ | __ ___      _| |_ ___  _ __ __ _  ___
 | | | |  _  | |   | |/ _\` \\ \\ /\\ / /  _/ _ \\| '__/ _\` |/ _ \\
 \\ \\_/ / | | | \\__/\\ | (_| |\\ V  V /| || (_) | | | (_| |  __/
  \\___/\\_| |_/\\____/_|\\__,_| \\_/\\_/ \\_| \\___/|_|  \\__, |\\___|
                                                    __/ |
                                                   |___/
`;

const stats = [
  { label: "Agents Forged", value: "0" },
  { label: "Tasks Completed", value: "0" },
  { label: "GB on 0G Storage", value: "0" },
  { label: "Agents Traded", value: "0" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <motion.pre
        className="text-accent-primary text-xs sm:text-sm font-mono mb-8 animate-pulse-glow text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {FORGE_ASCII}
      </motion.pre>

      <motion.h1
        className="text-3xl sm:text-5xl font-bold text-center mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        The Sovereign Agent OS
      </motion.h1>

      <motion.p
        className="text-text-muted text-lg text-center mb-12 max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Mint, orchestrate, own, and evolve multi-agent swarms as ERC-7857 iNFTs
        on 0G. Your keys, your agent, forever.
      </motion.p>

      {/* Stats Bar */}
      <motion.div
        className="flex flex-wrap justify-center gap-8 mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-2xl font-bold text-accent-secondary">
              {stat.value}
            </div>
            <div className="text-sm text-text-muted">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="flex flex-wrap justify-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Link
          href="/forge"
          className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white transition hover:opacity-90 glow-purple"
        >
          Forge New Agent
        </Link>
        <Link
          href="/swarm"
          className="rounded-lg border border-accent-secondary px-6 py-3 font-semibold text-accent-secondary transition hover:bg-accent-secondary/10"
        >
          View Your Swarm
        </Link>
        <Link
          href="/marketplace"
          className="rounded-lg border border-border px-6 py-3 font-semibold text-text-muted transition hover:border-text-muted hover:text-text-primary"
        >
          Browse Marketplace
        </Link>
      </motion.div>

      {/* Network Status */}
      <motion.div
        className="mt-16 flex items-center gap-2 text-sm text-text-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        0G Network: Storage + Compute + Chain — Galileo Testnet
      </motion.div>
    </div>
  );
}
