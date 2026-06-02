"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Crown,
  ExternalLink,
  Fingerprint,
  Gamepad2,
  Network,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { useChainId } from "wagmi";
import type { AgentPassport } from "@0gclawforge/sdk";

function compact(value: string) {
  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value || "Not recorded";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-white/10 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone">{label}</p>
      <p className="mt-1 font-mono text-sm text-parchment">{value}</p>
    </div>
  );
}

export default function AgentPassportPage({ params }: { params: { tokenId: string } }) {
  const chainId = useChainId();
  const [passport, setPassport] = useState<AgentPassport | null>(null);
  const [status, setStatus] = useState("");

  const loadPassport = useCallback(async () => {
    setStatus("");
    try {
      const response = await fetch(`/api/passport/${params.tokenId}?chainId=${chainId}`, { cache: "no-store" });
      const payload = (await response.json()) as AgentPassport & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load clan passport");
      setPassport(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load clan passport");
    }
  }, [chainId, params.tokenId]);

  useEffect(() => {
    void loadPassport();
  }, [loadPassport]);

  if (status) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-md border border-ember/40 bg-ember/[0.08] p-5 text-sm text-parchment">{status}</div>
      </main>
    );
  }

  if (!passport) {
    return <main className="px-6 py-20 text-center text-sm text-stone">Reading clan identity from 0G...</main>;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b border-white/10 bg-gradient-to-br from-ember/[0.12] via-obsidian to-moss/[0.1]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_320px] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded bg-gold/10 px-2 py-1 font-mono text-xs text-gold">Agent Passport v{passport.version}</span>
              <span className="inline-flex items-center gap-1 text-xs text-moss">
                <ShieldCheck className="h-4 w-4" />
                Chain-synced identity
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black text-parchment md:text-6xl">{passport.name}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone">{passport.archetype || "A sovereign clan intelligence forged on 0G."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`/play/${passport.tokenId}?spectator=1`} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian">
                <Gamepad2 className="h-4 w-4" />
                Enter Realm
              </a>
              <a href={passport.links.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10">
                Verify On-chain
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

          <div className="rounded-md border border-gold/30 bg-black/25 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-stone">Reputation</p>
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <p className="mt-2 font-mono text-5xl font-black text-gold">{passport.reputation}</p>
            <p className="mt-3 text-xs leading-5 text-stone">Derived from verified lifetime XP, clears, boss kills, realms, and on-chain evolution.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-black text-parchment">Verified Standing</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Lifetime Rank" value={passport.standing.rank ? `#${passport.standing.rank}` : "Unranked"} />
              <Stat label="Lifetime XP" value={passport.standing.lifetimeXp} />
              <Stat label="Verified Clears" value={passport.standing.verifiedClears} />
              <Stat label="Boss Kills" value={passport.standing.bossKills} />
            </div>
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-black text-parchment">Portable Identity</h2>
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Stat label="Clan Token" value={`#${passport.tokenId}`} />
              <Stat label="Network" value={passport.network} />
              <Stat label="Owner" value={compact(passport.owner)} />
              <Stat label="Model" value={passport.modelType || "Not recorded"} />
              <Stat label="Skill Count" value={passport.skillCount} />
              <Stat label="Task Count" value={passport.taskCount} />
              <Stat label="Realm Versions" value={passport.realmCount} />
              <Stat label="Evolutions" value={passport.evolutionCount} />
            </div>
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-moss" />
              <h2 className="text-2xl font-black text-parchment">Proof Registry</h2>
            </div>
            <div className="space-y-2">
              {passport.proofs.map((proof) => (
                <div key={proof.type} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-parchment">{proof.type.replace("-", " ")}</p>
                    <p className="mt-1 font-mono text-xs text-stone">{compact(proof.value)}</p>
                  </div>
                  <span className="rounded bg-moss/15 px-2 py-1 font-mono text-[10px] uppercase text-moss">{proof.source}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Brain className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-black text-parchment">0G Memory State</h2>
            </div>
            <Stat label="Memory Root" value={compact(passport.memoryRoot)} />
            <Stat label="Realm Root" value={compact(passport.realmRoot)} />
            <Stat label="Vote Root" value={compact(passport.voteRoot)} />
            <Stat label="Memory Size" value={passport.memorySize} />
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Bot className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-black text-parchment">Builder Access</h2>
            </div>
            <p className="text-sm leading-6 text-stone">Read this portable identity through the public API or the typed SDK.</p>
            <pre className="mt-4 overflow-x-auto rounded-md border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-moss">{`GET /api/passport/${passport.tokenId}\n\ngetAgentPassport("${passport.tokenId}", {\n  chainId: ${passport.chainId}\n})`}</pre>
            <a href="/docs#sdk" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-parchment">
              Read SDK docs
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>

          <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-gold" />
              <p className="text-sm font-semibold text-parchment">Sovereign agent identity</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone">Ownership lives on 0G Chain. Memory, realms, and governance roots resolve through 0G Storage. Verified play history becomes portable reputation.</p>
            <div className="mt-4 flex gap-4 text-stone">
              <ScrollText className="h-4 w-4" />
              <Sparkles className="h-4 w-4" />
              <Swords className="h-4 w-4" />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
