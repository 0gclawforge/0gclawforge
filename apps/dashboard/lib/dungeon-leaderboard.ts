import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ethers } from "ethers";
import { downloadFromStorage } from "@0gclawforge/sdk";
import type { StorageConfig } from "@0gclawforge/sdk";
import { getAgentInftAddress, getOgRpcUrl, getOgStorageIndexer } from "./contract-addresses";

export interface DungeonLeaderboardEntry {
  tokenId: string;
  clanTitle: string;
  totalXpEarned: number;
  highestRunXp: number;
  lastRunXp: number;
  currentLevel: number;
  totalRuns: number;
  completedRuns: number;
  bossKills: number;
  lastPlayerAddress: string;
  updatedAt: number;
}

interface AnchoredDungeonSession {
  tokenId: string;
  sessionId: string;
  clanTitle: string;
  playerAddress: string;
  xp: number;
  level: number;
  completed: boolean;
  bossDefeated: boolean;
  blockNumber: number;
  logIndex: number;
  updatedAt: number;
}

interface RealmProgressRecord {
  kind?: string;
  payload?: Partial<AnchoredDungeonSession> & {
    tokenId?: string;
  };
}

export interface DungeonLeaderboardResponse {
  entries: DungeonLeaderboardEntry[];
  updatedAt: number;
  chainId: number;
  source: "on-chain";
  scannedFromBlock: number;
  scannedToBlock: number;
}

const METADATA_EVENT = "event AgentMetadataUpdated(uint256 indexed tokenId, bytes32 newHash, string newStorageURI)";
const LOG_CHUNK_SIZE = 25_000;
const DEFAULT_LOOKBACK_BLOCKS = 250_000;
const CACHE_TTL_MS = 30_000;
const leaderboardCache = new Map<number, { expiresAt: number; value: DungeonLeaderboardResponse }>();

function normalizeChainId(chainId?: number) {
  return chainId === 16661 ? 16661 : 16602;
}

function storageConfig(chainId: number): StorageConfig {
  return {
    rpcUrl: getOgRpcUrl(chainId),
    indexerUrl: getOgStorageIndexer(chainId),
  };
}

function configuredLeaderboardBlock(chainId: number, latestBlock: number) {
  const raw =
    chainId === 16661
      ? process.env.OG_LEADERBOARD_FROM_BLOCK_MAINNET
      : process.env.OG_LEADERBOARD_FROM_BLOCK_GALILEO;
  const configured = Number(raw);
  if (Number.isSafeInteger(configured) && configured >= 0) {
    return Math.min(configured, latestBlock);
  }

  const lookback = Number(process.env.OG_LEADERBOARD_LOOKBACK_BLOCKS);
  const boundedLookback =
    Number.isSafeInteger(lookback) && lookback > 0 ? lookback : DEFAULT_LOOKBACK_BLOCKS;
  return Math.max(0, latestBlock - boundedLookback);
}

function safeScore(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

async function downloadProgressRecord(rootHash: string, chainId: number) {
  const outputPath = join(
    tmpdir(),
    `0gclawforge-tournament-${chainId}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );

  try {
    await downloadFromStorage(rootHash, outputPath, storageConfig(chainId));
    return JSON.parse(await readFile(outputPath, "utf8")) as RealmProgressRecord;
  } finally {
    await rm(outputPath, { force: true });
  }
}

async function scanMetadataLogs(provider: ethers.JsonRpcProvider, address: string, fromBlock: number, toBlock: number) {
  const iface = new ethers.Interface([METADATA_EVENT]);
  const event = iface.getEvent("AgentMetadataUpdated");
  if (!event) throw new Error("AgentMetadataUpdated event ABI is unavailable");

  const logs: ethers.Log[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(toBlock, start + LOG_CHUNK_SIZE - 1);
    logs.push(
      ...(await provider.getLogs({
        address,
        fromBlock: start,
        toBlock: end,
        topics: [event.topicHash],
      }))
    );
  }

  return { iface, logs };
}

function sortEntries(entries: DungeonLeaderboardEntry[]) {
  return entries.sort((a, b) => {
    if (b.totalXpEarned !== a.totalXpEarned) return b.totalXpEarned - a.totalXpEarned;
    if (b.highestRunXp !== a.highestRunXp) return b.highestRunXp - a.highestRunXp;
    if (b.completedRuns !== a.completedRuns) return b.completedRuns - a.completedRuns;
    if (b.bossKills !== a.bossKills) return b.bossKills - a.bossKills;
    return BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : 1;
  });
}

function aggregateSessions(sessions: AnchoredDungeonSession[]) {
  const byToken = new Map<string, DungeonLeaderboardEntry>();

  for (const session of sessions) {
    const entry = byToken.get(session.tokenId) ?? {
      tokenId: session.tokenId,
      clanTitle: session.clanTitle || `Clan #${session.tokenId}`,
      totalXpEarned: 0,
      highestRunXp: 0,
      lastRunXp: 0,
      currentLevel: 1,
      totalRuns: 0,
      completedRuns: 0,
      bossKills: 0,
      lastPlayerAddress: "",
      updatedAt: 0,
    };

    entry.clanTitle = session.clanTitle || entry.clanTitle;
    entry.totalXpEarned += session.xp;
    entry.highestRunXp = Math.max(entry.highestRunXp, session.xp);
    entry.lastRunXp = session.xp;
    entry.currentLevel = Math.max(entry.currentLevel, session.level);
    entry.totalRuns += 1;
    entry.completedRuns += session.completed ? 1 : 0;
    entry.bossKills += session.bossDefeated ? 1 : 0;
    entry.lastPlayerAddress = session.playerAddress;
    entry.updatedAt = Math.max(entry.updatedAt, session.updatedAt);
    byToken.set(session.tokenId, entry);
  }

  return sortEntries([...byToken.values()]);
}

export async function getDungeonLeaderboard(requestedChainId?: number, options?: { fresh?: boolean }) {
  const chainId = normalizeChainId(requestedChainId);
  const cached = leaderboardCache.get(chainId);
  if (!options?.fresh && cached && cached.expiresAt > Date.now()) return cached.value;

  const provider = new ethers.JsonRpcProvider(getOgRpcUrl(chainId));
  const address = getAgentInftAddress(chainId);
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = configuredLeaderboardBlock(chainId, latestBlock);
  const { iface, logs } = await scanMetadataLogs(provider, address, fromBlock, latestBlock);
  const blockTimestamps = new Map<number, number>();
  const sessions = new Map<string, AnchoredDungeonSession>();

  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log);
      const tokenId = String(parsed?.args.tokenId ?? "");
      const storageURI = String(parsed?.args.newStorageURI ?? "");
      if (!tokenId || !storageURI) continue;

      const record = await downloadProgressRecord(storageURI, chainId);
      const progress = record.payload;
      if (record.kind !== "realm-progress" || !progress?.completed || !progress.bossDefeated) continue;
      if (String(progress.tokenId ?? tokenId) !== tokenId || !progress.sessionId) continue;

      let updatedAt = blockTimestamps.get(log.blockNumber);
      if (!updatedAt) {
        const block = await provider.getBlock(log.blockNumber);
        updatedAt = Number(block?.timestamp ?? 0) * 1_000;
        blockTimestamps.set(log.blockNumber, updatedAt);
      }

      const session: AnchoredDungeonSession = {
        tokenId,
        sessionId: String(progress.sessionId),
        clanTitle: String(progress.clanTitle || `Clan #${tokenId}`),
        playerAddress: String(progress.playerAddress || ""),
        xp: safeScore(progress.xp),
        level: Math.max(1, safeScore(progress.level)),
        completed: true,
        bossDefeated: true,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        updatedAt,
      };
      const key = `${tokenId}:${session.sessionId}`;
      const previous = sessions.get(key);
      if (!previous || previous.blockNumber < session.blockNumber || previous.logIndex < session.logIndex) {
        sessions.set(key, session);
      }
    } catch {
      // Ignore unrelated metadata roots and storage records that are not tournament completions.
    }
  }

  const value: DungeonLeaderboardResponse = {
    entries: aggregateSessions([...sessions.values()]),
    updatedAt: Date.now(),
    chainId,
    source: "on-chain",
    scannedFromBlock: fromBlock,
    scannedToBlock: latestBlock,
  };
  leaderboardCache.set(chainId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
