"use client";

import { useState } from "react";
import { FoundryPanel } from "../../components/foundry/FoundryPanel";

/**
 * /foundry — embedded UI for the Foundry × 0G DA bridge. Pick a clan
 * tokenId, build a clan event envelope, preview the canonical digest,
 * and publish to 0G Data Availability.
 *
 * This route is additive; it does not replace any existing dashboard flow.
 */
export default function FoundryRoute() {
  const [tokenId, setTokenId] = useState<string>("1");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Foundry × 0G DA</h1>
        <p className="text-sm text-zinc-400">
          Anchor clan events (quests, votes, realm snapshots, evolution records,
          memory deltas) on 0G Data Availability. Each envelope is canonicalized
          + keccak-digested — the digest is exactly what AgentINFT update
          calls accept as a <code className="font-mono">proof</code> blob.
        </p>
      </header>

      <section className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
        <label className="block text-xs uppercase tracking-wide text-zinc-400">
          Clan tokenId
        </label>
        <input
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2"
          placeholder="e.g. 1"
          inputMode="numeric"
        />
      </section>

      <FoundryPanel tokenId={tokenId || "0"} />

      <footer className="space-y-1 text-xs text-zinc-500">
        <div>
          Bridge package: <code className="font-mono">@0gclawforge/foundry</code>{" "}
          (built on{" "}
          <a href="https://github.com/rajkaria/0G-ai-kit" className="underline">
            @foundryprotocol/0gkit-*
          </a>
          ).
        </div>
        <div>
          For agent-side automation, see{" "}
          <code className="font-mono">apps/mcp</code> — the MCP server that
          exposes these same primitives as tools.
        </div>
      </footer>
    </main>
  );
}
