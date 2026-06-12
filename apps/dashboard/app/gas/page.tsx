"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMainnetGasClaimMessage, OG_MAINNET_CHAIN_ID } from "@0gclawforge/sdk/gas";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Fuel, Loader2, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { useAccount, useChainId, useSignMessage, useSwitchChain } from "wagmi";

interface GasStationStatus {
  enabled: boolean;
  chainId: number;
  grantOg: string;
  cooldownHours: number;
  treasuryReady: boolean;
  address?: string;
  recipientBalanceOg?: string;
  retryAt?: number;
  eligible?: boolean;
}

interface ClaimResult {
  ok: boolean;
  amountOg: string;
  txHash: string;
  retryAt: number;
}

function formatRetryAt(value?: number) {
  return value && value > Date.now() ? new Date(value).toLocaleString() : "Ready now";
}

export default function MainnetGasStationPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [station, setStation] = useState<GasStationStatus>();
  const [result, setResult] = useState<ClaimResult>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setMessage("");
    try {
      const query = address ? `?address=${address}` : "";
      const response = await fetch(`/api/gas${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load the Mainnet Gas Station");
      setStation(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load the Mainnet Gas Station");
    }
  }, [address]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function claimGas() {
    if (!address) return setMessage("Connect the wallet that owns your clan first.");
    setBusy(true);
    setMessage("");
    setResult(undefined);
    try {
      if (chainId !== OG_MAINNET_CHAIN_ID) await switchChainAsync({ chainId: OG_MAINNET_CHAIN_ID });
      const issuedAt = Date.now();
      const signature = await signMessageAsync({
        message: buildMainnetGasClaimMessage({ address, issuedAt }),
      });
      const response = await fetch("/api/gas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, issuedAt, signature }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Mainnet gas claim failed");
      setResult(payload);
      setMessage(`${payload.amountOg} OG was sent to your clan wallet.`);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mainnet gas claim failed");
    } finally {
      setBusy(false);
    }
  }

  const canClaim = Boolean(station?.eligible && station?.treasuryReady && isConnected);

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b border-white/10 bg-gradient-to-br from-ember/[0.12] via-obsidian to-moss/[0.1]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_340px] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs uppercase tracking-[0.24em] text-gold">Clan Operator Utility</p>
            <h1 className="mt-3 text-4xl font-black text-parchment md:text-5xl">Mainnet Gas Station</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-stone">
              A guarded gas grant for players minting their first clan or testing real 0G Mainnet gameplay. Claims are wallet-signed, rate-limited, and available when the connected wallet needs gas.
            </p>
          </motion.div>
          <div className="rounded-md border border-gold/30 bg-black/25 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-moss" />
              <p className="text-sm font-semibold text-parchment">Protected Mainnet grants</p>
            </div>
            <p className="mt-3 font-mono text-xs leading-5 text-stone">
              Network: 0G Mainnet<br />
              Grant: {station?.grantOg || "..."} OG<br />
              Wallet cooldown: {station?.cooldownHours ?? "..."} hours
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <Fuel className="h-6 w-6 text-gold" />
            <h2 className="text-2xl font-black text-parchment">Fuel Your Clan</h2>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone">
            Connect the wallet you want to use for minting. Your signature authorizes a fixed grant to that same wallet; it never authorizes contract actions or exposes your keys.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StatusRow label="Station" value={station?.enabled ? "Enabled" : "Disabled"} good={station?.enabled} />
            <StatusRow label="Treasury" value={station?.treasuryReady ? "Ready" : "Unavailable"} good={station?.treasuryReady} />
            <StatusRow label="Mint readiness" value={station?.eligible ? "Eligible" : "Check balance"} good={station?.eligible} />
            <StatusRow label="Next claim" value={formatRetryAt(station?.retryAt)} good={!station?.retryAt || station.retryAt <= Date.now()} />
          </div>

          {station?.recipientBalanceOg && (
            <p className="mt-4 font-mono text-xs text-stone">Connected wallet balance: {Number(station.recipientBalanceOg).toFixed(6)} OG</p>
          )}
          {message && (
            <p className="mt-5 rounded-md border border-gold/30 bg-gold/[0.07] p-4 text-sm leading-6 text-parchment">{message}</p>
          )}
          {result && (
            <a
              href={`https://chainscan.0g.ai/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-parchment"
            >
              View confirmed transfer <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => void claimGas()}
              disabled={busy || !canClaim}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fuel className="h-4 w-4" />}
              Get Mainnet Gas
            </button>
            <button
              onClick={() => void loadStatus()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </motion.div>

        <aside className="rounded-md border border-white/10 bg-white/[0.03] p-6">
          <WalletCards className="h-6 w-6 text-gold" />
          <h2 className="mt-4 text-2xl font-black text-parchment">Claim Rules</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-stone">
            <p>One fixed grant per eligible wallet during the configured cooldown.</p>
            <p>No existing clan is required. New players can claim gas before minting their first clan.</p>
            <p>Daily treasury caps and network-level cooldowns protect the community pool.</p>
            <p>For unrestricted experimentation, switch your wallet to Galileo Testnet.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-white/10 py-2">
      <span className="text-sm text-stone">{label}</span>
      <span className={`inline-flex items-center gap-2 font-mono text-xs ${good ? "text-moss" : "text-parchment"}`}>
        {good && <CheckCircle2 className="h-4 w-4" />}
        {value}
      </span>
    </div>
  );
}
