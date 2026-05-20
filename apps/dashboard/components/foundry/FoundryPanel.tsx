"use client";

import { useState } from "react";
import { useClanDA } from "../../lib/foundry/use-clan-da";
import { foundryEnvFromBrowser, clanEventEnvelope } from "../../lib/foundry";
import type { ClanEventKind } from "@0gclawforge/foundry";

/**
 * Foundry panel — embedded inside the dashboard to demonstrate clan event
 * anchoring on 0G DA. Lets an operator pick an event kind, type a payload,
 * preview the canonical encoding + digest, and publish to DA.
 */
export function FoundryPanel({ tokenId }: { tokenId: bigint | number | string }) {
  const [kind, setKind] = useState<ClanEventKind>("clan.quest.outcome");
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify({ success: true, prompt: "explore the forest", outcome: "found a key" }, null, 2),
  );
  const [previewDigest, setPreviewDigest] = useState<string>("");
  const { publish, envelope, result, loading, error, reset } = useClanDA();
  const env = foundryEnvFromBrowser();

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
      <header className="mb-3 flex items-center justify-between">
        <div className="font-semibold">Foundry · 0G DA Anchor</div>
        <div className="text-xs text-zinc-400">
          network: {env.network} · chain {env.chainId}
        </div>
      </header>

      <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Event kind</label>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as ClanEventKind)}
        className="mb-3 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2"
      >
        <option value="clan.quest.outcome">clan.quest.outcome</option>
        <option value="clan.vote.tally">clan.vote.tally</option>
        <option value="clan.realm.snapshot">clan.realm.snapshot</option>
        <option value="clan.evolution.record">clan.evolution.record</option>
        <option value="clan.memory.delta">clan.memory.delta</option>
      </select>

      <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Payload (JSON)</label>
      <textarea
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        className="mb-3 h-40 w-full rounded-lg border border-zinc-800 bg-black p-2 font-mono text-xs"
      />

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-900"
        >
          Preview digest
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {loading ? "Publishing…" : "Publish to 0G DA"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="ml-auto rounded-lg border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900"
        >
          Reset
        </button>
      </div>

      {previewDigest && (
        <div className="mb-2 break-all rounded-lg border border-zinc-800 bg-black p-2 font-mono text-xs">
          <span className="text-zinc-400">preview digest: </span>
          {previewDigest}
        </div>
      )}
      {envelope && (
        <details className="mb-2 rounded-lg border border-zinc-800 bg-black p-2 text-xs">
          <summary className="cursor-pointer text-zinc-400">Envelope (canonical)</summary>
          <pre className="mt-2 overflow-x-auto">{envelope.canonical}</pre>
        </details>
      )}
      {result && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-2 text-xs">
          <div>digest: <span className="font-mono">{result.digest}</span></div>
          {result.daRef && <div>daRef: <span className="font-mono">{result.daRef}</span></div>}
          <div>mode: {result.mode} · {result.latencyMs}ms</div>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-700 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error.message}
        </div>
      )}
    </div>
  );
}
