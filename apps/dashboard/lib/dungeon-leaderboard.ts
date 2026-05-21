import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

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

interface DungeonLeaderboardSession {
  xp: number;
  completed: boolean;
  bossDefeated: boolean;
}

interface StoredDungeonLeaderboardEntry extends DungeonLeaderboardEntry {
  sessions: Record<string, DungeonLeaderboardSession>;
}

interface DungeonLeaderboardStore {
  updatedAt: number;
  entries: Record<string, StoredDungeonLeaderboardEntry>;
}

export interface DungeonProgressUpdate {
  tokenId: string;
  sessionId: string;
  clanTitle: string;
  playerAddress: string;
  xp: number;
  level: number;
  completed: boolean;
  bossDefeated: boolean;
}

function leaderboardFilePath() {
  const cwd = process.cwd();
  const inDashboardApp = cwd.endsWith(`${sep}apps${sep}dashboard`);
  return inDashboardApp
    ? join(cwd, "data", "dungeon-leaderboard.json")
    : join(cwd, "apps", "dashboard", "data", "dungeon-leaderboard.json");
}

function createEmptyStore(): DungeonLeaderboardStore {
  return { updatedAt: Date.now(), entries: {} };
}

async function readStore() {
  try {
    const raw = await readFile(leaderboardFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<DungeonLeaderboardStore>;
    return {
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries as Record<string, StoredDungeonLeaderboardEntry> : {},
    };
  } catch {
    return createEmptyStore();
  }
}

async function writeStore(store: DungeonLeaderboardStore) {
  const filePath = leaderboardFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

function normalizeEntry(tokenId: string, partial?: Partial<StoredDungeonLeaderboardEntry>): StoredDungeonLeaderboardEntry {
  return {
    tokenId,
    clanTitle: partial?.clanTitle || `Clan #${tokenId}`,
    totalXpEarned: partial?.totalXpEarned ?? 0,
    highestRunXp: partial?.highestRunXp ?? 0,
    lastRunXp: partial?.lastRunXp ?? 0,
    currentLevel: partial?.currentLevel ?? 1,
    totalRuns: partial?.totalRuns ?? 0,
    completedRuns: partial?.completedRuns ?? 0,
    bossKills: partial?.bossKills ?? 0,
    lastPlayerAddress: partial?.lastPlayerAddress ?? "",
    updatedAt: partial?.updatedAt ?? Date.now(),
    sessions: partial?.sessions ?? {},
  };
}

function toPublicEntry(entry: StoredDungeonLeaderboardEntry): DungeonLeaderboardEntry {
  const { sessions: _sessions, ...publicEntry } = entry;
  return publicEntry;
}

function sortEntries(entries: DungeonLeaderboardEntry[]) {
  return entries.sort((a, b) => {
    if (b.totalXpEarned !== a.totalXpEarned) return b.totalXpEarned - a.totalXpEarned;
    if (b.highestRunXp !== a.highestRunXp) return b.highestRunXp - a.highestRunXp;
    return b.updatedAt - a.updatedAt;
  });
}

export async function updateDungeonLeaderboard(progress: DungeonProgressUpdate) {
  const store = await readStore();
  const existing = normalizeEntry(progress.tokenId, store.entries[progress.tokenId]);
  const previousSession = existing.sessions[progress.sessionId];

  const earnedDelta = Math.max(0, progress.xp - (previousSession?.xp ?? 0));
  const isNewSession = !previousSession;
  const justCompleted = progress.completed && !previousSession?.completed;
  const justBeatBoss = progress.bossDefeated && !previousSession?.bossDefeated;

  const nextEntry: StoredDungeonLeaderboardEntry = {
    ...existing,
    clanTitle: progress.clanTitle || existing.clanTitle,
    totalXpEarned: existing.totalXpEarned + earnedDelta,
    highestRunXp: Math.max(existing.highestRunXp, progress.xp),
    lastRunXp: progress.xp,
    currentLevel: Math.max(existing.currentLevel, progress.level),
    totalRuns: existing.totalRuns + (isNewSession ? 1 : 0),
    completedRuns: existing.completedRuns + (justCompleted ? 1 : 0),
    bossKills: existing.bossKills + (justBeatBoss ? 1 : 0),
    lastPlayerAddress: progress.playerAddress,
    updatedAt: Date.now(),
    sessions: {
      ...existing.sessions,
      [progress.sessionId]: {
        xp: progress.xp,
        completed: progress.completed,
        bossDefeated: progress.bossDefeated,
      },
    },
  };

  store.entries[progress.tokenId] = nextEntry;
  store.updatedAt = Date.now();
  await writeStore(store);

  return {
    entry: toPublicEntry(nextEntry),
    leaderboard: sortEntries(Object.values(store.entries).map(toPublicEntry)),
    updatedAt: store.updatedAt,
  };
}

export async function getDungeonLeaderboard() {
  const store = await readStore();
  return {
    entries: sortEntries(Object.values(store.entries).map(toPublicEntry)),
    updatedAt: store.updatedAt,
  };
}
