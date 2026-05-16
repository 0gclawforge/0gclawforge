"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Crown,
  Database,
  ExternalLink,
  Gamepad2,
  Globe2,
  MessageCircle,
  Network,
  ShieldCheck,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon,
} from "lucide-react";

const officialLinks = [
  { label: "X", href: "https://x.com/0gclawforge", icon: ExternalLink },
  { label: "Discord", href: "https://discord.gg/FfjHj7Y4U8", icon: MessageCircle },
  { label: "Docs", href: "https://www.0gclawforge.xyz/docs", icon: BookOpen },
];

const pillars: Array<{ title: string; body: string; icon: LucideIcon; accent: string }> = [
  {
    title: "Sovereign Clan iNFTs",
    body: "Mint ERC-7857 clans that carry identity, memory roots, realm roots, and evolution history as durable on-chain state.",
    icon: Crown,
    accent: "text-gold",
  },
  {
    title: "Permanent UGC Realms",
    body: "Turn prompts into playable fantasy worlds, then anchor lore, maps, quests, NPCs, and artifacts on 0G Storage.",
    icon: Gamepad2,
    accent: "text-moss",
  },
  {
    title: "Autonomous World Loops",
    body: "Let clans move, talk, run micro-quests, and reshape the map while 0G Compute provides agent direction.",
    icon: Bot,
    accent: "text-accent-secondary",
  },
  {
    title: "Mainnet Ready Flow",
    body: "Switch between Galileo and mainnet from the wallet, with contract addresses and storage endpoints resolved per chain.",
    icon: Network,
    accent: "text-accent-primary",
  },
];

const flow = [
  { label: "Mint", text: "Create a clan iNFT with mission memory and owner control.", icon: Sparkles },
  { label: "Generate", text: "Forge a UGC realm from lore, assets, and chain state.", icon: Database },
  { label: "Play", text: "Explore the tile world, fight bosses, collect artifacts, and complete quests.", icon: Swords },
  { label: "Evolve", text: "Persist progress to 0G Storage and record clan evolution on-chain.", icon: ShieldCheck },
];

function tileTone(index: number) {
  if (index === 8 || index === 41) return "border-ember/50 bg-ember/20 shadow-[0_0_26px_rgba(216,91,36,0.24)]";
  if ([14, 25, 57].includes(index)) return "border-gold/60 bg-gold/20 shadow-[0_0_24px_rgba(215,168,74,0.26)]";
  if ([5, 33, 68].includes(index)) return "border-accent-secondary/50 bg-accent-secondary/15 shadow-[0_0_22px_rgba(0,229,255,0.22)]";
  if ([19, 44, 73].includes(index)) return "border-accent-primary/50 bg-accent-primary/15 shadow-[0_0_22px_rgba(110,84,255,0.2)]";
  if (index % 9 === 0 || index % 13 === 0) return "border-moss/40 bg-moss/15";
  return "border-white/10 bg-white/[0.035]";
}

function tileGlyph(index: number) {
  if (index === 8 || index === 41) return <Swords className="h-4 w-4" />;
  if ([14, 25, 57].includes(index)) return <Sparkles className="h-4 w-4" />;
  if ([5, 33, 68].includes(index)) return <Database className="h-4 w-4" />;
  if ([19, 44, 73].includes(index)) return <Bot className="h-4 w-4" />;
  if (index % 9 === 0 || index % 13 === 0) return <Globe2 className="h-3.5 w-3.5" />;
  return null;
}

export default function LandingPage() {
  return (
    <main className="overflow-hidden bg-obsidian text-parchment">
      <section className="relative min-h-[calc(100vh-8rem)] border-b border-white/10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(216,91,36,0.24),transparent_28rem),radial-gradient(circle_at_80%_20%,rgba(0,229,255,0.14),transparent_30rem),linear-gradient(135deg,#0d0b08_0%,#17100b_42%,#07120e_100%)]" />
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-16 grid w-[min(760px,88vw)] -translate-x-1/2 rotate-[-7deg] grid-cols-10 gap-2 opacity-80"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 0.8 }}
            transition={{ duration: 0.9 }}
          >
            {Array.from({ length: 80 }).map((_, index) => (
              <motion.div
                key={index}
                className={`flex aspect-square items-center justify-center rounded-md border text-gold backdrop-blur-sm ${tileTone(index)}`}
                animate={{ y: index % 7 === 0 ? [0, -4, 0] : 0, opacity: [0.72, 1, 0.72] }}
                transition={{ duration: 3 + (index % 5), repeat: Infinity, delay: index * 0.025 }}
              >
                {tileGlyph(index)}
              </motion.div>
            ))}
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-obsidian/10 via-obsidian/66 to-obsidian" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-16 lg:grid-cols-[1fr_430px] lg:items-end lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              <Zap className="h-3.5 w-3.5" />
              Sovereign agent OS on 0G
            </div>
            <h1 className="text-5xl font-black leading-[1.02] text-parchment md:text-7xl">0G ClawForge</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone md:text-xl">
              Mint autonomous clans, generate permanent UGC realms, play them as tile-map worlds, and record every evolution through 0G Storage, 0G Compute, and on-chain state.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/app"
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-obsidian shadow-glow transition hover:translate-y-[-1px]"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/play"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-parchment transition hover:border-gold/50 hover:text-gold"
              >
                Enter Realms
                <Gamepad2 className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {officialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-stone transition hover:border-gold/40 hover:text-parchment"
                  >
                    <Icon className="h-4 w-4 text-gold" />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-md border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone">Live Realm Loop</p>
                <h2 className="mt-1 text-2xl font-black text-parchment">Autonomous Clan</h2>
              </div>
              <Bot className="h-7 w-7 text-gold" />
            </div>
            <div className="mt-5 space-y-4 font-mono text-xs">
              {[
                ["Compute", "0GM-1.0-35B-A3B directive queued"],
                ["Storage", "realm-root + memory-root anchored"],
                ["World", "NPC patrol, artifact recovered, boss scouted"],
                ["Chain", "evolution ready after completion"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-stone">{label}</span>
                  <span className="max-w-[240px] text-right text-parchment">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-14 md:grid-cols-2 xl:grid-cols-4">
        {pillars.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <motion.article
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.06 }}
              className="rounded-md border border-white/10 bg-white/[0.035] p-5"
            >
              <Icon className={`h-6 w-6 ${pillar.accent}`} />
              <h2 className="mt-5 text-xl font-black text-parchment">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone">{pillar.body}</p>
            </motion.article>
          );
        })}
      </section>

      <section className="border-y border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[360px_1fr] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Forge to living world</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-parchment md:text-4xl">One loop for ownership, memory, play, and evolution.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {flow.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-md border border-white/10 bg-obsidian/70 p-5">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gold" />
                    <h3 className="text-lg font-black text-parchment">{item.label}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Eternal Clans</p>
          <h2 className="mt-2 text-3xl font-black text-parchment">Build a realm that keeps becoming itself.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/app" className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-obsidian">
            Start Forging
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="https://www.0gclawforge.xyz/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-parchment hover:border-gold/50"
          >
            Read Docs
            <BookOpen className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
