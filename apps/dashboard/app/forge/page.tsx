"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChainId } from "wagmi";

const CAPABILITIES = [
  "Research", "Trading", "Writing", "Analysis", "Coding", "Scheduling", "Data", "Security",
];
const MODELS = ["claude-sonnet-4", "gemma-3-27b", "llama-3-70b", "custom"];
const STEPS = ["Identity", "Intelligence", "Mint", "Success"] as const;

export default function ForgePage() {
  const chainId = useChainId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    personality: "",
    model: MODELS[0],
    capabilities: [] as string[],
    skills: "{}",
    memorySeed: "",
  });
  const [mintState, setMintState] = useState<
    "idle" | "encrypting" | "uploading" | "hashing" | "minting" | "done"
  >("idle");
  const [result, setResult] = useState<{ tokenId?: number; txHash?: string; storageURI?: string }>({});

  const toggleCap = (cap: string) =>
    setForm((f) => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter((c) => c !== cap)
        : [...f.capabilities, cap],
    }));

  const handleMint = async () => {
    setMintState("encrypting");
    await new Promise((r) => setTimeout(r, 1200));
    setMintState("uploading");

    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, chainId }),
      });
      const data = await res.json();
      setMintState("hashing");
      await new Promise((r) => setTimeout(r, 800));
      setMintState("minting");
      await new Promise((r) => setTimeout(r, 1000));
      setResult(data);
      setMintState("done");
      setStep(3);
    } catch {
      setMintState("idle");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">Agent Forge</h1>

      {/* Progress */}
      <div className="mb-12 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i <= step
                  ? "bg-accent-primary text-white"
                  : "bg-card text-text-muted"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i <= step ? "text-text-primary" : "text-text-muted"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 ${i < step ? "bg-accent-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Identity */}
        {step === 0 && (
          <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm text-text-muted">Agent Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-accent-primary"
                placeholder="e.g. AlphaTrader"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-text-muted">Personality</label>
              <textarea
                value={form.personality}
                onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-accent-primary"
                rows={3}
                placeholder="e.g. Aggressive crypto trader who never sleeps"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-text-muted">Model</label>
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-text-muted">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap}
                    onClick={() => toggleCap(cap)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      form.capabilities.includes(cap)
                        ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                        : "border-border text-text-muted hover:border-text-muted"
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={!form.name}
              className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              Next: Intelligence
            </button>
          </motion.div>
        )}

        {/* Step 2: Intelligence */}
        {step === 1 && (
          <motion.div key="intelligence" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm text-text-muted">Skills Manifest (JSON)</label>
              <textarea
                value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 font-mono text-sm text-text-primary outline-none focus:border-accent-primary"
                rows={8}
                placeholder='{"research": true, "trading": {"pairs": ["ETH/USDC"]}}'
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-text-muted">Memory Seed</label>
              <textarea
                value={form.memorySeed}
                onChange={(e) => setForm((f) => ({ ...f, memorySeed: e.target.value }))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-accent-primary"
                rows={4}
                placeholder="Initial context and knowledge for the agent..."
              />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(0)} className="rounded-lg border border-border px-6 py-3 text-text-muted">
                Back
              </button>
              <button onClick={() => setStep(2)} className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white">
                Next: Mint
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Mint */}
        {step === 2 && (
          <motion.div key="mint" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="gradient-border p-6">
              <h3 className="mb-4 text-lg font-semibold">Agent Summary</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-text-muted">Name:</span> {form.name}</p>
                <p><span className="text-text-muted">Model:</span> {form.model}</p>
                <p><span className="text-text-muted">Capabilities:</span> {form.capabilities.join(", ") || "None"}</p>
                <p><span className="text-text-muted">Personality:</span> {form.personality || "Default"}</p>
              </div>
            </div>

            {/* Mint Progress */}
            {mintState !== "idle" && (
              <div className="space-y-3">
                {[
                  { key: "encrypting", label: "Encrypting intelligence blob" },
                  { key: "uploading", label: "Uploading to 0G Storage" },
                  { key: "hashing", label: "Computing metadata hash" },
                  { key: "minting", label: "Minting iNFT on 0G Chain" },
                ].map(({ key, label }) => {
                  const states = ["encrypting", "uploading", "hashing", "minting", "done"];
                  const idx = states.indexOf(key);
                  const currentIdx = states.indexOf(mintState);
                  const done = currentIdx > idx;
                  const active = currentIdx === idx;
                  return (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span>{done ? "\u2705" : active ? "\u23f3" : "\u2B1C"}</span>
                      <span className={done ? "text-success" : active ? "text-accent-secondary" : "text-text-muted"}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="rounded-lg border border-border px-6 py-3 text-text-muted" disabled={mintState !== "idle"}>
                Back
              </button>
              <button
                onClick={handleMint}
                disabled={mintState !== "idle"}
                className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white disabled:opacity-50 glow-purple"
              >
                {mintState === "idle" ? "Upload & Mint iNFT" : "Processing..."}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 3 && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold">Agent Forged!</h2>
            <div className="gradient-border p-6 text-left">
              <p className="text-sm"><span className="text-text-muted">Token ID:</span> <span className="font-mono">{result.tokenId}</span></p>
              {result.txHash && (
                <p className="text-sm mt-2">
                  <span className="text-text-muted">TX:</span>{" "}
                  <a href={`https://chainscan-galileo.0g.ai/tx/${result.txHash}`} target="_blank" rel="noopener" className="text-accent-secondary font-mono text-xs hover:underline">
                    {result.txHash}
                  </a>
                </p>
              )}
              {result.storageURI && (
                <p className="text-sm mt-2"><span className="text-text-muted">Storage URI:</span> <span className="font-mono text-xs">{result.storageURI}</span></p>
              )}
            </div>
            <div className="flex justify-center gap-4">
              <a href="/marketplace" className="rounded-lg border border-border px-6 py-3 text-text-muted hover:text-text-primary transition">
                View in Marketplace
              </a>
              <a href="/swarm" className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white">
                Start Swarm Task
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
