"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Coins,
  Database,
  ExternalLink,
  Gavel,
  Loader2,
  Network,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";
import { parseEther, parseEventLogs, type Address, type Hex } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { agentInftAbi } from "../lib/agent-inft-abi";
import { getAgentInftAddress } from "../lib/contract-addresses";

type Tab = "mint" | "realm" | "governance" | "evolution" | "trade";
type StatusKind = "idle" | "working" | "success" | "error";

interface Status {
  kind: StatusKind;
  message: string;
  txHash?: Hex;
}

interface RuntimeStatus {
  deployed: boolean;
  telegramActive: boolean;
  discordActive: boolean;
  lastDepinSummary?: string;
  lastQuestOutcome?: string;
  memoryRootHash?: string | null;
}

interface RuntimeIntegration {
  telegramConfigured: boolean;
  telegramChatBound: boolean;
  discordConfigured: boolean;
  discordGuildBound: boolean;
  discordChannelBound: boolean;
  depinBaseUrl: string;
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "mint", label: "Mint Clan" },
  { id: "realm", label: "UGC Realm" },
  { id: "governance", label: "Votes" },
  { id: "evolution", label: "Live Clan Dashboard" },
  { id: "trade", label: "Trade" },
];

const galileoExplorerUrl = process.env.NEXT_PUBLIC_OG_EXPLORER || "https://chainscan-galileo.0g.ai";
const mainnetExplorerUrl = process.env.NEXT_PUBLIC_OG_MAINNET_EXPLORER || "https://chainscan.0g.ai";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const contractAddress = getAgentInftAddress(chainId) as Address;
  const explorerUrl = chainId === 16661 ? mainnetExplorerUrl : galileoExplorerUrl;

  const [activeTab, setActiveTab] = useState<Tab>("mint");
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "Connect a wallet to start." });
  const [clanName, setClanName] = useState("The Iron Grove");
  const [archetype, setArchetype] = useState("Realm builders with memory-bound guardians");
  const [mission, setMission] = useState("Create permanent playable worlds that evolve by community vote.");
  const [tokenId, setTokenId] = useState("");
  const [memoryRoot, setMemoryRoot] = useState("");
  const [realmRoot, setRealmRoot] = useState("");
  const [voteRoot, setVoteRoot] = useState("");
  const [realmCount, setRealmCount] = useState(0);
  const [realmPrompt, setRealmPrompt] = useState("Add a moonlit forest realm with a memory-bound dragon boss");
  const [proposal, setProposal] = useState("Add a dragon boss to the forest realm");
  const [salePrice, setSalePrice] = useState("0.25");
  const [depinQuery, setDepinQuery] = useState("athens");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [runtimeIntegration, setRuntimeIntegration] = useState<RuntimeIntegration | null>(null);
  const [depinSummary, setDepinSummary] = useState("");
  const [questOutcome, setQuestOutcome] = useState("");

  const loadLatestOwnedClan = async () => {
    if (!isConnected || !address || !publicClient || !contractAddress) return null;

    const balance = await publicClient.readContract({
      address: contractAddress,
      abi: agentInftAbi,
      functionName: "balanceOf",
      args: [address],
    });
    if (balance === BigInt(0)) return null;

    const lastIndex = balance - BigInt(1);
    const ownedTokenId = await publicClient.readContract({
      address: contractAddress,
      abi: agentInftAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [address, lastIndex],
    });

    const tid = ownedTokenId.toString();
    setTokenId(tid);

    const state = await publicClient.readContract({
      address: contractAddress,
      abi: agentInftAbi,
      functionName: "getClanState",
      args: [ownedTokenId],
    });

    if (state.memoryRootURI) setMemoryRoot(state.memoryRootURI);
    if (state.realmRootURI) setRealmRoot(state.realmRootURI);
    if (state.voteRootURI) setVoteRoot(state.voteRootURI);
    setRealmCount(Number(state.realmCount));

    return tid;
  };

  useEffect(() => {
    void refreshRuntimeStatus();
  }, []);

  // Auto-load token ID and clan state for the connected wallet
  useEffect(() => {
    if (!isConnected || !address || !publicClient || !contractAddress) return;
    let cancelled = false;

    (async () => {
      try {
        if (cancelled) return;
        await loadLatestOwnedClan();
      } catch {
        // Contract may not exist on this chain or wallet has no tokens
      }
    })();

    return () => { cancelled = true; };
  }, [isConnected, address, publicClient, contractAddress]);

  const assertReady = () => {
    if (!isConnected || !address) {
      throw new Error("Connect a wallet first.");
    }
    if (!contractAddress) {
      throw new Error("Agent iNFT contract address is not configured for this network.");
    }
  };

  const postClanAction = async <T,>(body: Record<string, unknown>): Promise<T> => {
    const response = await fetch("/api/clans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "0G request failed");
    }
    return payload;
  };

  const postAutonomyAction = async <T,>(body: Record<string, unknown>): Promise<T> => {
    const response = await fetch("/api/autonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Autonomy request failed");
    }
    return payload;
  };

  const syncRuntimeState = (nextStatus: RuntimeStatus | null, integration?: RuntimeIntegration | null) => {
    setRuntimeStatus(nextStatus);
    if (integration) {
      setRuntimeIntegration(integration);
    }
    if (nextStatus?.memoryRootHash) {
      setMemoryRoot(nextStatus.memoryRootHash);
    }
    if (nextStatus?.lastDepinSummary) {
      setDepinSummary(nextStatus.lastDepinSummary);
    }
    if (nextStatus?.lastQuestOutcome) {
      setQuestOutcome(nextStatus.lastQuestOutcome);
    }
  };

  const refreshRuntimeStatus = async () => {
    const response = await fetch("/api/autonomy", { cache: "no-store" });
    const payload = (await response.json()) as RuntimeStatus & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch runtime status");
    }
    syncRuntimeState(payload);
    return payload;
  };

  const run = async (label: string, action: () => Promise<Status>) => {
    setStatus({ kind: "working", message: label });
    try {
      const result = await action();
      setStatus(result);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const mintClan = () =>
    run("Uploading clan memory to 0G Storage...", async () => {
      assertReady();
      const prepared = await postClanAction<{
        storageURI: string;
        metadataHash: Hex;
        memoryRootURI: string;
        realmRootURI: string;
      }>({
        action: "prepareMint",
        clanName,
        archetype,
        mission,
        owner: address,
      });

      setStatus({ kind: "working", message: "Waiting for wallet signature to mint clan iNFT..." });
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "mintClan",
        args: [
          address!,
          clanName,
          archetype,
          "0g-tee-openclaw",
          prepared.metadataHash,
          prepared.storageURI,
          prepared.memoryRootURI,
          prepared.realmRootURI,
        ],
      });

      setMemoryRoot(prepared.memoryRootURI);
      setRealmRoot(prepared.realmRootURI);
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000, pollingInterval: 3_000 });
          const events = parseEventLogs({
            abi: agentInftAbi,
            eventName: "ClanMinted",
            logs: receipt.logs,
          });
          const mintedTokenId = events[0]?.args.tokenId;
          if (mintedTokenId) {
            setTokenId(mintedTokenId.toString());
          }
        } catch {
          const recoveredTokenId = await loadLatestOwnedClan().catch(() => null);
          if (recoveredTokenId) {
            return {
              kind: "success",
              message: `Clan mint confirmed by wallet ownership scan. Token #${recoveredTokenId} is ready.`,
              txHash: hash,
            };
          }

          return {
            kind: "success",
            message: "Clan mint tx submitted. The RPC has not returned the receipt yet, but the app will auto-load the token when the wallet index updates.",
            txHash: hash,
          };
        }
      }

      return {
        kind: "success",
        message: "Clan minted. The token ID is filled in for realm, vote, dashboard, and trade actions.",
        txHash: hash,
      };
    });

  const storeRealm = () =>
    run("Uploading realm to 0G Storage...", async () => {
      assertReady();
      if (!tokenId) throw new Error("Enter the clan token ID first.");
      const stored = await postClanAction<{ realmRootURI: string; realmCount: number }>({
        action: "storeRealm",
        tokenId,
        prompt: realmPrompt,
        currentRealmCount: realmCount,
      });

      setStatus({ kind: "working", message: "Waiting for wallet signature to update realm root..." });
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "updateRealmRoot",
        args: [BigInt(tokenId), stored.realmRootURI, BigInt(stored.realmCount), "0x"],
      });

      setRealmRoot(stored.realmRootURI);
      setRealmCount(stored.realmCount);
      return { kind: "success", message: "Realm root updated on-chain.", txHash: hash };
    });

  const storeVote = () =>
    run("Uploading vote record to 0G Storage...", async () => {
      assertReady();
      if (!tokenId) throw new Error("Enter the clan token ID first.");
      const stored = await postClanAction<{ voteRootURI: string; proposalCount: number }>({
        action: "storeVote",
        tokenId,
        proposal,
        yesVotes: 1,
        noVotes: 0,
      });

      setStatus({ kind: "working", message: "Waiting for wallet signature to update vote root..." });
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "updateVoteRoot",
        args: [BigInt(tokenId), stored.voteRootURI, BigInt(stored.proposalCount), "0x"],
      });

      setVoteRoot(stored.voteRootURI);
      return { kind: "success", message: "Vote root updated on-chain.", txHash: hash };
    });

  const executeEvolution = () =>
    run("Uploading evolution record to 0G Storage...", async () => {
      assertReady();
      if (!tokenId) throw new Error("Enter the clan token ID first.");
      const stored = await postClanAction<{
        metadataHash: Hex;
        storageURI: string;
        memoryRootURI: string;
        realmRootURI: string;
        memorySize: number;
        realmCount: number;
      }>({
        action: "storeEvolution",
        tokenId,
        proposal,
        prompt: realmPrompt,
        currentRealmCount: realmCount,
        executor: address,
      });

      setStatus({ kind: "working", message: "Waiting for wallet signature to record clan evolution..." });
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "recordClanEvolution",
        args: [
          BigInt(tokenId),
          stored.metadataHash,
          stored.storageURI,
          stored.memoryRootURI,
          stored.realmRootURI,
          BigInt(stored.memorySize),
          BigInt(stored.realmCount),
          "0x",
        ],
      });

      setMemoryRoot(stored.memoryRootURI);
      setRealmRoot(stored.realmRootURI);
      setRealmCount(stored.realmCount);
      return { kind: "success", message: "Clan evolution submitted on-chain.", txHash: hash };
    });

  const deployRuntime = () =>
    run("Deploying live Telegram and Discord clan runtime...", async () => {
      if (!tokenId) throw new Error("Mint or enter a clan token ID first.");
      const payload = await postAutonomyAction<{
        status: RuntimeStatus;
        integration: RuntimeIntegration;
      }>({
        action: "deploy",
        clanName,
        tokenId,
        proposal,
        realmPrompt,
        depinQuery,
        memoryRootHash: memoryRoot || null,
        telegramChatId,
        discordGuildId,
        discordChannelId,
      });
      syncRuntimeState(payload.status, payload.integration);

      const transportSummary = [
        payload.integration.telegramConfigured
          ? payload.integration.telegramChatBound
            ? "Telegram bot bound to a live chat."
            : "Telegram bot deployed; bind a chat by starting the bot or supplying a chat ID."
          : "Telegram token is not configured.",
        payload.integration.discordConfigured
          ? payload.integration.discordGuildBound
            ? "Discord commands deployed to the target guild."
            : "Discord commands deployed globally; set a guild ID for guild-scoped management."
          : "Discord token is not configured.",
      ].join(" ");

      return {
        kind: "success",
        message: `Clan runtime deployed. ${transportSummary}`,
      };
    });

  const runAutonomousQuest = () =>
    run("Running live autonomous quest + DePIN cycle...", async () => {
      const payload = await postAutonomyAction<{
        status: RuntimeStatus;
        integration: RuntimeIntegration;
      }>({
        action: "runQuest",
      });
      syncRuntimeState(payload.status, payload.integration);
      return {
        kind: "success",
        message: payload.status.lastQuestOutcome || "Autonomous cycle completed.",
      };
    });

  const fetchDepinSnapshot = () =>
    run("Fetching live WeatherXM network state...", async () => {
      const payload = await postAutonomyAction<{
        summary: string;
        integration: RuntimeIntegration;
      }>({
        action: "depin",
        depinQuery,
      });
      setDepinSummary(payload.summary);
      setRuntimeIntegration(payload.integration);
      return {
        kind: "success",
        message: "Fetched live WeatherXM data and stored the summary in dashboard state.",
      };
    });

  const refreshAutonomy = () =>
    run("Refreshing clan runtime status...", async () => {
      const nextStatus = await refreshRuntimeStatus();
      return {
        kind: "success",
        message: nextStatus.deployed ? "Runtime status refreshed." : "Runtime is not deployed yet.",
      };
    });

  const stopAutonomy = () =>
    run("Stopping live clan runtime...", async () => {
      const payload = await postAutonomyAction<{ stopped: boolean; status: RuntimeStatus }>({
        action: "stop",
      });
      syncRuntimeState(payload.status, null);
      return {
        kind: "success",
        message: payload.stopped ? "Runtime stopped." : "Runtime status unchanged.",
      };
    });

  const listClan = () =>
    run("Waiting for wallet signature to list clan iNFT...", async () => {
      assertReady();
      if (!tokenId) throw new Error("Enter the clan token ID first.");
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "listForSale",
        args: [BigInt(tokenId), parseEther(salePrice)],
      });
      return { kind: "success", message: "Clan listed for sale on the iNFT contract.", txHash: hash };
    });

  const delistClan = () =>
    run("Waiting for wallet signature to delist clan iNFT...", async () => {
      assertReady();
      if (!tokenId) throw new Error("Enter the clan token ID first.");
      const hash = await writeContractAsync({
        address: contractAddress!,
        abi: agentInftAbi,
        functionName: "delist",
        args: [BigInt(tokenId)],
      });
      return { kind: "success", message: "Clan sale listing removed.", txHash: hash };
    });

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <div>
            <h1 className="text-4xl font-black leading-tight text-parchment">0GClawForge</h1>
            <p className="mt-3 text-sm leading-6 text-stone">
              Mint, store, evolve, deploy to chat, and trade real clan iNFTs on 0G Galileo. Switch to mainnet from the wallet control when addresses are deployed there.
            </p>
          </div>

          <div className="grid gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "border-gold bg-gold text-obsidian"
                    : "border-white/10 bg-black/20 text-stone hover:text-parchment"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && <CheckCircle2 className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <StatusPanel status={status} explorerUrl={explorerUrl} />
        </aside>

        <motion.section
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={Network} label="Chain" value={chainId === 16661 ? "0G Mainnet" : "0G Galileo"} />
            <Metric icon={Wallet} label="Wallet" value={isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"} />
            <Metric icon={ShieldCheck} label="iNFT Contract" value={contractAddress ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}` : "Missing"} />
            <Metric icon={Database} label="Clan Token" value={tokenId || "Not minted"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <Workspace
              activeTab={activeTab}
              clanName={clanName}
              setClanName={setClanName}
              archetype={archetype}
              setArchetype={setArchetype}
              mission={mission}
              setMission={setMission}
              tokenId={tokenId}
              setTokenId={setTokenId}
              realmRoot={realmRoot}
              realmPrompt={realmPrompt}
              setRealmPrompt={setRealmPrompt}
              proposal={proposal}
              setProposal={setProposal}
              salePrice={salePrice}
              setSalePrice={setSalePrice}
              mintClan={mintClan}
              storeRealm={storeRealm}
              storeVote={storeVote}
              executeEvolution={executeEvolution}
              listClan={listClan}
              delistClan={delistClan}
              busy={status.kind === "working"}
              depinQuery={depinQuery}
              setDepinQuery={setDepinQuery}
              telegramChatId={telegramChatId}
              setTelegramChatId={setTelegramChatId}
              discordGuildId={discordGuildId}
              setDiscordGuildId={setDiscordGuildId}
              discordChannelId={discordChannelId}
              setDiscordChannelId={setDiscordChannelId}
              deployRuntime={deployRuntime}
              runAutonomousQuest={runAutonomousQuest}
              fetchDepinSnapshot={fetchDepinSnapshot}
              refreshAutonomy={refreshAutonomy}
              stopAutonomy={stopAutonomy}
              runtimeStatus={runtimeStatus}
              depinSummary={depinSummary}
              questOutcome={questOutcome}
              runtimeIntegration={runtimeIntegration}
            />

            <StatePanel
              memoryRoot={memoryRoot}
              realmRoot={realmRoot}
              voteRoot={voteRoot}
              realmCount={realmCount}
              tokenId={tokenId}
              runtimeStatus={runtimeStatus}
              depinSummary={depinSummary}
              questOutcome={questOutcome}
            />
          </div>
        </motion.section>
      </section>
    </main>
  );
}

function Workspace(props: {
  activeTab: Tab;
  clanName: string;
  setClanName: (value: string) => void;
  archetype: string;
  setArchetype: (value: string) => void;
  mission: string;
  setMission: (value: string) => void;
  tokenId: string;
  setTokenId: (value: string) => void;
  realmRoot: string;
  realmPrompt: string;
  setRealmPrompt: (value: string) => void;
  proposal: string;
  setProposal: (value: string) => void;
  salePrice: string;
  setSalePrice: (value: string) => void;
  mintClan: () => void;
  storeRealm: () => void;
  storeVote: () => void;
  executeEvolution: () => void;
  listClan: () => void;
  delistClan: () => void;
  busy: boolean;
  depinQuery: string;
  setDepinQuery: (value: string) => void;
  telegramChatId: string;
  setTelegramChatId: (value: string) => void;
  discordGuildId: string;
  setDiscordGuildId: (value: string) => void;
  discordChannelId: string;
  setDiscordChannelId: (value: string) => void;
  deployRuntime: () => void;
  runAutonomousQuest: () => void;
  fetchDepinSnapshot: () => void;
  refreshAutonomy: () => void;
  stopAutonomy: () => void;
  runtimeStatus: RuntimeStatus | null;
  depinSummary: string;
  questOutcome: string;
  runtimeIntegration: RuntimeIntegration | null;
}) {
  if (props.activeTab === "mint") {
    return (
      <Panel title="Mint a Clan iNFT" icon={Sparkles}>
        <TextInput label="Clan name" value={props.clanName} onChange={props.setClanName} />
        <TextInput label="Archetype" value={props.archetype} onChange={props.setArchetype} />
        <TextArea label="Mission memory" value={props.mission} onChange={props.setMission} />
        <ActionButton onClick={props.mintClan} busy={props.busy} label="Upload to 0G and mint iNFT" />
      </Panel>
    );
  }

  if (props.activeTab === "realm") {
    return (
      <Panel title="Create Permanent UGC Realm" icon={Database}>
        <TextInput label="Clan token ID" value={props.tokenId} onChange={props.setTokenId} />
        <TextArea label="OpenClaw realm prompt" value={props.realmPrompt} onChange={props.setRealmPrompt} />
        <ActionButton onClick={props.storeRealm} busy={props.busy} label="Store realm and update root" />
        {props.realmRoot && props.tokenId && (
          <a
            href={`/play/${props.tokenId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold hover:text-obsidian"
          >
            Play this Realm →
          </a>
        )}
      </Panel>
    );
  }

  if (props.activeTab === "governance") {
    return (
      <Panel title="Community Vote Root" icon={Vote}>
        <TextInput label="Clan token ID" value={props.tokenId} onChange={props.setTokenId} />
        <TextArea label="Evolution proposal" value={props.proposal} onChange={props.setProposal} />
        <ActionButton onClick={props.storeVote} busy={props.busy} label="Store vote and update root" />
      </Panel>
    );
  }

  if (props.activeTab === "evolution") {
    return (
      <div className="space-y-6">
        <Panel title="Live Clan Dashboard" icon={ShieldCheck}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Clan token ID" value={props.tokenId} onChange={props.setTokenId} />
            <TextInput label="WeatherXM query" value={props.depinQuery} onChange={props.setDepinQuery} />
          </div>
          <TextArea label="Winning proposal" value={props.proposal} onChange={props.setProposal} />
          <TextArea label="Active realm prompt" value={props.realmPrompt} onChange={props.setRealmPrompt} />
          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={props.executeEvolution} busy={props.busy} label="Record on-chain evolution" />
            <button
              onClick={props.refreshAutonomy}
              disabled={props.busy}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-parchment disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh runtime
            </button>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Deploy to Chat" icon={Bot}>
            <TextInput label="Telegram chat ID (optional)" value={props.telegramChatId} onChange={props.setTelegramChatId} />
            <TextInput label="Discord guild ID (optional)" value={props.discordGuildId} onChange={props.setDiscordGuildId} />
            <TextInput label="Discord channel ID (optional)" value={props.discordChannelId} onChange={props.setDiscordChannelId} />
            <div className="flex flex-wrap gap-3">
              <ActionButton onClick={props.deployRuntime} busy={props.busy} label="Deploy live bots" />
              <button
                onClick={props.stopAutonomy}
                disabled={props.busy}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-parchment disabled:opacity-60"
              >
                Stop runtime
              </button>
            </div>
            <IntegrationList integration={props.runtimeIntegration} />
          </Panel>

          <Panel title="Autonomous Engine" icon={Radio}>
            <div className="flex flex-wrap gap-3">
              <ActionButton onClick={props.runAutonomousQuest} busy={props.busy} label="Run quest cycle now" />
              <button
                onClick={props.fetchDepinSnapshot}
                disabled={props.busy}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-parchment disabled:opacity-60"
              >
                <Database className="h-4 w-4" />
                Fetch WeatherXM
              </button>
            </div>
            <OutputCard title="Latest quest outcome" value={props.questOutcome || "No autonomous quest has run yet."} />
            <OutputCard title="Latest DePIN summary" value={props.depinSummary || "No WeatherXM snapshot fetched yet."} />
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <Panel title="Trade Clan iNFT" icon={Gavel}>
      <TextInput label="Clan token ID" value={props.tokenId} onChange={props.setTokenId} />
      <TextInput label="Sale price in OG" value={props.salePrice} onChange={props.setSalePrice} />
      <div className="flex flex-wrap gap-3">
        <ActionButton onClick={props.listClan} busy={props.busy} label="List for sale" />
        <button
          onClick={props.delistClan}
          disabled={props.busy}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-parchment disabled:opacity-60"
        >
          Remove listing
        </button>
      </div>
    </Panel>
  );
}

function StatePanel(props: {
  memoryRoot: string;
  realmRoot: string;
  voteRoot: string;
  realmCount: number;
  tokenId: string;
  runtimeStatus: RuntimeStatus | null;
  depinSummary: string;
  questOutcome: string;
}) {
  return (
    <Panel title="Live Clan State" icon={Coins}>
      <StateRow label="Token ID" value={props.tokenId || "Mint a clan or enter an existing token"} />
      <StateRow label="Memory root" value={props.memoryRoot || "No local root yet"} />
      <StateRow label="Realm root" value={props.realmRoot || "No local root yet"} />
      <StateRow label="Vote root" value={props.voteRoot || "No local root yet"} />
      <StateRow label="Realm count" value={String(props.realmCount)} />
      <StateRow label="Telegram runtime" value={props.runtimeStatus?.telegramActive ? "Active" : "Inactive"} />
      <StateRow label="Discord runtime" value={props.runtimeStatus?.discordActive ? "Active" : "Inactive"} />
      <StateRow label="Latest quest" value={props.questOutcome || "No quest run yet"} />
      <StateRow label="Latest DePIN" value={props.depinSummary || "No WeatherXM snapshot yet"} />
      <p className="mt-5 text-xs leading-5 text-stone">
        These values are produced by real 0G Storage upload responses, live WeatherXM network pulls, and runtime actions that write new memory roots back into the clan state.
      </p>
    </Panel>
  );
}

function StatusPanel({ status, explorerUrl }: { status: Status; explorerUrl: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3">
        {status.kind === "working" ? (
          <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-gold" />
        ) : status.kind === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-moss" />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 text-stone" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-parchment">Status</p>
          <p className="mt-1 break-words text-sm leading-5 text-stone">{status.message}</p>
          {status.txHash && (
            <a
              href={`${explorerUrl}/tx/${status.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-gold"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Sparkles; children: ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-obsidian/70 p-5">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-5 w-5 text-gold" />
        <h2 className="text-2xl font-black text-parchment">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Network; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <Icon className="mb-3 h-5 w-5 text-gold" />
      <p className="text-xs uppercase text-stone">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-parchment">{value}</p>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-stone">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-3 text-sm text-parchment outline-none focus:border-gold"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-stone">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-32 w-full rounded-md border border-white/10 bg-black/25 px-3 py-3 text-sm text-parchment outline-none focus:border-gold"
      />
    </label>
  );
}

function ActionButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-bold text-obsidian disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-3 last:border-b-0">
      <p className="text-xs uppercase text-stone">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-parchment">{value}</p>
    </div>
  );
}

function OutputCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase text-stone">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-parchment">{value}</p>
    </div>
  );
}

function IntegrationList({ integration }: { integration: RuntimeIntegration | null }) {
  if (!integration) {
    return (
      <p className="text-xs leading-5 text-stone">
        Deploy the runtime to verify Telegram, Discord, and WeatherXM bindings.
      </p>
    );
  }

  const items = [
    `Telegram token: ${integration.telegramConfigured ? "configured" : "missing"}`,
    `Telegram target chat: ${integration.telegramChatBound ? "bound" : "not bound"}`,
    `Discord token/app: ${integration.discordConfigured ? "configured" : "missing"}`,
    `Discord guild: ${integration.discordGuildBound ? "bound" : "not bound"}`,
    `Discord channel: ${integration.discordChannelBound ? "bound" : "not bound"}`,
    `WeatherXM API: ${integration.depinBaseUrl}`,
  ];

  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase text-stone">Integration status</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm text-parchment">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
