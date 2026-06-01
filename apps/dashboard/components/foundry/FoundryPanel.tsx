"use client";

import { useState } from "react";
import { DatabaseZap, Eye, RotateCcw } from "lucide-react";
import { useClanDA } from "../../lib/foundry/use-clan-da";
import { foundryEnvFromBrowser, clanEventEnvelope } from "../../lib/foundry";
import type { ClanEventKind } from "@0gclawforge/foundry/types";

/**
 * Foundry panel - embedded inside the dashboard to demonstrate clan event
 * anchoring on 0G DA. Lets an operator pick an event kind, type a payload,
 * preview the canonical encoding + digest, and publish to DA.
 */
export function FoundryPanel({
  tokenId,
  chainId,
}: {
  tokenId: bigint | number | string;
  chainId: number;
}) {
  const [kind, setKind] = useState<ClanEventKind>("clan.quest.outcome");
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify({ success: true, prompt: "explore the forest", outcome: "found a key" }, null, 2),
  );
  const [previewDigest, setPreviewDigest] = useState<string>("");
  const { publish, envelope, result, loading, error, reset } = useClanDA({
    network: chainId === 16661 ? "aristotle" : "galileo",
  });
  const env = foundryEnvFromBrowser(chainId);

  const onPreview = () => {
    try {
      const payload = JSON.parse(payloadText);
      const built = clanEventEnvelope(kind, tokenId, payload);
      setPreviewDigest(built.digest);
    } catch (e) {
      setPreviewDigest(e instanceof Error ? `error: ${e.message}` : "error");
    }
  };

  const onPublish = async () => {
    try {
      const payload = JSON.parse(payloadText);
      await publish(kind, tokenId, payload);
    } catch {
      // state.error is already set by the hook
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm shadow-glow">
      <header className="mb-3 flex items-center justify-between">
        <div className="font-semibold text-parchment">Foundry / 0G DA Anchor</div>
        <div className="font-mono text-xs text-stone">
          network: {env.network} / chain {env.chainId}
        </div>
      </header>

      <label className="mb-2 block font-mono text-xs uppercase text-stone">Event kind</label>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as ClanEventKind)}
        className="mb-3 w-full rounded-lg border border-white/10 bg-obsidian px-3 py-2 text-parchment outline-none transition focus:border-gold"
      >
        <option value="clan.quest.outcome">clan.quest.outcome</option>
        <option value="clan.vote.tally">clan.vote.tally</option>
        <option value="clan.realm.snapshot">clan.realm.snapshot</option>
        <option value="clan.evolution.record">clan.evolution.record</option>
        <option value="clan.memory.delta">clan.memory.delta</option>
      </select>

      <label className="mb-2 block font-mono text-xs uppercase text-stone">Payload (JSON)</label>
      <textarea
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        className="mb-3 h-40 w-full rounded-lg border border-white/10 bg-obsidian p-2 font-mono text-xs text-parchment outline-none transition focus:border-gold"
      />

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-parchment transition hover:border-gold"
        >
          <Eye className="h-4 w-4 text-gold" />
          Preview digest
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-obsidian disabled:opacity-60"
        >
          <DatabaseZap className="h-4 w-4" />
          {loading ? "Publishing..." : "Publish to 0G DA"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone transition hover:border-gold hover:text-parchment"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {previewDigest && (
        <div className="mb-2 break-all rounded-lg border border-white/10 bg-obsidian p-2 font-mono text-xs text-parchment">
          <span className="text-stone">preview digest: </span>
          {previewDigest}
        </div>
      )}
      {envelope && (
        <details className="mb-2 rounded-lg border border-white/10 bg-obsidian p-2 text-xs">
          <summary className="cursor-pointer text-stone">Envelope (canonical)</summary>
          <pre className="mt-2 overflow-x-auto">{envelope.canonical}</pre>
        </details>
      )}
      {result && (
        <div className="rounded-lg border border-moss bg-moss/20 p-2 text-xs text-parchment">
          <div>digest: <span className="font-mono">{result.digest}</span></div>
          {result.daRef && <div>daRef: <span className="font-mono">{result.daRef}</span></div>}
          <div>mode: {result.mode} / {result.latencyMs}ms</div>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-ember bg-ember/20 p-2 text-xs text-parchment">
          {error.message}
        </div>
      )}
    </div>
  );
}
