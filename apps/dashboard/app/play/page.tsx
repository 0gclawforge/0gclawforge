"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Crown, Loader2, Search, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Address } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { agentInftAbi } from "@0gclawforge/sdk/inft";
import { getAgentInftAddress } from "../../lib/contract-addresses";
import type { ClanState, RealmApiResponse, RealmRecord } from "./[tokenId]/types";

interface PlayableRealm {
  tokenId: string;
  realm: RealmRecord;
  clanState: ClanState;
}

function unwrapRealm(record: RealmRecord | { payload?: RealmRecord["payload"]; createdAt?: number }): RealmRecord {
  if (record.payload?.title && Array.isArray(record.payload.assets)) {
    return {
      kind: "ugc-realm",
      payload: record.payload,
      createdAt: record.createdAt ?? Date.now(),
    };
  }

  throw new Error("Storage record is not a valid ugc-realm payload");
}

function normalizeClanState(raw: unknown): ClanState {
  const state = raw as {
    memoryRootURI?: string;
    realmRootURI?: string;
    voteRootURI?: string;
    realmCount?: bigint;
    proposalCount?: bigint;
    evolutionCount?: bigint;
    [index: number]: unknown;
  };

  return {
    memoryRootURI: state.memoryRootURI ?? String(state[0] ?? ""),
    realmRootURI: state.realmRootURI ?? String(state[1] ?? ""),
    voteRootURI: state.voteRootURI ?? String(state[2] ?? ""),
    realmCount: Number(state.realmCount ?? state[3] ?? 0),
    proposalCount: Number(state.proposalCount ?? state[4] ?? 0),
    evolutionCount: Number(state.evolutionCount ?? state[5] ?? 0),
  };
}

export default function PlayDiscoveryPage() {
  const router = useRouter();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const [tokenSearch, setTokenSearch] = useState("");
  const [realms, setRealms] = useState<PlayableRealm[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const contractAddress = useMemo(() => {
    return getAgentInftAddress(chainId) as Address;
  }, [chainId]);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnedRealms() {
      if (!address || !publicClient || !contractAddress) {
        setRealms([]);
        return;
      }

      setLoading(true);
      setStatus("");

      try {
        const balance = await publicClient.readContract({
          address: contractAddress,
          abi: agentInftAbi,
          functionName: "balanceOf",
          args: [address],
        });
        const discovered: PlayableRealm[] = [];

        for (let index = 0; index < Number(balance); index++) {
          const ownedTokenId = await publicClient.readContract({
            address: contractAddress,
            abi: agentInftAbi,
            functionName: "tokenOfOwnerByIndex",
            args: [address, BigInt(index)],
          });
          const clanState = normalizeClanState(
            await publicClient.readContract({
              address: contractAddress,
              abi: agentInftAbi,
              functionName: "getClanState",
              args: [ownedTokenId],
            })
          );

          if (!clanState.realmRootURI) continue;

          const response = await fetch(`/api/realm/${ownedTokenId.toString()}?chainId=${chainId}`, { cache: "no-store" });
          if (!response.ok) continue;
          const payload = (await response.json()) as RealmApiResponse;

          try {
            discovered.push({
              tokenId: ownedTokenId.toString(),
              realm: unwrapRealm(payload.realm),
              clanState: payload.clanState,
            });
          } catch {
            continue;
          }
        }

        if (!cancelled) {
          setRealms(discovered);
          if (discovered.length < Number(balance)) {
            setStatus("Some owned realms were skipped because their stored payloads are invalid or not yet playable.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Failed to discover playable realms");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOwnedRealms();
    return () => {
      cancelled = true;
    };
  }, [address, chainId, contractAddress, publicClient]);

  const enterToken = () => {
    const trimmed = tokenSearch.trim();
    if (!/^\d+$/.test(trimmed)) {
      setStatus("Enter a numeric clan token ID.");
      return;
    }
    router.push(`/play/${trimmed}`);
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-6 py-12">
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gold">Playable UGC Realms</p>
            <h1 className="mt-3 text-4xl font-black text-parchment md:text-5xl">Enter a Clan Realm</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-stone">
              Explore realms stored on 0G Storage, discover their NPCs, clear their quests, and record completed runs as permanent clan evolution.
            </p>
          </div>

          <Panel title="Open Any Realm" icon={Search}>
            <div className="flex gap-2">
              <input
                value={tokenSearch}
                onChange={(event) => setTokenSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") enterToken();
                }}
                placeholder="Clan token ID"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-parchment outline-none focus:border-gold"
              />
              <button onClick={enterToken} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-obsidian">
                Enter
              </button>
            </div>
          </Panel>
        </div>

        {status && <div className="rounded-md border border-white/10 bg-black/25 p-4 text-sm text-parchment">{status}</div>}

        <div className="rounded-md border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-black text-parchment">Your Playable Realms</h2>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-gold" />}
          </div>

          {!isConnected ? (
            <EmptyState title="Connect a wallet" body="Owned clan realms appear here after wallet connection. You can still enter any token ID directly above." />
          ) : loading ? (
            <div className="py-16 text-center text-stone">Scanning owned tokens for realm roots...</div>
          ) : realms.length === 0 ? (
            <EmptyState title="No realm roots found" body="Mint a clan and store a UGC realm, or enter a token ID directly to preview another clan's realm." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {realms.map(({ tokenId: id, realm, clanState }) => (
                <motion.article
                  key={id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-md border border-white/10 bg-black/25 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded bg-gold/10 px-2 py-1 font-mono text-xs text-gold">Clan #{id}</span>
                    <span className="font-mono text-xs text-stone">{clanState.realmCount} realms</span>
                  </div>
                  <h3 className="text-xl font-black text-parchment">{realm.payload.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone">{realm.payload.lore}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-xs text-stone">{realm.payload.assets.length} realm assets</span>
                    <a href={`/play/${id}`} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-obsidian">
                      Enter Realm
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </main>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-5 w-5 text-gold" />
        <h2 className="text-2xl font-black text-parchment">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-10 text-center">
      <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-gold" />
      <h3 className="text-xl font-bold text-parchment">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone">{body}</p>
    </div>
  );
}
