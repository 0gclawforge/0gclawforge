"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface AgentListing {
  tokenId: number;
  name: string;
  personality: string;
  modelType: string;
  taskCount: number;
  memorySize: number;
  owner: string;
  price: string;
  capabilities: string[];
}

function generateGradient(id: number): string {
  const hue1 = (id * 137) % 360;
  const hue2 = (hue1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace")
      .then((r) => r.json())
      .then((data) => {
        setListings(data.listings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = listings.filter(
    (l) =>
      !filter ||
      l.name.toLowerCase().includes(filter.toLowerCase()) ||
      l.capabilities.some((c) => c.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agent Marketplace</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-primary"
          placeholder="Filter by name or capability..."
        />
      </div>

      {loading ? (
        <div className="text-center text-text-muted py-20">Loading marketplace...</div>
      ) : filtered.length === 0 ? (
        <div className="gradient-border p-12 text-center">
          <div className="text-4xl mb-4">🏪</div>
          <h2 className="text-xl font-semibold mb-2">No agents listed yet</h2>
          <p className="text-text-muted">
            Forge an agent and list it for sale to populate the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <motion.div
              key={agent.tokenId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="gradient-border overflow-hidden"
            >
              {/* Avatar */}
              <div className="h-32 w-full" style={{ background: generateGradient(agent.tokenId) }} />

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{agent.name}</h3>
                  <span className="rounded bg-card px-2 py-0.5 font-mono text-xs text-text-muted">
                    #{agent.tokenId}
                  </span>
                </div>

                <p className="text-sm text-text-muted line-clamp-2">{agent.personality}</p>

                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="rounded-full bg-accent-primary/20 px-2 py-0.5 text-xs text-accent-primary">
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between text-xs text-text-muted">
                  <span>{agent.taskCount} tasks</span>
                  <span>{agent.modelType}</span>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <span className="text-xs text-text-muted">Owned by </span>
                    <span className="font-mono text-xs text-accent-secondary">
                      {truncateAddress(agent.owner)}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-accent-secondary">{agent.price} OG</span>
                </div>

                <button className="w-full rounded-lg bg-accent-primary py-2.5 font-semibold text-white transition hover:opacity-90 glow-purple">
                  Buy Agent
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
