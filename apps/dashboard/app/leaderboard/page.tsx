"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Crown, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { useChainId } from "wagmi";
import type { LeaderboardResponse } from "../play/[tokenId]/types";

export default function GeneralLeaderboardPage() {
  const chainId = useChainId();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch(`/api/realm/leaderboard?chainId=${chainId}&mode=general`, { cache: "no-store" });
      const payload = (await response.json()) as LeaderboardResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load the general leaderboard");
      setLeaderboard(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load the general leaderboard");
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const entries = leaderboard?.entries ?? [];

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b border-white/10 bg-gradient-to-br from-ember/[0.09] via-obsidian to-moss/[0.08]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_340px] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs uppercase tracking-[0.24em] text-gold">On-chain Clan Standings</p>
            <h1 className="mt-3 text-4xl font-black text-parchment md:text-5xl">General Leaderboard</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-stone">
              Permanent standings for every minted clan. Lifetime XP, clears, and boss kills are reconstructed from clan evolution records anchored on the active 0G network.
            </p>
          </motion.div>

          <div className="rounded-md border border-gold/30 bg-black/25 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-moss" />
              <p className="text-sm font-semibold text-parchment">Chain-synced scoring</p>
            </div>
            <p className="mt-3 font-mono text-xs leading-5 text-stone">
              Network {chainId}
              <br />
              Source: on-chain clan evolution
            </p>
            <a href="/play#leaderboard" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-parchment">
              View tournament board
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-2xl font-black text-parchment">Lifetime Clan Rankings</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-moss">All minted clans ranked by verified lifetime progress</p>
            </div>
          </div>
          <button
            onClick={() => void loadLeaderboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {leaderboard?.baseline === "rolling-window" && (
          <div className="mb-6 rounded-md border border-ember/40 bg-ember/[0.08] p-4 text-sm leading-6 text-parchment">
            The general baseline has not been pinned yet. Set <span className="font-mono text-gold">OG_GENERAL_LEADERBOARD_FROM_BLOCK_MAINNET</span> so lifetime rankings always scan from the same historical block.
          </div>
        )}

        {leaderboard && (
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-white/10 py-3 font-mono text-xs text-stone">
            <span>Chain {leaderboard.chainId}</span>
            <span>Blocks {leaderboard.scannedFromBlock} - {leaderboard.scannedToBlock}</span>
            <span>{leaderboard.baseline === "configured" ? "Pinned baseline" : "Rolling baseline"}</span>
          </div>
        )}

        {status ? (
          <div className="rounded-md border border-ember/40 bg-ember/[0.08] p-4 text-sm text-parchment">{status}</div>
        ) : loading && !leaderboard ? (
          <div className="py-20 text-center text-sm text-stone">Reconstructing verified clan rankings from 0G...</div>
        ) : entries.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-10 text-center">
            <Crown className="mx-auto h-8 w-8 text-gold" />
            <h3 className="mt-4 text-xl font-black text-parchment">No clans minted yet</h3>
            <p className="mt-2 text-sm text-stone">Mint the first clan on this network to establish the lifetime standings.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {entries.map((entry, index) => (
              <motion.article
                key={entry.tokenId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
                className="grid gap-4 py-5 md:grid-cols-[72px_1fr_auto_auto_auto] md:items-center"
              >
                <p className="font-mono text-2xl font-black text-gold">#{index + 1}</p>
                <div>
                  <h3 className="text-xl font-black text-parchment">{entry.clanTitle || `Clan #${entry.tokenId}`}</h3>
                  <p className="mt-1 font-mono text-xs text-stone">Clan #{entry.tokenId}</p>
                </div>
                <div className="grid grid-cols-3 gap-5 font-mono text-xs text-stone">
                  <Stat label="Lifetime XP" value={entry.totalXpEarned} />
                  <Stat label="Best Run" value={entry.highestRunXp} />
                  <Stat label="Boss Kills" value={entry.bossKills} />
                </div>
                <a href={`/passport/${entry.tokenId}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
                  Passport
                  <ShieldCheck className="h-4 w-4" />
                </a>
                <a href={`/play/${entry.tokenId}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-obsidian">
                  Enter Realm
                  <ArrowRight className="h-4 w-4" />
                </a>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-stone">{label}</p>
      <p className="mt-1 text-sm text-parchment">{value}</p>
    </div>
  );
}
