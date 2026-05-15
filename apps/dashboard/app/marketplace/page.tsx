"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseEther, type Address } from "viem";

interface ClanListing {
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

const marketplaceAbi = [
  {
    type: "function",
    name: "tokenToListing",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyAgent",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "newMetadataHash", type: "bytes32" },
      { name: "newStorageURI", type: "string" },
      { name: "sealedKey", type: "bytes" },
      { name: "transferProof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export default function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [listings, setListings] = useState<ClanListing[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const marketplaceAddress = process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS as Address | undefined;

  useEffect(() => {
    fetch("/api/marketplace")
      .then((r) => r.json())
      .then((data) => {
        setListings(data.listings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const buyClan = async (listing: ClanListing) => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!marketplaceAddress) {
      setStatus("Marketplace contract not configured.");
      return;
    }
    if (listing.owner.toLowerCase() === address.toLowerCase()) {
      setStatus("You own this clan.");
      return;
    }

    setBuying(listing.tokenId);
    setStatus(`Purchasing clan #${listing.tokenId}...`);

    try {
      const listingId = await publicClient!.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "tokenToListing",
        args: [BigInt(listing.tokenId)],
      });

      if (!listingId || listingId === BigInt(0)) {
        setStatus("This clan is not listed on the marketplace contract. The seller must list through the marketplace.");
        setBuying(null);
        return;
      }

      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyAgent",
        args: [
          listingId,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "",
          "0x",
          "0x",
        ],
        value: parseEther(listing.price),
      });

      setStatus(`Purchase submitted! Tx: ${hash}`);
      setListings((prev) => prev.filter((l) => l.tokenId !== listing.tokenId));
    } catch (err: any) {
      setStatus(`Purchase failed: ${err.message || "Unknown error"}`);
    } finally {
      setBuying(null);
    }
  };

  const filtered = listings.filter(
    (l) =>
      !filter ||
      l.name.toLowerCase().includes(filter.toLowerCase()) ||
      l.capabilities.some((c) => c.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-black text-parchment">Clan Marketplace</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-md border border-white/10 bg-black/25 px-4 py-2 text-sm text-parchment outline-none focus:border-gold"
          placeholder="Filter by name..."
        />
      </div>

      {status && (
        <div className="mb-6 rounded-md border border-white/10 bg-black/25 p-4 text-sm text-parchment">
          {status}
        </div>
      )}

      {loading ? (
        <div className="text-center text-stone py-20">Loading marketplace...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-obsidian/70 p-12 text-center">
          <h2 className="text-xl font-bold text-parchment mb-2">No clans listed yet</h2>
          <p className="text-stone">
            Mint a clan and list it for sale from the main app to populate the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((clan) => (
            <motion.div
              key={clan.tokenId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-md border border-white/10 bg-obsidian/70"
            >
              <div className="h-32 w-full" style={{ background: generateGradient(clan.tokenId) }} />
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-parchment">{clan.name}</h3>
                  <span className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs text-stone">
                    #{clan.tokenId}
                  </span>
                </div>
                <p className="text-sm text-stone line-clamp-2">{clan.personality}</p>
                <div className="flex justify-between text-xs text-stone">
                  <span>{clan.taskCount} evolutions</span>
                  <span>{clan.modelType}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <div>
                    <span className="text-xs text-stone">Owned by </span>
                    <span className="font-mono text-xs text-gold">
                      {truncateAddress(clan.owner)}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gold">{clan.price} OG</span>
                </div>
                <button
                  onClick={() => buyClan(clan)}
                  disabled={buying === clan.tokenId || !isConnected}
                  className="w-full rounded-md bg-gold py-2.5 font-bold text-obsidian transition hover:opacity-90 disabled:opacity-60"
                >
                  {buying === clan.tokenId ? "Purchasing..." : !isConnected ? "Connect Wallet" : "Buy Clan"}
                </button>
                <a
                  href={`/play/${clan.tokenId}?spectator=1`}
                  className="block w-full rounded-md border border-gold/40 py-2.5 text-center font-bold text-gold transition hover:bg-gold hover:text-obsidian"
                >
                  Preview Realm
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
