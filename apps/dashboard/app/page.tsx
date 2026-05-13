"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, BrainCircuit, Castle, ShieldCheck, Sparkles, Vote } from "lucide-react";

type Tab = "forge-os" | "mint-clan" | "realm-builder" | "dashboard" | "trade";

interface Realm {
  title: string;
  prompt: string;
  root: string;
}

interface Proposal {
  text: string;
  yes: number;
  no: number;
  status: "open" | "executed";
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "forge-os", label: "Forge OS" },
  { id: "mint-clan", label: "Mint Clan" },
  { id: "realm-builder", label: "UGC Realm Builder" },
  { id: "dashboard", label: "Live Clan Dashboard" },
  { id: "trade", label: "Trade Clan" },
];

const pillars = [
  { icon: BrainCircuit, title: "Permanent Memory + TEE", body: "Every clan action becomes a verifiable inference event and a durable 0G memory root." },
  { icon: ShieldCheck, title: "One ERC-7857 Clan iNFT", body: "The buyer owns the full multi-agent civilization, not a fragmented set of bots." },
  { icon: Castle, title: "UGC Realm Co-Creation", body: "Prompt OpenClaw once and get a permanent game realm stored on 0G." },
  { icon: Boxes, title: "Autonomous Evolution + Trade", body: "Votes trigger verified regeneration, memory updates, and tradable history." },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("forge-os");
  const [realmPrompt, setRealmPrompt] = useState("Add a moonlit forest realm with a memory-bound dragon boss");
  const [proposalText, setProposalText] = useState("Add a dragon boss to the forest realm");
  const [realms, setRealms] = useState<Realm[]>([
    {
      title: "Founders Grove",
      prompt: "A living forest hub where clan memory appears as glowing runes.",
      root: "0g://realm-founders-grove",
    },
  ]);
  const [proposals, setProposals] = useState<Proposal[]>([
    { text: "Teach the scout agent to map hidden ruins", yes: 7, no: 1, status: "executed" },
  ]);

  const addRealm = () => {
    const next: Realm = {
      title: `${realmPrompt.split(" ").slice(0, 3).join(" ")} Realm`,
      prompt: realmPrompt,
      root: `0g://realm-${Date.now().toString(36)}`,
    };
    setRealms((current) => [next, ...current]);
    setActiveTab("dashboard");
  };

  const addProposal = () => {
    setProposals((current) => [{ text: proposalText, yes: 1, no: 0, status: "open" }, ...current]);
  };

  const executeProposal = (index: number) => {
    setProposals((current) =>
      current.map((proposal, itemIndex) =>
        itemIndex === index ? { ...proposal, yes: proposal.yes + 4, status: "executed" } : proposal
      )
    );
    setRealms((current) => [
      {
        title: "Voted Evolution Realm",
        prompt: proposals[index]?.text || proposalText,
        root: `0g://vote-evolution-${Date.now().toString(36)}`,
      },
      ...current,
    ]);
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col px-6 py-10">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute left-8 top-16 h-64 w-64 rounded-full border border-gold/30" />
          <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full border border-moss/30" />
        </div>

        <motion.div
          className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="pt-12">
            <p className="mb-5 inline-flex rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm uppercase tracking-[0.3em] text-gold">
              Sovereign Agent OS + Eternal Clans
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-parchment sm:text-7xl">
              Mint a living AI civilization. Evolve it forever.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone">
              0GClawForge turns OpenClaw swarms into owned ERC-7857 clan iNFTs with permanent 0G memory,
              verified TEE inference, instant UGC realms, community evolution, and tradeable history.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab("mint-clan")}
                className="rounded-full bg-ember px-6 py-3 font-bold text-obsidian shadow-[0_0_40px_rgba(216,91,36,0.35)] transition hover:scale-[1.02]"
              >
                Start the demo
              </button>
              <button
                onClick={() => setActiveTab("realm-builder")}
                className="rounded-full border border-parchment/20 px-6 py-3 font-bold text-parchment transition hover:border-gold hover:text-gold"
              >
                Create a realm
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] border border-gold/20 bg-[linear-gradient(150deg,rgba(216,91,36,0.18),rgba(38,122,99,0.16))] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-gold">Clan iNFT #0001</p>
                  <h2 className="mt-2 text-3xl font-black">The Iron Grove</h2>
                </div>
                <Sparkles className="h-9 w-9 text-ember" />
              </div>
              <div className="mt-8 grid gap-3">
                {["TEE verified inference", "0G memory root: 0g://mem-iron-grove", "Realm root: 0g://realm-founders-grove", "Trade bundle: full history intact"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-obsidian/50 px-4 py-3 text-sm text-stone">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="relative mt-10 rounded-[2rem] border border-white/10 bg-obsidian/55 p-4 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                id={tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.id ? "bg-parchment text-obsidian" : "border border-white/10 text-stone hover:text-parchment"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[24rem] rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
            {activeTab === "forge-os" && (
              <div className="grid gap-4 md:grid-cols-4">
                {pillars.map((pillar) => (
                  <div key={pillar.title} className="rounded-3xl border border-white/10 bg-parchment/[0.04] p-5">
                    <pillar.icon className="mb-6 h-8 w-8 text-ember" />
                    <h3 className="text-xl font-black">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-stone">{pillar.body}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "mint-clan" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Mint & Own a Clan as One iNFT">
                  <Field label="Clan name" value="The Iron Grove" />
                  <Field label="Archetype" value="Realm builders with memory-bound guardians" />
                  <Field label="Owner asset" value="ERC-7857 iNFT: full swarm + realms + memory" />
                  <button onClick={() => setActiveTab("realm-builder")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 font-bold text-obsidian">
                    Mint simulated clan <ArrowRight className="h-4 w-4" />
                  </button>
                </Panel>
                <Panel title="What gets sealed">
                  <ul className="space-y-3 text-stone">
                    <li>Encrypted OpenClaw intelligence blob on 0G Storage.</li>
                    <li>Initial permanent clan memory index.</li>
                    <li>TEE-verified model summary for the clan system.</li>
                    <li>Transfer-ready metadata so buyers inherit all context.</li>
                  </ul>
                </Panel>
              </div>
            )}

            {activeTab === "realm-builder" && (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                <Panel title="Prompt -> OpenClaw -> Permanent Realm">
                  <textarea
                    value={realmPrompt}
                    onChange={(event) => setRealmPrompt(event.target.value)}
                    className="min-h-36 w-full rounded-2xl border border-white/10 bg-obsidian/70 p-4 text-parchment outline-none focus:border-ember"
                  />
                  <button onClick={addRealm} className="mt-5 rounded-full bg-ember px-5 py-3 font-bold text-obsidian">
                    Generate and store on 0G
                  </button>
                </Panel>
                <Panel title="Generated assets">
                  <div className="space-y-3 text-sm text-stone">
                    <p>Biome: moonlit permanent forest</p>
                    <p>NPC: Memory Warden</p>
                    <p>Quest: First Echo</p>
                    <p>Artifact: Clan Sigil</p>
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === "dashboard" && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <Panel title="Evolve the Clan">
                  <div className="flex items-center gap-2 text-sm text-gold">
                    <Vote className="h-4 w-4" /> Community Votes for Evolution
                  </div>
                  <input
                    value={proposalText}
                    onChange={(event) => setProposalText(event.target.value)}
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-obsidian/70 p-4 text-parchment outline-none focus:border-gold"
                  />
                  <button onClick={addProposal} className="mt-4 rounded-full bg-gold px-5 py-3 font-bold text-obsidian">
                    Create proposal
                  </button>
                  <div className="mt-5 space-y-3">
                    {proposals.map((proposal, index) => (
                      <div key={`${proposal.text}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="font-bold">{proposal.text}</p>
                        <p className="mt-2 text-sm text-stone">Yes {proposal.yes} / No {proposal.no} / {proposal.status}</p>
                        {proposal.status === "open" && (
                          <button onClick={() => executeProposal(index)} className="mt-3 text-sm font-bold text-ember">
                            Execute winner with TEE OpenClaw
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="History feed">
                  <div className="space-y-3">
                    {realms.map((realm) => (
                      <div key={realm.root} className="rounded-2xl border border-white/10 bg-parchment/[0.04] p-4">
                        <p className="font-black text-parchment">{realm.title}</p>
                        <p className="mt-1 text-sm text-stone">{realm.prompt}</p>
                        <p className="mt-3 font-mono text-xs text-gold">{realm.root}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === "trade" && (
              <div className="grid gap-6 lg:grid-cols-3">
                {["Ownership", "Transfer", "Buyer Inherits"].map((title, index) => (
                  <Panel key={title} title={title}>
                    <p className="text-stone">
                      {index === 0 && "The entire clan swarm is represented by one ERC-7857 iNFT."}
                      {index === 1 && "Secure transfer re-encrypts the intelligence blob and updates metadata roots."}
                      {index === 2 && "Realms, votes, memories, and evolution history move with the token."}
                    </p>
                  </Panel>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-3xl border border-white/10 bg-obsidian/60 p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="mb-3 block">
      <span className="text-sm uppercase tracking-[0.2em] text-stone">{label}</span>
      <span className="mt-2 block rounded-2xl border border-white/10 bg-black/25 p-4 text-parchment">{value}</span>
    </label>
  );
}
