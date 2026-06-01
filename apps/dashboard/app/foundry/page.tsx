"use client";

import { useState } from "react";
import { useChainId } from "wagmi";
import { FoundryPanel } from "../../components/foundry/FoundryPanel";

/**
 * /foundry - embedded UI for the Foundry x 0G DA bridge. Pick a clan
 * tokenId, build a clan event envelope, preview the canonical digest,
 * and publish to 0G Data Availability.
 *
 * This route is additive; it does not replace any existing dashboard flow.
 */
export default function FoundryRoute() {
  const [tokenId, setTokenId] = useState<string>("1");
  const chainId = useChainId();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase text-gold">Clan Event Anchoring</p>
        <h1 className="text-3xl font-semibold text-parchment">Foundry x 0G DA</h1>
        <p className="max-w-2xl text-sm leading-6 text-stone">
          Anchor clan events (quests, votes, realm snapshots, evolution records,
          memory deltas) on 0G Data Availability. Each envelope is canonicalized
          and keccak-digested. The digest is exactly what AgentINFT update
          calls accept as a <code className="font-mono">proof</code> blob.
        </p>
      </header>

      <section className="space-y-2 border-y border-white/10 py-4 text-sm">
        <label className="block font-mono text-xs uppercase text-stone">
          Clan tokenId
        </label>
        <input
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment outline-none transition focus:border-gold"
          placeholder="e.g. 1"
          inputMode="numeric"
        />
      </section>

      <FoundryPanel tokenId={tokenId || "0"} chainId={chainId} />

      <footer className="space-y-1 text-xs text-stone">
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
          <code className="font-mono">apps/mcp</code> - the MCP server that
          exposes these same primitives as tools.
        </div>
      </footer>
    </main>
  );
}
