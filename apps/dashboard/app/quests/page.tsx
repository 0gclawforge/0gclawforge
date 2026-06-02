"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, ScrollText, ShieldCheck, Swords } from "lucide-react";
import { useAccount, useChainId, useSignMessage, useWriteContract } from "wagmi";
import type { Address, Hex } from "viem";
import {
  buildClaimQuestMessage,
  buildCreateQuestMessage,
  buildPrepareQuestCompletionMessage,
  claimExternalQuest,
  confirmExternalQuestCompletion,
  createExternalQuest,
  listExternalQuests,
  prepareExternalQuestCompletion,
} from "@0gclawforge/sdk/quests";
import type { ExternalQuest } from "@0gclawforge/sdk/quests";
import { agentInftAbi } from "@0gclawforge/sdk/inft";
import { getAgentInftAddress } from "../../lib/contract-addresses";

const apiOptions = { apiBaseUrl: "" };

function compact(value: string) {
  return value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "No expiry";
}

function statusTone(status: ExternalQuest["status"]) {
  if (status === "completed") return "bg-moss/15 text-moss";
  if (status === "awaiting-anchor") return "bg-accent-primary/20 text-accent-secondary";
  if (status === "claimed") return "bg-gold/15 text-gold";
  return "bg-white/10 text-parchment";
}

export default function ExternalQuestBoardPage() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const [quests, setQuests] = useState<ExternalQuest[]>([]);
  const [registryRoot, setRegistryRoot] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [claimTokens, setClaimTokens] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    creatorName: "",
    title: "",
    description: "",
    reward: "",
    requiredSkill: "",
    expiresAt: "",
  });

  const loadQuests = useCallback(async () => {
    setStatus("");
    try {
      const payload = await listExternalQuests(chainId, apiOptions);
      setQuests(payload.quests);
      setRegistryRoot(payload.registryRootHash);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load external quests");
    }
  }, [chainId]);

  useEffect(() => {
    void loadQuests();
  }, [loadQuests]);

  async function publishQuest(event: FormEvent) {
    event.preventDefault();
    if (!address) return setStatus("Connect a wallet before publishing a quest.");
    setBusy("create");
    setStatus("");
    try {
      const input = {
        chainId,
        creatorAddress: address,
        creatorName: form.creatorName,
        title: form.title,
        description: form.description,
        reward: form.reward,
        requiredSkill: form.requiredSkill,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : undefined,
      };
      const signature = await signMessageAsync({ message: buildCreateQuestMessage(input) });
      await createExternalQuest({ ...input, signature }, apiOptions);
      setForm({ creatorName: "", title: "", description: "", reward: "", requiredSkill: "", expiresAt: "" });
      setStatus("Quest published to 0G Storage and opened for sovereign clans.");
      await loadQuests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to publish quest");
    } finally {
      setBusy("");
    }
  }

  async function claim(quest: ExternalQuest) {
    if (!address) return setStatus("Connect the clan owner's wallet before claiming a quest.");
    const clanTokenId = (claimTokens[quest.id] || "").trim();
    if (!/^\d+$/.test(clanTokenId)) return setStatus("Enter the clan token ID that will claim this quest.");
    setBusy(`claim:${quest.id}`);
    setStatus("");
    try {
      const input = { chainId, questId: quest.id, clanTokenId, claimerAddress: address };
      const signature = await signMessageAsync({ message: buildClaimQuestMessage(input) });
      await claimExternalQuest({ ...input, signature }, apiOptions);
      setStatus(`Clan #${clanTokenId} claimed "${quest.title}".`);
      await loadQuests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to claim quest");
    } finally {
      setBusy("");
    }
  }

  async function complete(quest: ExternalQuest) {
    if (!address || !quest.claimedByClanTokenId) return setStatus("Connect the clan owner's wallet first.");
    const result = (results[quest.id] || "").trim();
    if (!result) return setStatus("Describe the completed work before anchoring the result.");
    setBusy(`complete:${quest.id}`);
    setStatus("");
    try {
      const input = {
        chainId,
        questId: quest.id,
        clanTokenId: quest.claimedByClanTokenId,
        claimerAddress: address,
        result,
      };
      const signature = await signMessageAsync({ message: buildPrepareQuestCompletionMessage(input) });
      const prepared = await prepareExternalQuestCompletion({ ...input, signature }, apiOptions);
      const evolution = prepared.evolution;
      const anchorTxHash = await writeContractAsync({
        address: getAgentInftAddress(chainId) as Address,
        abi: agentInftAbi,
        functionName: "recordClanEvolution",
        args: [
          BigInt(evolution.tokenId),
          evolution.metadataHash as Hex,
          evolution.storageURI,
          evolution.memoryRootURI,
          evolution.realmRootURI,
          BigInt(evolution.memorySize),
          BigInt(evolution.realmCount),
          evolution.proof,
        ],
      });
      setStatus("Completion submitted on-chain. Waiting for the 0G transaction confirmation...");
      await confirmExternalQuestCompletion({ chainId, questId: quest.id, anchorTxHash }, apiOptions);
      setStatus(`Quest completed and anchored by clan #${quest.claimedByClanTokenId}.`);
      await loadQuests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to complete quest");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b border-white/10 bg-gradient-to-br from-ember/[0.1] via-obsidian to-moss/[0.09]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_340px] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs uppercase tracking-[0.24em] text-gold">Agent Economy</p>
            <h1 className="mt-3 text-4xl font-black text-parchment md:text-5xl">External Quest Board</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-stone">
              Protocols publish work. Clan owners claim it. Completed results are stored on 0G and anchored through the clan&apos;s on-chain evolution record.
            </p>
          </motion.div>
          <div className="rounded-md border border-gold/30 bg-black/25 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-moss" />
              <p className="text-sm font-semibold text-parchment">Owner-signed completion</p>
            </div>
            <p className="mt-3 font-mono text-xs leading-5 text-stone">Network {chainId}<br />Registry {registryRoot ? compact(registryRoot) : "No published quests yet"}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[360px_1fr]">
        <form onSubmit={publishQuest} className="h-fit rounded-md border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-gold" />
            <h2 className="text-2xl font-black text-parchment">Publish Quest</h2>
          </div>
          <Field label="Builder name" value={form.creatorName} onChange={(value) => setForm({ ...form, creatorName: value })} placeholder="Protocol or guild" />
          <Field label="Quest title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Map the ember vault" required />
          <TextArea label="Objective" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Describe the verifiable work..." />
          <Field label="Reward" value={form.reward} onChange={(value) => setForm({ ...form, reward: value })} placeholder="500 reputation points" required />
          <Field label="Required skill" value={form.requiredSkill} onChange={(value) => setForm({ ...form, requiredSkill: value })} placeholder="Realm exploration" required />
          <Field label="Expires" type="datetime-local" value={form.expiresAt} onChange={(value) => setForm({ ...form, expiresAt: value })} />
          <button disabled={busy === "create" || !isConnected} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian disabled:opacity-60">
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Publish to 0G
          </button>
        </form>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-parchment">Sovereign Work Queue</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-moss">Immutable quest transitions on 0G Storage</p>
            </div>
            <button onClick={() => void loadQuests()} className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
          {status && <p className="mb-5 rounded-md border border-gold/30 bg-gold/[0.07] p-4 text-sm leading-6 text-parchment">{status}</p>}
          {quests.length === 0 ? (
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-10 text-center">
              <Swords className="mx-auto h-8 w-8 text-gold" />
              <h3 className="mt-4 text-xl font-black text-parchment">No external quests yet</h3>
              <p className="mt-2 text-sm text-stone">Publish the first task for the clan civilization.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quests.map((quest) => (
                <article key={quest.id} className="rounded-md border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-1 font-mono text-[10px] uppercase ${statusTone(quest.status)}`}>{quest.status.replace("-", " ")}</span>
                        <span className="font-mono text-[10px] text-stone">{compact(quest.id)}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-parchment">{quest.title}</h3>
                    </div>
                    {quest.status === "completed" && <CheckCircle2 className="h-6 w-6 text-moss" />}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone">{quest.description}</p>
                  <div className="mt-4 grid gap-3 border-y border-white/10 py-3 font-mono text-xs text-stone sm:grid-cols-3">
                    <p><span className="text-gold">Reward</span><br />{quest.reward}</p>
                    <p><span className="text-gold">Skill</span><br />{quest.requiredSkill}</p>
                    <p><span className="text-gold">Expiry</span><br />{formatTime(quest.expiresAt)}</p>
                  </div>
                  {quest.status === "open" && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input value={claimTokens[quest.id] || ""} onChange={(event) => setClaimTokens({ ...claimTokens, [quest.id]: event.target.value })} placeholder="Clan token ID" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-parchment outline-none focus:border-gold/60" />
                      <button onClick={() => void claim(quest)} disabled={busy === `claim:${quest.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-obsidian disabled:opacity-60">
                        {busy === `claim:${quest.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Claim for Clan
                      </button>
                    </div>
                  )}
                  {(quest.status === "claimed" || quest.status === "awaiting-anchor") && quest.claimerAddress?.toLowerCase() === address?.toLowerCase() && (
                    <div className="mt-4">
                      <TextArea label="Completion result" value={results[quest.id] || ""} onChange={(value) => setResults({ ...results, [quest.id]: value })} placeholder="Describe the outcome and proof context..." />
                      <button onClick={() => void complete(quest)} disabled={busy === `complete:${quest.id}`} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-obsidian disabled:opacity-60">
                        {busy === `complete:${quest.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {quest.status === "awaiting-anchor" ? "Retry Completion Anchor" : "Store and Anchor Completion"}
                      </button>
                    </div>
                  )}
                  {quest.claimedByClanTokenId && <p className="mt-4 font-mono text-xs text-stone">Assigned clan: #{quest.claimedByClanTokenId}</p>}
                  {quest.completion && <p className="mt-2 font-mono text-xs text-moss">Anchored: {compact(quest.completion.anchorTxHash)}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="mb-3 block text-xs uppercase tracking-[0.14em] text-stone">{label}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm normal-case tracking-normal text-parchment outline-none focus:border-gold/60" /></label>;
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="mb-3 block text-xs uppercase tracking-[0.14em] text-stone">{label}<textarea value={value} required onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm normal-case tracking-normal text-parchment outline-none focus:border-gold/60" /></label>;
}
