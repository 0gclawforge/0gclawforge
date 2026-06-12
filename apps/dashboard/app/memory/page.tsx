"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useChainId } from "wagmi";

interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  timestamp: number;
  importance: number;
  sessionId: string;
}

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenId, setTokenId] = useState("1");
  const [status, setStatus] = useState("");
  const chainId = useChainId();

  const searchMemories = async () => {
    if (!query) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/memory?tokenId=${tokenId}&chainId=${chainId}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to read clan memory");
      setMemories(data.entries || []);
      setStatus(data.storageRootHash ? `Read ${data.entries?.length || 0} matching memories from ${chainId === 16661 ? "0G Mainnet" : "Galileo"}.` : "This clan has no memory root yet.");
    } catch (error) {
      setMemories([]);
      setStatus(error instanceof Error ? error.message : "Failed to read clan memory");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">Talk to Clan Memory</h1>
      <p className="mb-8 text-sm text-stone">Search the clan&apos;s current on-chain memory root on {chainId === 16661 ? "0G Mainnet" : "Galileo Testnet"}.</p>

      {/* Search Bar */}
      <div className="mb-8 flex gap-4">
        <input
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-24 rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none"
          placeholder="Token ID"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchMemories()}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-accent-primary"
          placeholder="Ask about the clan's memories..."
        />
        <button
          onClick={searchMemories}
          disabled={loading}
          className="rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Listening..." : "Talk to Memory"}
        </button>
      </div>
      {status && <p className="mb-6 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-parchment">{status}</p>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Memory Timeline */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Memory Timeline</h2>
          <div className="space-y-4">
            {memories.length === 0 ? (
              <div className="gradient-border p-6 text-center text-text-muted">
                {query ? "No memories found" : "Search to load memories from 0G Storage"}
              </div>
            ) : (
              memories.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="gradient-border p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-text-muted">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-accent-secondary">
                      importance: {entry.importance.toFixed(2)}
                    </span>
                  </div>
                  <p className="mb-2 text-sm whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex gap-2">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-accent-primary/20 px-2 py-0.5 text-xs text-accent-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Memory Graph Placeholder */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Memory Graph</h2>
          <div className="gradient-border flex h-96 items-center justify-center">
            <div className="text-center text-text-muted">
              <div className="text-4xl mb-2">🧠</div>
              <p className="text-sm">Force-directed memory graph</p>
              <p className="text-xs">Nodes = memories, Edges = semantic similarity</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="gradient-border p-4 text-center">
              <div className="text-2xl font-bold text-accent-secondary">{memories.length}</div>
              <div className="text-xs text-text-muted">Total Memories</div>
            </div>
            <div className="gradient-border p-4 text-center">
              <div className="text-2xl font-bold text-accent-secondary">
                {memories.reduce((sum, m) => sum + m.content.length, 0)}
              </div>
              <div className="text-xs text-text-muted">Bytes Stored</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
