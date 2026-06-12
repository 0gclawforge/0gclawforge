"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Coins,
  Crown,
  DoorOpen,
  Flame,
  Heart,
  MessageSquare,
  Loader2,
  Package,
  Play,
  Save,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { keccak256, toUtf8Bytes } from "ethers";
import { useSearchParams } from "next/navigation";
import { type Address, type Hex } from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { agentInftAbi } from "@0gclawforge/sdk/inft";
import { getAgentInftAddress } from "../../../lib/contract-addresses";
import type {
  BiomeTheme,
  ClanState,
  EncounterModal,
  GameState,
  LeaderboardEntry,
  LeaderboardResponse,
  RealmApiResponse,
  RealmAsset,
  RealmPayload,
  RealmTrialQuestion,
  RealmRecord,
  RealmVersionSummary,
  SaveProgressPayload,
  Tile,
} from "./types";

const MAP_SIZE = 16;
const PLAYER_SPAWN = { x: 8, y: 14 };
const EMPTY_TILE: Tile = { type: "floor", icon: "", passable: true };
const AUTONOMOUS_MODEL_NAME = "0GM-1.0-35B-A3B";
const AUTO_WORLD_INTERVAL_MS = 2_000;
const AUTO_DIRECTIVE_INTERVAL_MS = 35_000;
const QUEST_DC = 15;
const BOSS_HIT_DC = 11;
const MOVE_HAZARD_CHANCE = 0.18;
const PRISM_MEMORIES_REQUIRED = 3;
const MEMORY_SEAL_COUNT = 3;
const AUTOSAVE_MOVE_INTERVAL = 8;
const DRAGON_FIRE_WARNING_MS = 1_350;
const DRAGON_FIRE_DURATION_MS = 2_400;

type DragonFirePhase = "warning" | "burning";

interface DragonFireTile {
  x: number;
  y: number;
  phase: DragonFirePhase;
}

type GameSoundCue = "move" | "collect" | "quest" | "hit" | "fire" | "victory" | "save";

function playAudioTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  delay = 0,
  type: OscillatorType = "sine",
  volume = 0.025
) {
  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

function playGameSound(context: AudioContext, cue: GameSoundCue) {
  if (cue === "move") playAudioTone(context, 170, 0.08, 0, "triangle", 0.012);
  if (cue === "collect") {
    playAudioTone(context, 520, 0.16, 0, "sine", 0.025);
    playAudioTone(context, 780, 0.2, 0.1, "sine", 0.022);
  }
  if (cue === "quest") {
    playAudioTone(context, 392, 0.18, 0, "triangle", 0.024);
    playAudioTone(context, 587, 0.24, 0.14, "triangle", 0.022);
  }
  if (cue === "hit") playAudioTone(context, 96, 0.22, 0, "sawtooth", 0.036);
  if (cue === "fire") {
    playAudioTone(context, 82, 0.62, 0, "sawtooth", 0.035);
    playAudioTone(context, 126, 0.56, 0.08, "square", 0.018);
  }
  if (cue === "victory") {
    playAudioTone(context, 392, 0.28, 0, "triangle", 0.028);
    playAudioTone(context, 523, 0.28, 0.18, "triangle", 0.028);
    playAudioTone(context, 784, 0.42, 0.36, "triangle", 0.026);
  }
  if (cue === "save") {
    playAudioTone(context, 330, 0.16, 0, "sine", 0.018);
    playAudioTone(context, 440, 0.18, 0.12, "sine", 0.018);
  }
}

function createRunSessionId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const themes: Record<BiomeTheme["id"], BiomeTheme> = {
  forest: {
    id: "forest",
    name: "Forest",
    floorClass: "bg-moss/5",
    wallClass: "bg-stone/30 border-white/5",
    wallIcon: "🌲",
    decorationIcons: ["🌿", "🍄", "✦"],
    npcIcon: "🧙",
    bossName: "Canopy Wyrm",
  },
  desert: {
    id: "desert",
    name: "Desert",
    floorClass: "bg-gold/5",
    wallClass: "bg-stone/30 border-gold/10",
    wallIcon: "🌵",
    decorationIcons: ["✧", "◇", "🌿"],
    npcIcon: "👤",
    bossName: "Glass Dune Dragon",
  },
  cave: {
    id: "cave",
    name: "Dungeon",
    floorClass: "bg-white/[0.02]",
    wallClass: "bg-stone/30 border-white/5",
    wallIcon: "🪨",
    decorationIcons: ["🕯️", "✦", "◇"],
    npcIcon: "🧙",
    bossName: "Ember Vault Drake",
  },
  neon: {
    id: "neon",
    name: "Neon District",
    floorClass: "bg-cyan-500/5",
    wallClass: "bg-slate-950/70 border-cyan-400/30",
    wallIcon: "▥",
    decorationIcons: ["⬢", "✦", "◉", "▣"],
    npcIcon: "◈",
    bossName: "Chrome Tyrant",
  },
  citadel: {
    id: "citadel",
    name: "Citadel",
    floorClass: "bg-amber-50/[0.04]",
    wallClass: "bg-stone-900/60 border-amber-100/10",
    wallIcon: "▦",
    decorationIcons: ["⚜", "✦", "▣", "◈"],
    npcIcon: "♜",
    bossName: "Throne Warden",
  },
  underwater: {
    id: "underwater",
    name: "Sunken Reef",
    floorClass: "bg-cyan-950/20",
    wallClass: "bg-cyan-950/50 border-cyan-300/15",
    wallIcon: "🪸",
    decorationIcons: ["🐚", "🌊", "✦"],
    npcIcon: "🧜",
    bossName: "Abyssal Tide Wyrm",
  },
  volcanic: {
    id: "volcanic",
    name: "Volcanic Rift",
    floorClass: "bg-ember/10",
    wallClass: "bg-stone-950/70 border-ember/20",
    wallIcon: "🌋",
    decorationIcons: ["🔥", "◆", "✦"],
    npcIcon: "🧙",
    bossName: "Magma Crown Drake",
  },
  default: {
    id: "default",
    name: "Wild Realm",
    floorClass: "bg-moss/5",
    wallClass: "bg-stone/30 border-white/5",
    wallIcon: "🌲",
    decorationIcons: ["🌿", "✦", "◇"],
    npcIcon: "👤",
    bossName: "Rootbound Dragon",
  },
};

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function selectTheme(realm: RealmPayload): BiomeTheme {
  const explicitThemeId = realm.visualTheme?.id;
  if (explicitThemeId && explicitThemeId in themes) return themes[explicitThemeId as keyof typeof themes];
  const biome = realm.assets.find((asset) => asset.type === "biome");
  const text = `${realm.title} ${realm.lore} ${biome?.name ?? ""} ${biome?.description ?? ""}`.toLowerCase();

  if (/(neon|cyber|punk|street|city|district|arcade)/.test(text)) return themes.neon;
  if (/(underwater|ocean|coral|reef|abyss|sunken|sea|tide)/.test(text)) return themes.underwater;
  if (/(volcanic|volcano|lava|magma|inferno|ash|crater)/.test(text)) return themes.volcanic;
  if (/(castle|citadel|fortress|cathedral|throne)/.test(text)) return themes.citadel;
  if (/(desert|dune|sand|oasis|cactus|sun)/.test(text)) return themes.desert;
  if (/(cave|dungeon|stone|crypt|vault|ember)/.test(text)) return themes.cave;
  if (/(forest|grove|moss|tree|root|moonlit|wood|wild)/.test(text)) return themes.forest;
  return themes.default;
}

function seedDangerZones(grid: Tile[][], realm: RealmPayload, spawn: { x: number; y: number }) {
  const nextGrid = cloneGrid(grid);
  const existing = findTilePositions(nextGrid, (tile) => tile.type === "danger").length;
  const candidates = findTilePositions(
    nextGrid,
    (tile, x, y) => (tile.type === "floor" || tile.type === "decoration") && tileDistance({ x, y }, spawn) > 3
  );
  const random = mulberry32(hashSeed(`${realm.tokenId}:${realm.title}:danger-zones`));

  for (let index = existing; index < 5 && candidates.length > 0; index++) {
    const candidateIndex = Math.floor(random() * candidates.length);
    const [candidate] = candidates.splice(candidateIndex, 1);
    if (candidate) nextGrid[candidate.y][candidate.x] = { type: "danger", icon: "\u26A0", passable: true };
  }

  return nextGrid;
}

function generateMap(realm: RealmPayload) {
  const theme = selectTheme(realm);
  const random = mulberry32(hashSeed(`${realm.tokenId}:${realm.title}:${realm.lore}`));
  const assetByName = new Map(realm.assets.map((asset) => [asset.name, asset]));
  const layout = realm.layout ?? {
    style: "grove" as const,
    wallDensity: 0.08,
    landmarkIcons: theme.decorationIcons,
    bossIcon: "🐉",
  };
  if (realm.map?.tiles?.length) {
    const explicitGrid = realm.map.tiles.map((row) =>
      row.map((cell) => ({
        type: cell.type,
        icon:
          cell.type === "npc" ? theme.npcIcon
            : cell.type === "quest" ? "⭐"
            : cell.type === "artifact" ? "💎"
            : cell.type === "boss" ? layout.bossIcon || "🐉"
            : cell.type === "decoration" ? cell.motif || theme.decorationIcons[0] || "✦"
            : cell.type === "danger" ? "\u26A0"
            : cell.type === "exit" ? "🚪"
            : cell.type === "wall" ? theme.wallIcon
            : "",
        passable: cell.type !== "wall",
        asset: cell.assetName ? assetByName.get(cell.assetName) : undefined,
      }))
    );

    return {
      grid: seedDangerZones(explicitGrid, realm, realm.map.spawn ?? PLAYER_SPAWN),
      theme,
      spawn: realm.map.spawn ?? PLAYER_SPAWN,
    };
  }
  const grid: Tile[][] = Array.from({ length: MAP_SIZE }, () =>
    Array.from({ length: MAP_SIZE }, () => ({ ...EMPTY_TILE }))
  );

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) {
        grid[y][x] = { type: "wall", icon: theme.wallIcon, passable: false };
      }
    }
  }

  const isFree = (x: number, y: number) =>
    x > 0 &&
    y > 0 &&
    x < MAP_SIZE - 1 &&
    y < MAP_SIZE - 1 &&
    !(x === PLAYER_SPAWN.x && y === PLAYER_SPAWN.y) &&
    grid[y][x].type === "floor";

  const randomInterior = () => {
    for (let attempt = 0; attempt < 120; attempt++) {
      const x = 1 + Math.floor(random() * (MAP_SIZE - 2));
      const y = 1 + Math.floor(random() * (MAP_SIZE - 2));
      if (isFree(x, y)) return { x, y };
    }
    for (let y = 1; y < MAP_SIZE - 1; y++) {
      for (let x = 1; x < MAP_SIZE - 1; x++) {
        if (isFree(x, y)) return { x, y };
      }
    }
    return { x: 1, y: 1 };
  };

  const bossX = Math.min(MAP_SIZE - 2, Math.max(1, Math.floor(MAP_SIZE / 2)));
  grid[2][bossX] = { type: "boss", icon: layout.bossIcon || "🐉", passable: true };

  const carveBarrier = (x: number, y: number) => {
    if (x <= 0 || y <= 0 || x >= MAP_SIZE - 1 || y >= MAP_SIZE - 1) return;
    if ((x === PLAYER_SPAWN.x && y === PLAYER_SPAWN.y) || (x === bossX && y === 2)) return;
    grid[y][x] = { type: "wall", icon: theme.wallIcon, passable: false };
  };

  if (layout.style === "labyrinth") {
    for (let x = 3; x < MAP_SIZE - 3; x += 3) {
      const gapY = 2 + Math.floor(random() * (MAP_SIZE - 4));
      for (let y = 1; y < MAP_SIZE - 1; y++) {
        if (y !== gapY) carveBarrier(x, y);
      }
    }
  } else if (layout.style === "corridor") {
    for (let y = 3; y < MAP_SIZE - 3; y += 3) {
      const gapX = 1 + Math.floor(random() * (MAP_SIZE - 2));
      for (let x = 1; x < MAP_SIZE - 1; x++) {
        if (Math.abs(x - gapX) > 1) carveBarrier(x, y);
      }
    }
  } else if (layout.style === "sanctum") {
    for (let x = bossX - 2; x <= bossX + 2; x++) {
      carveBarrier(x, 4);
    }
    carveBarrier(bossX - 2, 3);
    carveBarrier(bossX + 2, 3);
  } else {
    const targetWalls = Math.floor((MAP_SIZE - 2) * (MAP_SIZE - 2) * layout.wallDensity);
    let placedWalls = 0;
    while (placedWalls < targetWalls) {
      const x = 1 + Math.floor(random() * (MAP_SIZE - 2));
      const y = 1 + Math.floor(random() * (MAP_SIZE - 2));
      if (grid[y][x].type === "floor" && Math.abs(x - PLAYER_SPAWN.x) + Math.abs(y - PLAYER_SPAWN.y) > 3) {
        carveBarrier(x, y);
        placedWalls += 1;
      }
    }
  }

  for (const asset of realm.assets.filter((item) => item.type === "npc")) {
    const pos = randomInterior();
    grid[pos.y][pos.x] = { type: "npc", icon: theme.npcIcon, passable: true, asset };
  }

  for (const asset of realm.assets.filter((item) => item.type === "quest")) {
    const pos = randomInterior();
    grid[pos.y][pos.x] = { type: "quest", icon: "⭐", passable: true, asset };
  }

  for (const asset of realm.assets.filter((item) => item.type === "artifact")) {
    const pos = randomInterior();
    grid[pos.y][pos.x] = { type: "artifact", icon: "💎", passable: true, asset };
  }

  const decorationChance = 0.05 + random() * 0.05;
  for (let y = 1; y < MAP_SIZE - 1; y++) {
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      if (grid[y][x].type === "floor" && !(x === PLAYER_SPAWN.x && y === PLAYER_SPAWN.y) && random() < decorationChance) {
        const decorationPool = layout.landmarkIcons.length > 0 ? layout.landmarkIcons : theme.decorationIcons;
        const icon = decorationPool[Math.floor(random() * decorationPool.length)];
        grid[y][x] = { type: "decoration", icon, passable: true };
      }
    }
  }

  return { grid: seedDangerZones(grid, realm, PLAYER_SPAWN), theme, spawn: PLAYER_SPAWN };
}

function bossMaxHp(realm: RealmPayload | null) {
  return 52 + (realm?.assets.length ?? 0) * 10;
}

function appendLog(current: string[], next: string | string[]) {
  return [...current, ...(Array.isArray(next) ? next : [next])].slice(-20);
}

function applyRewards(state: GameState, xp: number, gold: number, logs: string[]) {
  const nextXp = state.xp + xp;
  const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
  const leveled = nextLevel > state.level ? [`You advanced to level ${nextLevel}.`] : [];

  return {
    ...state,
    xp: nextXp,
    gold: state.gold + gold,
    level: nextLevel,
    gameLog: appendLog(state.gameLog, [...logs, ...leveled]),
  };
}

function initialGameState(realm: RealmPayload): GameState {
  const spawn = realm.map?.spawn ?? PLAYER_SPAWN;
  return {
    sessionId: createRunSessionId(),
    playerPos: spawn,
    hp: 84,
    maxHp: 84,
    gold: 0,
    xp: 0,
    level: 1,
    inventory: [],
    prismMemories: [],
    answeredNpcTrials: [],
    memorySealsBroken: 0,
    questsCompleted: [],
    npcsSpoken: [],
    bossDefeated: false,
    gameLog: appendLog([], [
      `You entered ${realm.title}.`,
      "WASD or arrow keys move one tile at a time.",
      `This realm is brutal: quests resist at DC ${QUEST_DC}, wandering can draw blood, and the boss demands a roll of ${BOSS_HIT_DC}+ to land a hit.`,
      `The boss is sealed behind ${MEMORY_SEAL_COUNT} Memory Seals. Gather at least ${PRISM_MEMORIES_REQUIRED} Prism Memories by learning the realm.`,
    ]),
  };
}

function realmSpawn(realm: RealmPayload | null) {
  return realm?.map?.spawn ?? PLAYER_SPAWN;
}

function normalizeClanState(raw: unknown): ClanState | null {
  if (!raw) return null;
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

function unwrapRealm(record: RealmRecord | { payload?: RealmPayload; createdAt?: number }): RealmRecord {
  if (record.payload?.title && Array.isArray(record.payload.assets)) {
    return {
      kind: "ugc-realm",
      payload: record.payload,
      createdAt: record.createdAt ?? Date.now(),
    };
  }

  throw new Error("Storage record is not a valid ugc-realm payload");
}

function updateTile(grid: Tile[][], x: number, y: number, tile: Tile) {
  return grid.map((row, rowIndex) => row.map((cell, colIndex) => (rowIndex === y && colIndex === x ? tile : cell)));
}

function placeExit(grid: Tile[][]) {
  const exit = { type: "exit", icon: "🚪", passable: true } satisfies Tile;
  if (grid[1][8].type === "floor" || grid[1][8].type === "decoration") return updateTile(grid, 8, 1, exit);
  return updateTile(grid, 7, 1, exit);
}

function cloneGrid(grid: Tile[][]) {
  return grid.map((row) => row.map((tile) => ({ ...tile })));
}

function findTilePositions(grid: Tile[][], predicate: (tile: Tile, x: number, y: number) => boolean) {
  const positions: Array<{ x: number; y: number; tile: Tile }> = [];
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      const tile = grid[y][x];
      if (predicate(tile, x, y)) positions.push({ x, y, tile });
    }
  }
  return positions;
}

function pickOne<T>(items: T[]) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function canAutonomyOccupy(tile: Tile) {
  return tile.type === "floor" || tile.type === "decoration";
}

function tileDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function dragonFirePattern(grid: Tile[][], playerPos: { x: number; y: number }, pulse: number) {
  const boss = findTilePositions(grid, (tile) => tile.type === "boss")[0] ?? { x: 8, y: 2 };
  const positions: Array<{ x: number; y: number }> = [];
  const push = (x: number, y: number) => {
    const tile = grid[y]?.[x];
    if (x > 0 && x < MAP_SIZE - 1 && y > 0 && y < MAP_SIZE - 1 && tile?.passable && tile.type !== "boss") {
      positions.push({ x, y });
    }
  };

  if (pulse % 3 === 0) {
    const horizontal = Math.abs(playerPos.x - boss.x) > Math.abs(playerPos.y - boss.y);
    const direction = horizontal
      ? { x: playerPos.x >= boss.x ? 1 : -1, y: 0 }
      : { x: 0, y: playerPos.y >= boss.y ? 1 : -1 };
    for (let step = 1; step <= 8; step++) push(boss.x + direction.x * step, boss.y + direction.y * step);
  } else if (pulse % 3 === 1) {
    for (let depth = 1; depth <= 6; depth++) {
      const width = Math.min(3, Math.ceil(depth / 2));
      for (let offset = -width; offset <= width; offset++) push(boss.x + offset, boss.y + depth);
    }
  } else {
    for (let x = 1; x < MAP_SIZE - 1; x++) push(x, playerPos.y);
    for (let y = 1; y < MAP_SIZE - 1; y++) push(playerPos.x, y);
  }

  return positions.filter((position, index, all) =>
    all.findIndex((candidate) => candidate.x === position.x && candidate.y === position.y) === index
  );
}

function findAutonomousPlayerTarget(grid: Tile[][], state: GameState) {
  const remainingObjectives = findTilePositions(
    grid,
    (tile) =>
      (tile.type === "artifact" && !state.inventory.some((item) => item.name === tile.asset?.name)) ||
      (tile.type === "quest" && !state.questsCompleted.includes(tile.asset?.name ?? "")) ||
      (tile.type === "npc" && !state.npcsSpoken.includes(tile.asset?.name ?? ""))
  );

  const priorities = state.bossDefeated
    ? ["exit"]
    : remainingObjectives.length > 0
      ? ["artifact", "quest", "npc"]
      : ["boss"];

  for (const type of priorities) {
    const candidates = findTilePositions(grid, (tile) => {
      if (tile.type !== type) return false;
      if (tile.type === "artifact") return !state.inventory.some((item) => item.name === tile.asset?.name);
      if (tile.type === "quest") return !state.questsCompleted.includes(tile.asset?.name ?? "");
      if (tile.type === "npc") return !state.npcsSpoken.includes(tile.asset?.name ?? "");
      return true;
    }).sort((a, b) => tileDistance(state.playerPos, a) - tileDistance(state.playerPos, b));

    if (candidates[0]) return candidates[0];
  }

  const fallback = findTilePositions(grid, (tile) => tile.type === "npc" || tile.type === "decoration").sort(
    (a, b) => tileDistance(state.playerPos, a) - tileDistance(state.playerPos, b)
  )[0];

  if (fallback) return fallback;
  return null;
}

function findAutonomousStep(grid: Tile[][], from: { x: number; y: number }, to: { x: number; y: number }) {
  if (from.x === to.x && from.y === to.y) return from;

  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const key = (pos: { x: number; y: number }) => `${pos.x},${pos.y}`;
  const queue = [from];
  const visited = new Set([key(from)]);
  const parent = new Map<string, { x: number; y: number }>();

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const tile = grid[next.y]?.[next.x];
      if (!tile || !tile.passable || visited.has(key(next))) continue;

      visited.add(key(next));
      parent.set(key(next), current);
      if (next.x === to.x && next.y === to.y) {
        let cursor = next;
        while (true) {
          const previous = parent.get(key(cursor));
          if (!previous || (previous.x === from.x && previous.y === from.y)) return cursor;
          cursor = previous;
        }
      }
      queue.push(next);
    }
  }

  return null;
}

function findAutonomousWanderStep(grid: Tile[][], from: { x: number; y: number }, tick: number) {
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const ordered = directions.slice(tick % directions.length).concat(directions.slice(0, tick % directions.length));
  return ordered
    .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
    .find((position) => Boolean(grid[position.y]?.[position.x]?.passable));
}

function describeAutoTarget(tile: Tile, theme: BiomeTheme) {
  if (tile.asset?.name) return tile.asset.name;
  if (tile.type === "boss") return theme.bossName;
  if (tile.type === "exit") return "the realm exit";
  if (tile.type === "npc") return "a realm NPC";
  return "the next open tile";
}

function autonomousQuestAsset(realm: RealmPayload, theme: BiomeTheme, index: number): RealmAsset {
  const names = ["Signal Patrol", "Memory Relay", "Border Rite", "Artifact Census", "Warden Errand"];
  const name = `${theme.name} ${names[index % names.length]} ${index + 1}`;
  return {
    type: "quest",
    name,
    description: `${AUTONOMOUS_MODEL_NAME} issued a small live objective for ${realm.title}. Watch the clan complete it without taking over your player.`,
  };
}

function normalizeAnswerKey(value: string) {
  return value.trim().toLowerCase();
}

function shuffleOptions(options: string[], seed: number) {
  const next = options.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const swapIndex = (seed + i * 7) % (i + 1);
    [next[i], next[swapIndex]] = [next[swapIndex]!, next[i]!];
  }
  return next;
}

function buildOptions(correctAnswer: string, distractors: string[], seedSource: string) {
  const unique = [correctAnswer, ...distractors]
    .filter((option, index, values) => option && values.indexOf(option) === index)
    .slice(0, 4);
  return shuffleOptions(unique, hashSeed(seedSource));
}

function prismMemoryItem(source: string, rewardLabel: string): { name: string; description: string; type: string } {
  return {
    name: `Prism Memory: ${rewardLabel}`,
    description: `A sealed memory shard won through ${source}. The boss can consume it to break a Memory Seal.`,
    type: "prism-memory",
  };
}

function buildNpcTrialQuestion(realm: RealmPayload, asset: RealmAsset): RealmTrialQuestion {
  const quests = realm.assets.filter((item) => item.type === "quest");
  const artifacts = realm.assets.filter((item) => item.type === "artifact");
  const npcs = realm.assets.filter((item) => item.type === "npc");
  const biome = realm.assets.find((item) => item.type === "biome");
  const seed = `${realm.tokenId}:${asset.name}`;
  const npcIndex = Math.max(0, npcs.findIndex((item) => item.name === asset.name));

  if (quests[npcIndex % Math.max(1, quests.length)]) {
    const correct = quests[npcIndex % Math.max(1, quests.length)]!;
    const distractors = [...artifacts, ...npcs.filter((item) => item.name !== asset.name)]
      .map((item) => item.name)
      .slice(0, 3);
    return {
      id: `npc-trial-${asset.name}`,
      prompt: `${asset.name} tests your memory: which quest is truly bound to ${realm.title}?`,
      options: buildOptions(correct.name, distractors, seed),
      correctAnswer: correct.name,
      loreHint: cleanRealmHint(realm.lore || correct.description || asset.description),
      rewardLabel: asset.name,
    };
  }

  const correctArtifact = artifacts[0] ?? biome ?? asset;
  const distractors = realm.assets
    .filter((item) => item.name !== correctArtifact.name)
    .map((item) => item.name)
    .slice(0, 3);

  return {
    id: `npc-trial-${asset.name}`,
    prompt: `${asset.name} asks which memory-anchor belongs in this realm's prism lattice.`,
    options: buildOptions(correctArtifact.name, distractors, seed),
    correctAnswer: correctArtifact.name,
    loreHint: cleanRealmHint(realm.lore || correctArtifact.description || asset.description),
    rewardLabel: asset.name,
  };
}

function buildBossSealQuestion(realm: RealmPayload, sealIndex: number): RealmTrialQuestion {
  const artifacts = realm.assets.filter((item) => item.type === "artifact");
  const quests = realm.assets.filter((item) => item.type === "quest");
  const npcs = realm.assets.filter((item) => item.type === "npc");
  const biome = realm.assets.find((item) => item.type === "biome");
  const candidates = [
    {
      prompt: `Seal ${sealIndex + 1}: which artifact holds the clearest memory trace in ${realm.title}?`,
      correctAnswer: (artifacts[sealIndex % Math.max(1, artifacts.length)] ?? biome ?? realm.assets[0])?.name ?? realm.title,
      loreHint: cleanRealmHint((artifacts[sealIndex % Math.max(1, artifacts.length)] ?? biome ?? realm.assets[0])?.description ?? realm.lore),
    },
    {
      prompt: `Seal ${sealIndex + 1}: which quest best matches the realm's active oath?`,
      correctAnswer: (quests[sealIndex % Math.max(1, quests.length)] ?? realm.assets[0])?.name ?? realm.title,
      loreHint: cleanRealmHint((quests[sealIndex % Math.max(1, quests.length)] ?? realm.assets[0])?.description ?? realm.lore),
    },
    {
      prompt: `Seal ${sealIndex + 1}: who among the realm's keepers would speak this memory aloud?`,
      correctAnswer: (npcs[sealIndex % Math.max(1, npcs.length)] ?? realm.assets[0])?.name ?? realm.title,
      loreHint: cleanRealmHint((npcs[sealIndex % Math.max(1, npcs.length)] ?? realm.assets[0])?.description ?? realm.lore),
    },
  ];
  const chosen = candidates[sealIndex % candidates.length]!;
  const distractors = realm.assets
    .map((item) => item.name)
    .filter((name) => name !== chosen.correctAnswer)
    .slice(0, 3);

  return {
    id: `boss-seal-${sealIndex}`,
    prompt: chosen.prompt,
    options: buildOptions(chosen.correctAnswer, distractors, `${realm.tokenId}:boss:${sealIndex}`),
    correctAnswer: chosen.correctAnswer,
    loreHint: chosen.loreHint,
    rewardLabel: `Seal ${sealIndex + 1}`,
  };
}

function cleanRealmHint(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 150);
}

export function GameEngine({ tokenId }: { tokenId: string }) {
  const searchParams = useSearchParams();
  const forcedSpectator = searchParams.get("spectator") === "1";
  const selectedRealmRoot = searchParams.get("realmRoot") || "";
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const contractAddress = useMemo(() => {
    return getAgentInftAddress(chainId) as Address;
  }, [chainId]);

  const tokenIdBig = useMemo(() => (/^\d+$/.test(tokenId) ? BigInt(tokenId) : undefined), [tokenId]);

  const { data: chainStateData, refetch: refetchClanState } = useReadContract({
    address: contractAddress,
    abi: agentInftAbi,
    functionName: "getClanState",
    args: tokenIdBig !== undefined ? [tokenIdBig] : undefined,
    query: { enabled: Boolean(contractAddress && tokenIdBig !== undefined) },
  });

  const { data: ownerAddress } = useReadContract({
    address: contractAddress,
    abi: agentInftAbi,
    functionName: "ownerOf",
    args: tokenIdBig !== undefined ? [tokenIdBig] : undefined,
    query: { enabled: Boolean(contractAddress && tokenIdBig !== undefined), retry: false },
  });

  const [realm, setRealm] = useState<RealmRecord | null>(null);
  const [realmHistory, setRealmHistory] = useState<RealmVersionSummary[]>([]);
  const [apiClanState, setApiClanState] = useState<ClanState | null>(null);
  const [grid, setGrid] = useState<Tile[][] | null>(null);
  const [theme, setTheme] = useState<BiomeTheme>(themes.default);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [modal, setModal] = useState<EncounterModal | null>(null);
  const [bossHp, setBossHp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [toast, setToast] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "clan"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const [autoPulse, setAutoPulse] = useState("Idle");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [dragonFireTiles, setDragonFireTiles] = useState<DragonFireTile[]>([]);
  const [movesSinceAutosave, setMovesSinceAutosave] = useState(0);
  const autoTickRef = useRef(0);
  const dragonFirePulseRef = useRef(0);
  const dragonFireTilesRef = useRef<DragonFireTile[]>([]);
  const dragonFireTimersRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const saveProgressRef = useRef<(markCompleted: boolean, options?: { quiet?: boolean }) => Promise<void>>(async () => undefined);
  const gridRef = useRef<Tile[][] | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const realmPayloadRef = useRef<RealmPayload | null>(null);
  const themeRef = useRef<BiomeTheme>(themes.default);
  const completedRef = useRef(false);
  const autoPulseRef = useRef("Idle");
  const bossHpRef = useRef(0);

  const clanState = normalizeClanState(chainStateData) ?? apiClanState;
  const realmPayload = realm?.payload ?? null;
  const maxBossHp = bossMaxHp(realmPayload);
  const isOwner = Boolean(
    address && ownerAddress && String(ownerAddress).toLowerCase() === address.toLowerCase()
  );
  const canPersist = isConnected && isOwner && !forcedSpectator;
  const tokenLeaderboardEntry = leaderboard.find((entry) => entry.tokenId === tokenId) ?? null;
  const xpProgressInLevel = gameState ? gameState.xp % 100 : 0;
  const xpToNextLevel = gameState ? (xpProgressInLevel === 0 ? 100 : 100 - xpProgressInLevel) : 100;
  const dragonFireByTile = useMemo(
    () => new Map(dragonFireTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.phase])),
    [dragonFireTiles]
  );

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    realmPayloadRef.current = realmPayload;
  }, [realmPayload]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    autoPulseRef.current = autoPulse;
  }, [autoPulse]);

  useEffect(() => {
    bossHpRef.current = bossHp;
  }, [bossHp]);

  useEffect(() => {
    dragonFireTilesRef.current = dragonFireTiles;
  }, [dragonFireTiles]);

  useEffect(() => {
    return () => {
      dragonFireTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRealm() {
      setLoading(true);
      setLoadError("");
      try {
        const realmQuery = selectedRealmRoot ? `&realmRoot=${encodeURIComponent(selectedRealmRoot)}` : "";
        const response = await fetch(`/api/realm/${tokenId}?chainId=${chainId}${realmQuery}`, { cache: "no-store" });
        const payload = (await response.json()) as RealmApiResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to load realm");
        if (cancelled) return;
        setRealm(unwrapRealm(payload.realm));
        setRealmHistory(payload.history ?? []);
        setApiClanState(payload.clanState);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load realm");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (/^\d+$/.test(tokenId)) {
      void loadRealm();
    } else {
      setLoadError("Token ID must be a positive integer.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [chainId, selectedRealmRoot, tokenId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      try {
        const response = await fetch(`/api/realm/leaderboard?chainId=${chainId}&mode=general`, { cache: "no-store" });
        const payload = (await response.json()) as LeaderboardResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to load leaderboard");
        if (!cancelled) {
          setLeaderboard(payload.entries ?? []);
          setLeaderboardStatus("");
        }
      } catch (error) {
        if (!cancelled) {
          setLeaderboardStatus(error instanceof Error ? error.message : "Failed to load leaderboard");
        }
      }
    }

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [chainId, tokenId]);

  useEffect(() => {
    if (!realmPayload) return;
    const generated = generateMap(realmPayload);
    setGrid(generated.grid);
    setTheme(generated.theme);
    setGameState({
      ...initialGameState(realmPayload),
      playerPos: generated.spawn,
    });
    setBossHp(bossMaxHp(realmPayload));
    setCompleted(false);
    setSaveStatus("");
    setDragonFireTiles([]);
    dragonFireTilesRef.current = [];
    dragonFireTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dragonFireTimersRef.current = [];
    setMovesSinceAutosave(0);
  }, [realmPayload]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addLog = useCallback((message: string | string[]) => {
    setGameState((state) => (state ? { ...state, gameLog: appendLog(state.gameLog, message) } : state));
  }, []);

  const playCue = useCallback((cue: GameSoundCue) => {
    const context = audioContextRef.current;
    if (!audioEnabled || !context) return;
    if (context.state === "suspended") void context.resume();
    playGameSound(context, cue);
  }, [audioEnabled]);

  const toggleAudio = useCallback(async () => {
    if (audioEnabled) {
      setAudioEnabled(false);
      return;
    }

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    setAudioEnabled(true);
    playGameSound(context, "quest");
  }, [audioEnabled]);

  useEffect(() => {
    if (!audioEnabled) return;
    let note = 0;
    const ambientNotes = [146.83, 196, 220, 174.61];
    const interval = window.setInterval(() => {
      const context = audioContextRef.current;
      if (!context || context.state !== "running") return;
      playAudioTone(context, ambientNotes[note % ambientNotes.length]!, 1.7, 0, "sine", 0.008);
      note += 1;
    }, 1_900);
    return () => window.clearInterval(interval);
  }, [audioEnabled]);

  const igniteDragonBreath = useCallback(() => {
    const currentGrid = gridRef.current;
    const currentState = gameStateRef.current;
    if (!currentGrid || !currentState || currentState.bossDefeated || dragonFireTilesRef.current.length > 0) return;

    dragonFirePulseRef.current += 1;
    const pattern = dragonFirePattern(currentGrid, currentState.playerPos, dragonFirePulseRef.current);
    if (pattern.length === 0) return;

    const warningTiles = pattern.map((tile) => ({ ...tile, phase: "warning" as const }));
    dragonFireTilesRef.current = warningTiles;
    setDragonFireTiles(warningTiles);
    addLog(`${themeRef.current.bossName} draws breath. Move before the marked tiles ignite.`);
    setToast("Dragon breath incoming. Move!");
    playCue("fire");

    const igniteTimer = window.setTimeout(() => {
      const burningTiles = pattern.map((tile) => ({ ...tile, phase: "burning" as const }));
      dragonFireTilesRef.current = burningTiles;
      setDragonFireTiles(burningTiles);

      const state = gameStateRef.current;
      if (!state || !pattern.some((tile) => tile.x === state.playerPos.x && tile.y === state.playerPos.y)) return;
      const damage = 8 + rollDie(6);
      playCue("hit");
      setGameState((current) => {
        if (!current) return current;
        const defeated = current.hp - damage <= 0;
        const nextState = {
          ...current,
          hp: defeated ? current.maxHp : current.hp - damage,
          gold: defeated ? Math.floor(current.gold / 2) : current.gold,
          playerPos: defeated ? realmSpawn(realmPayloadRef.current) : current.playerPos,
          gameLog: appendLog(
            current.gameLog,
            defeated
              ? `${themeRef.current.bossName}'s fire overwhelms you. You return to the realm gate with half your gold.`
              : `${themeRef.current.bossName}'s fire burns you for ${damage} damage.`
          ),
        };
        gameStateRef.current = nextState;
        return nextState;
      });
    }, DRAGON_FIRE_WARNING_MS);

    const clearTimer = window.setTimeout(() => {
      dragonFireTilesRef.current = [];
      setDragonFireTiles([]);
    }, DRAGON_FIRE_WARNING_MS + DRAGON_FIRE_DURATION_MS);

    dragonFireTimersRef.current.push(igniteTimer, clearTimer);
  }, [addLog, playCue]);

  useEffect(() => {
    if (!gameState || gameState.bossDefeated || modal) return;
    const firstBreath = window.setTimeout(igniteDragonBreath, 1_600);
    const interval = window.setInterval(igniteDragonBreath, 7_200);
    return () => {
      window.clearTimeout(firstBreath);
      window.clearInterval(interval);
    };
  }, [gameState?.bossDefeated, igniteDragonBreath, modal]);

  const pushAutoLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setAutoLog((prev) => [...prev.slice(-11), `[${timestamp}] ${message}`]);
    setAutoPulse(message);
  }, []);

  const replaceTile = useCallback((x: number, y: number, tile: Tile) => {
    setGrid((current) => (current ? updateTile(current, x, y, tile) : current));
  }, []);

  const collectArtifact = useCallback(
    (asset: RealmAsset, x: number, y: number) => {
      setGameState((state) => {
        if (!state || state.inventory.some((item) => item.name === asset.name)) return state;
        return applyRewards(
          {
            ...state,
            inventory: [...state.inventory, asset],
          },
          12,
          0,
          [`Collected artifact: ${asset.name}.`]
        );
      });
      replaceTile(x, y, { ...EMPTY_TILE });
      setToast(`${asset.name} added to inventory`);
      playCue("collect");
    },
    [playCue, replaceTile]
  );

  const triggerInteraction = useCallback(
    (tile: Tile, x: number, y: number) => {
      if (tile.type === "npc" && tile.asset) setModal({ type: "npc", asset: tile.asset });
      if (tile.type === "quest" && tile.asset) setModal({ type: "quest", asset: tile.asset });
      if (tile.type === "artifact" && tile.asset) collectArtifact(tile.asset, x, y);
      if (tile.type === "boss") {
        setModal({
          type: "boss",
          result: `Attack now, or gather Prism Memories from NPC trials to break the boss's ${MEMORY_SEAL_COUNT} armor seals and deal full damage.`,
        });
      }
      if (tile.type === "exit") setCompleted(true);
    },
    [collectArtifact]
  );

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      if (!grid || !gameState || completed || modal) return;
      const next = { x: gameState.playerPos.x + dx, y: gameState.playerPos.y + dy };
      const tile = grid[next.y]?.[next.x];
      if (!tile || !tile.passable) {
        addLog("A boundary of the realm blocks your path.");
        return;
      }

      const enteredDragonFire = dragonFireTilesRef.current.some(
        (fireTile) => fireTile.phase === "burning" && fireTile.x === next.x && fireTile.y === next.y
      );
      const enteredDangerZone = tile.type === "danger";
      const dangerRewarded = enteredDangerZone && Math.random() < 0.45;
      const dangerGold = dangerRewarded ? 18 + rollDie(18) : 0;
      const hazardTriggered =
        !enteredDragonFire &&
        !dangerRewarded &&
        (enteredDangerZone ||
        (tile.type === "floor" || tile.type === "decoration") &&
        Math.random() < MOVE_HAZARD_CHANCE);
      const hazardDamage = enteredDragonFire
        ? 8 + rollDie(6)
        : enteredDangerZone && !dangerRewarded
          ? 7 + rollDie(9)
        : hazardTriggered
          ? 2 + rollDie(4) + Math.max(0, Math.floor(gameState.level / 2))
          : 0;
      const survivedHazard = hazardDamage === 0 || gameState.hp - hazardDamage > 0;

      setGameState((state) => {
        if (!state) return state;
        if (dangerRewarded) {
          return applyRewards(
            { ...state, playerPos: next },
            10,
            dangerGold,
            [`You brave a danger zone and recover ${dangerGold} gold plus 10 XP.`]
          );
        }
        if (!hazardTriggered && !enteredDragonFire) return { ...state, playerPos: next };
        return {
          ...state,
          hp: survivedHazard ? state.hp - hazardDamage : state.maxHp,
          gold: survivedHazard ? state.gold : Math.floor(state.gold * 0.7),
          playerPos: survivedHazard ? next : realmSpawn(realmPayload),
          gameLog: appendLog(
            state.gameLog,
            survivedHazard
              ? enteredDragonFire
                ? `${theme.bossName}'s burning trail scorches you for ${hazardDamage} damage.`
                : enteredDangerZone
                  ? `The danger zone erupts for ${hazardDamage} damage.`
                : `A roaming dungeon hazard catches you for ${hazardDamage} damage.`
              : enteredDragonFire
                ? `${theme.bossName}'s burning trail overwhelms you. You stagger back to the gate and drop some gold.`
                : `A roaming dungeon hazard finishes you off. You stagger back to the gate and drop some gold.`
          ),
        };
      });
      if (enteredDangerZone) replaceTile(next.x, next.y, { ...EMPTY_TILE });
      playCue(dangerRewarded ? "collect" : hazardDamage > 0 ? "hit" : "move");
      if (!survivedHazard) return;
      setMovesSinceAutosave((count) => Math.min(AUTOSAVE_MOVE_INTERVAL, count + 1));
      triggerInteraction(tile, next.x, next.y);
    },
    [addLog, completed, gameState, grid, modal, playCue, realmPayload, replaceTile, theme.bossName, triggerInteraction]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "BUTTON"].includes((event.target as HTMLElement)?.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        event.preventDefault();
        movePlayer(0, -1);
      } else if (key === "arrowdown" || key === "s") {
        event.preventDefault();
        movePlayer(0, 1);
      } else if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        movePlayer(-1, 0);
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        movePlayer(1, 0);
      } else if (key === " " && grid && gameState) {
        event.preventDefault();
        const tile = grid[gameState.playerPos.y]?.[gameState.playerPos.x];
        if (tile) triggerInteraction(tile, gameState.playerPos.x, gameState.playerPos.y);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, grid, movePlayer, triggerInteraction]);

  const talkToNpc = (asset: RealmAsset) => {
    if (!gameState || !realmPayload) return;
    const firstConversation = !gameState.npcsSpoken.includes(asset.name);
    const trialAlreadyClaimed = gameState.answeredNpcTrials.includes(asset.name);
    setModal((current) => (current && current.type === "npc" ? { ...current, loading: true } : current));

    void (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18_000);
      try {
        const response = await fetch(`/api/realm/${tokenId}/npc?chainId=${chainId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            npcName: asset.name,
            stateSummary: `HP ${gameState.hp}/${gameState.maxHp}, Level ${gameState.level}, Gold ${gameState.gold}, Boss defeated: ${gameState.bossDefeated ? "yes" : "no"}, Quests: ${gameState.questsCompleted.join(", ") || "none"}, Inventory: ${gameState.inventory.map((item) => item.name).join(", ") || "none"}`,
            recentLog: gameState.gameLog.slice(-5),
          }),
        });
        const payload = (await response.json()) as { reply?: string; error?: string };
        const dialogue = payload.reply || payload.error || `${asset.name}: ${asset.description}`;

        setGameState((state) => {
          if (!state) return state;
          const nextState = {
            ...state,
            npcsSpoken: firstConversation ? [...state.npcsSpoken, asset.name] : state.npcsSpoken,
          };
          return firstConversation
            ? applyRewards(nextState, 6, 0, [dialogue])
            : { ...nextState, gameLog: appendLog(nextState.gameLog, dialogue) };
        });
        setToast(`Spoke with ${asset.name}`);
        setModal((current) => (
          current && current.type === "npc"
            ? {
                ...current,
                loading: false,
                result: dialogue,
                question: buildNpcTrialQuestion(realmPayload, asset),
                trialResolved: trialAlreadyClaimed,
                trialFeedback: trialAlreadyClaimed ? "This keeper has already entrusted you with its Prism Memory." : undefined,
              }
            : current
        ));
      } catch (error) {
        const fallback = `${asset.name}: ${asset.description} I can still guide you from local realm memory while live 0G Compute catches up.`;
        addLog(fallback);
        setModal((current) => (
          current && current.type === "npc"
            ? {
                ...current,
                loading: false,
                result: fallback,
                question: buildNpcTrialQuestion(realmPayload, asset),
                trialResolved: trialAlreadyClaimed,
                trialFeedback: trialAlreadyClaimed ? "This keeper has already entrusted you with its Prism Memory." : undefined,
              }
            : current
        ));
      } finally {
        clearTimeout(timeout);
      }
    })();
  };

  const answerNpcTrial = useCallback((asset: RealmAsset, question: RealmTrialQuestion, answer: string) => {
    const correct = normalizeAnswerKey(answer) === normalizeAnswerKey(question.correctAnswer);

    if (correct) {
      setGameState((state) => {
        if (!state) return state;
        if (state.answeredNpcTrials.includes(asset.name)) {
          return {
            ...state,
            gameLog: appendLog(state.gameLog, `${asset.name} confirms you already hold this memory.`),
          };
        }
        const reward = prismMemoryItem(asset.name, question.rewardLabel);
        return applyRewards(
          {
            ...state,
            answeredNpcTrials: [...state.answeredNpcTrials, asset.name],
            prismMemories: [...state.prismMemories, reward],
            inventory: [...state.inventory, reward],
          },
          18,
          8,
          [`${asset.name} accepts your answer and gifts a Prism Memory.`]
        );
      });
      setToast("Prism Memory claimed");
      playCue("collect");
      setModal((current) => (
        current && current.type === "npc"
          ? { ...current, trialResolved: true, trialFeedback: `Correct. ${asset.name} entrusts you with a Prism Memory.` }
          : current
      ));
      return;
    }

    setGameState((state) => {
      if (!state) return state;
      const nextHp = Math.max(1, state.hp - 9);
      return {
        ...state,
        hp: nextHp,
        gameLog: appendLog(state.gameLog, `${asset.name} rejects your answer. The memory backlash costs 9 HP.`),
      };
    });
    playCue("hit");
    setModal((current) => (
      current && current.type === "npc"
        ? { ...current, trialFeedback: `Wrong answer. Hint: ${question.loreHint}` }
        : current
    ));
  }, [playCue]);

  const answerBossSealTrial = useCallback((question: RealmTrialQuestion, answer: string) => {
    if (!realmPayload) return;
    const correct = normalizeAnswerKey(answer) === normalizeAnswerKey(question.correctAnswer);

    if (correct) {
      setGameState((state) => {
        if (!state) return state;
        if (state.memorySealsBroken >= MEMORY_SEAL_COUNT || state.prismMemories.length === 0) return state;
        const consumed = state.prismMemories[state.prismMemories.length - 1];
        return {
          ...state,
          memorySealsBroken: Math.min(MEMORY_SEAL_COUNT, state.memorySealsBroken + 1),
          prismMemories: state.prismMemories.slice(0, -1),
          inventory: consumed ? state.inventory.filter((item, index) => {
            const lastPrismIndex = state.inventory.map((entry) => entry.type).lastIndexOf("prism-memory");
            return index !== lastPrismIndex;
          }) : state.inventory,
          gameLog: appendLog(
            state.gameLog,
            `You answer correctly and feed a Prism Memory into Seal ${state.memorySealsBroken + 1}.`
          ),
        };
      });
      setModal((current) => (
        current && current.type === "boss"
          ? { ...current, question: undefined, trialFeedback: "A Memory Seal breaks. The boss grows more tangible." }
          : current
      ));
      setToast("Memory Seal broken");
      playCue("quest");
      return;
    }

    setGameState((state) => {
      if (!state) return state;
      const nextHp = Math.max(1, state.hp - 12);
      return {
        ...state,
        hp: nextHp,
        gameLog: appendLog(state.gameLog, `${theme.bossName} rejects your answer. Memory backlash deals 12 HP.`),
      };
    });
    playCue("hit");
    setModal((current) => (
      current && current.type === "boss"
        ? { ...current, trialFeedback: `Wrong answer. Hint: ${question.loreHint}` }
        : current
    ));
  }, [playCue, realmPayload, theme.bossName]);

  const attemptQuest = (asset: RealmAsset) => {
    if (!gameState) return;
    const roll = rollDie(20);
    const total = roll + gameState.level;

    if (total >= QUEST_DC) {
      setGameState((state) => {
        if (!state || state.questsCompleted.includes(asset.name)) return state;
        return applyRewards(
          { ...state, questsCompleted: [...state.questsCompleted, asset.name] },
          22,
          16,
          [`Quest "${asset.name}" completed. Roll ${roll} + level ${state.level} = ${total}.`]
        );
      });
      const pos = gameState.playerPos;
      replaceTile(pos.x, pos.y, { ...EMPTY_TILE });
      setModal(null);
      playCue("quest");
      return;
    }

    setGameState((state) => {
      if (!state) return state;
      const hp = Math.max(1, state.hp - 14);
      return {
        ...state,
        hp,
        gameLog: appendLog(state.gameLog, `Quest "${asset.name}" failed. Roll ${roll} + level ${state.level} = ${total}. Lose 14 HP.`),
      };
    });
    playCue("hit");
    setModal({ type: "quest", asset, result: `Roll ${roll} + level ${gameState.level} = ${total}. DC ${QUEST_DC} resisted you.` });
  };

  const attackBoss = () => {
    if (!gameState || !realmPayload) return;
    const roll = rollDie(20);
    const total = roll + gameState.level;
    const hit = total >= BOSS_HIT_DC;
    const rawDamage = hit ? 6 + rollDie(8) + gameState.level * 2 : 0;
    const remainingSeals = Math.max(0, MEMORY_SEAL_COUNT - gameState.memorySealsBroken);
    const damage = hit ? Math.max(1, Math.floor(rawDamage * (1 - remainingSeals * 0.2))) : 0;
    const nextBossHp = Math.max(0, bossHp - damage);
    const combatLog = hit
      ? [`You hit the boss for ${damage}${remainingSeals > 0 ? ` through ${remainingSeals} armor seal${remainingSeals === 1 ? "" : "s"}` : ""}. Roll ${roll} + level ${gameState.level} = ${total}.`]
      : [`Your attack misses. Roll ${roll} + level ${gameState.level} = ${total}.`];

    if (nextBossHp <= 0) {
      setBossHp(0);
      setGrid((current) => (current ? placeExit(updateTile(current, gameState.playerPos.x, gameState.playerPos.y, { ...EMPTY_TILE })) : current));
      setGameState((state) => {
        if (!state) return state;
        const trophy = {
          name: "Boss Trophy",
          description: `A victory mark from ${theme.bossName}.`,
          type: "artifact",
        };
        return applyRewards(
          {
            ...state,
            bossDefeated: true,
            inventory: state.inventory.some((item) => item.name === trophy.name) ? state.inventory : [...state.inventory, trophy],
          },
          120,
          60,
          [...combatLog, `${theme.bossName} falls. The exit opens near the north gate.`]
        );
      });
      setModal(null);
      setToast("Boss defeated. Exit opened.");
      playCue("victory");
      return;
    }

    const bossDamage = 7 + rollDie(8) + Math.max(0, Math.floor(realmPayload.assets.length / 2));
    const nextHp = gameState.hp - bossDamage;

    if (nextHp <= 0) {
      setBossHp(maxBossHp);
      setGameState((state) =>
        state
          ? {
              ...state,
              hp: state.maxHp,
              gold: Math.floor(state.gold / 2),
              playerPos: realmSpawn(realmPayload),
              gameLog: appendLog(state.gameLog, [...combatLog, `${theme.bossName} defeats you. You respawn at the realm gate with half your gold.`]),
            }
          : state
      );
      setModal(null);
      playCue("hit");
      return;
    }

    setBossHp(nextBossHp);
    setGameState((state) =>
      state
        ? {
            ...state,
            hp: nextHp,
            gameLog: appendLog(state.gameLog, [...combatLog, `${theme.bossName} strikes back for ${bossDamage}.`]),
          }
        : state
    );
    setModal({ type: "boss", result: `${hit ? `${damage} damage dealt.` : "Attack missed."} Boss countered for ${bossDamage}.` });
    playCue("hit");
    igniteDragonBreath();
  };

  const challengeBossSeal = () => {
    if (!gameState || !realmPayload) return;
    if (gameState.memorySealsBroken >= MEMORY_SEAL_COUNT) {
      setModal({ type: "boss", result: `${theme.bossName} has no armor seals left. Attack for full damage.` });
      return;
    }
    if (gameState.prismMemories.length === 0) {
      setModal({ type: "boss", result: "You need a Prism Memory from an NPC trial to challenge an armor seal. You can still attack now." });
      return;
    }
    setModal({
      type: "boss",
      result: `Challenge armor Seal ${gameState.memorySealsBroken + 1}. A correct answer consumes one Prism Memory and increases future attack damage.`,
      question: buildBossSealQuestion(realmPayload, gameState.memorySealsBroken),
    });
  };

  const runAutonomousWorldAction = useCallback(() => {
    const currentGrid = gridRef.current;
    const currentGameState = gameStateRef.current;
    const currentRealm = realmPayloadRef.current;
    const currentTheme = themeRef.current;
    if (!currentGrid || !currentGameState || !currentRealm || completedRef.current) return;

    autoTickRef.current += 1;
    const nextGrid = cloneGrid(currentGrid);
    const player = currentGameState.playerPos;
    const playerTarget = findAutonomousPlayerTarget(nextGrid, currentGameState);
    const playerStep = playerTarget ? findAutonomousStep(nextGrid, player, playerTarget) : null;
    const wanderStep = playerStep ? null : findAutonomousWanderStep(nextGrid, player, autoTickRef.current);
    const activeStep = playerStep ?? wanderStep;
    const activeTarget =
      playerTarget && playerStep
        ? playerTarget
        : activeStep
          ? { x: activeStep.x, y: activeStep.y, tile: nextGrid[activeStep.y]?.[activeStep.x] ?? EMPTY_TILE }
          : null;

    if (activeTarget && activeStep) {
      let gridAfter = nextGrid;
      let stateAfter: GameState = { ...currentGameState, playerPos: activeStep };
      let pulse = playerStep
        ? `Clan pilot moves toward ${describeAutoTarget(activeTarget.tile, currentTheme)} at (${activeStep.x}, ${activeStep.y}).`
        : `Clan pilot scouts the realm at (${activeStep.x}, ${activeStep.y}).`;
      const arrived = activeStep.x === activeTarget.x && activeStep.y === activeTarget.y;
      const tile = gridAfter[activeStep.y]?.[activeStep.x];

      if (arrived && tile) {
        if (tile.type === "danger") {
          const rewarded = Math.random() < 0.45;
          const gold = rewarded ? 18 + rollDie(18) : 0;
          const damage = rewarded ? 0 : 7 + rollDie(9);
          stateAfter = rewarded
            ? applyRewards(stateAfter, 10, gold, [`Autonomous pilot braved a danger zone and recovered ${gold} gold plus 10 XP.`])
            : {
                ...stateAfter,
                hp: Math.max(1, stateAfter.hp - damage),
                gameLog: appendLog(stateAfter.gameLog, `Autonomous pilot crossed a danger zone and lost ${damage} HP.`),
              };
          gridAfter = updateTile(gridAfter, activeStep.x, activeStep.y, { ...EMPTY_TILE });
          pulse = rewarded ? `Danger zone reward: ${gold} gold` : `Danger zone eruption: ${damage} damage`;
          playCue(rewarded ? "collect" : "hit");
        } else if (tile.type === "artifact" && tile.asset) {
          const artifact = tile.asset;
          if (!stateAfter.inventory.some((item) => item.name === artifact.name)) {
            stateAfter = applyRewards(
              {
                ...stateAfter,
                inventory: [...stateAfter.inventory, { name: artifact.name, description: artifact.description, type: artifact.type }],
              },
              12,
              0,
              [`Autonomous pilot collected ${artifact.name}.`]
            );
          }
          gridAfter = updateTile(gridAfter, activeStep.x, activeStep.y, { ...EMPTY_TILE });
          pulse = `Collected artifact: ${artifact.name}`;
          playCue("collect");
        } else if (tile.type === "quest" && tile.asset) {
          const quest = tile.asset;
          const roll = rollDie(20);
          const total = roll + stateAfter.level;
          if (total >= QUEST_DC) {
            if (!stateAfter.questsCompleted.includes(quest.name)) {
              stateAfter = applyRewards(
                { ...stateAfter, questsCompleted: [...stateAfter.questsCompleted, quest.name] },
                quest.description.includes(AUTONOMOUS_MODEL_NAME) ? 10 : 22,
                quest.description.includes(AUTONOMOUS_MODEL_NAME) ? 5 : 16,
                [`Autonomous pilot completed "${quest.name}". Roll ${roll} + level ${stateAfter.level} = ${total}.`]
              );
            }
            gridAfter = updateTile(gridAfter, activeStep.x, activeStep.y, { ...EMPTY_TILE });
            pulse = `Completed quest: ${quest.name}`;
            playCue("quest");
          } else {
            stateAfter = {
              ...stateAfter,
              hp: Math.max(1, stateAfter.hp - 10),
              gameLog: appendLog(
                stateAfter.gameLog,
                `Autonomous pilot tested "${quest.name}" but failed. Roll ${roll} + level ${stateAfter.level} = ${total}.`
              ),
            };
            pulse = `Quest attempt failed: ${quest.name}`;
            playCue("hit");
          }
        } else if (tile.type === "npc" && tile.asset) {
          const npc = tile.asset;
          if (!stateAfter.npcsSpoken.includes(npc.name)) {
            stateAfter = applyRewards(
              { ...stateAfter, npcsSpoken: [...stateAfter.npcsSpoken, npc.name] },
              6,
              0,
              [`Autonomous pilot asked ${npc.name} for a route clue.`]
            );
          } else {
            stateAfter = { ...stateAfter, gameLog: appendLog(stateAfter.gameLog, `Autonomous pilot checks in with ${npc.name}.`) };
          }
          if (!stateAfter.answeredNpcTrials.includes(npc.name)) {
            const reward = prismMemoryItem(npc.name, npc.name);
            stateAfter = applyRewards(
              {
                ...stateAfter,
                answeredNpcTrials: [...stateAfter.answeredNpcTrials, npc.name],
                prismMemories: [...stateAfter.prismMemories, reward],
                inventory: [...stateAfter.inventory, reward],
              },
              18,
              8,
              [`Autonomous pilot solved ${npc.name}'s memory trial and secured a Prism Memory.`]
            );
          }
          pulse = `Spoke with NPC: ${npc.name}`;
        } else if (tile.type === "boss") {
          const currentBossHp = bossHpRef.current || bossMaxHp(currentRealm);
          if (stateAfter.prismMemories.length < PRISM_MEMORIES_REQUIRED && stateAfter.memorySealsBroken === 0) {
            stateAfter = {
              ...stateAfter,
              gameLog: appendLog(
                stateAfter.gameLog,
                `Autonomous pilot studies ${currentTheme.bossName} but still needs ${PRISM_MEMORIES_REQUIRED - stateAfter.prismMemories.length} Prism Memories.`
              ),
            };
            pulse = `Boss remains sealed: ${currentTheme.bossName}`;
          } else if (stateAfter.memorySealsBroken < MEMORY_SEAL_COUNT) {
            if (stateAfter.prismMemories.length > 0) {
              const consumed = stateAfter.prismMemories[stateAfter.prismMemories.length - 1];
              const lastPrismIndex = stateAfter.inventory.map((entry) => entry.type).lastIndexOf("prism-memory");
              stateAfter = {
                ...stateAfter,
                memorySealsBroken: stateAfter.memorySealsBroken + 1,
                prismMemories: stateAfter.prismMemories.slice(0, -1),
                inventory: consumed && lastPrismIndex >= 0
                  ? stateAfter.inventory.filter((_, index) => index !== lastPrismIndex)
                  : stateAfter.inventory,
                gameLog: appendLog(
                  stateAfter.gameLog,
                  `Autonomous pilot answers the boss's memory trial and breaks Seal ${stateAfter.memorySealsBroken + 1}.`
                ),
              };
              pulse = `Memory Seal broken: ${stateAfter.memorySealsBroken}/${MEMORY_SEAL_COUNT}`;
            } else {
              stateAfter = {
                ...stateAfter,
                gameLog: appendLog(stateAfter.gameLog, `Autonomous pilot reaches the seal gate but has no Prism Memories left to spend.`),
              };
              pulse = `Need Prism Memory for next seal`;
            }
          } else if (stateAfter.hp < 35) {
            stateAfter = {
              ...stateAfter,
              gameLog: appendLog(stateAfter.gameLog, `Autonomous pilot scouts ${currentTheme.bossName} and waits for more HP.`),
            };
            pulse = `Scouting boss: ${currentTheme.bossName}`;
          } else {
            const roll = rollDie(20);
            const total = roll + stateAfter.level;
            const hit = total >= BOSS_HIT_DC;
            const damage = hit ? 6 + rollDie(8) + stateAfter.level * 2 : 0;
            const nextBossHp = Math.max(0, currentBossHp - damage);

            if (nextBossHp <= 0) {
              const trophy = {
                name: "Boss Trophy",
                description: `A victory mark from ${currentTheme.bossName}.`,
                type: "artifact",
              };
              bossHpRef.current = 0;
              setBossHp(0);
              gridAfter = placeExit(updateTile(gridAfter, activeStep.x, activeStep.y, { ...EMPTY_TILE }));
              stateAfter = applyRewards(
                {
                  ...stateAfter,
                  bossDefeated: true,
                  inventory: stateAfter.inventory.some((item) => item.name === trophy.name)
                    ? stateAfter.inventory
                    : [...stateAfter.inventory, trophy],
                },
                120,
                60,
                [`Autonomous pilot defeated ${currentTheme.bossName}. The exit opens near the north gate.`]
              );
              setToast("Autonomous clan defeated the boss. Exit opened.");
              pulse = `Boss defeated: ${currentTheme.bossName}`;
              playCue("victory");
            } else {
              const bossDamage = 7 + rollDie(8) + Math.max(0, Math.floor(currentRealm.assets.length / 2));
              const nextHp = stateAfter.hp - bossDamage;
              bossHpRef.current = nextBossHp;
              setBossHp(nextBossHp);

              if (nextHp <= 0) {
                bossHpRef.current = bossMaxHp(currentRealm);
                setBossHp(bossMaxHp(currentRealm));
                stateAfter = {
                  ...stateAfter,
                  hp: stateAfter.maxHp,
                  gold: Math.floor(stateAfter.gold / 2),
                  playerPos: realmSpawn(currentRealm),
                  gameLog: appendLog(
                    stateAfter.gameLog,
                    `Autonomous pilot was defeated by ${currentTheme.bossName} and respawned at the realm gate.`
                  ),
                };
                pulse = `Respawned after boss defeat`;
                playCue("hit");
              } else {
                stateAfter = {
                  ...stateAfter,
                  hp: nextHp,
                  gameLog: appendLog(
                    stateAfter.gameLog,
                    hit
                      ? `Autonomous pilot hit ${currentTheme.bossName} for ${damage}; counterattack dealt ${bossDamage}.`
                      : `Autonomous pilot missed ${currentTheme.bossName}; counterattack dealt ${bossDamage}.`
                  ),
                };
                pulse = `Boss exchange: ${nextBossHp}/${bossMaxHp(currentRealm)} HP remains`;
                playCue("hit");
                igniteDragonBreath();
              }
            }
          }
        } else if (tile.type === "exit") {
          stateAfter = { ...stateAfter, gameLog: appendLog(stateAfter.gameLog, "Autonomous pilot reached the realm exit.") };
          completedRef.current = true;
          setCompleted(true);
          pulse = "Realm exit reached";
        } else {
          stateAfter = { ...stateAfter, gameLog: appendLog(stateAfter.gameLog, pulse) };
        }
      } else {
        stateAfter = { ...stateAfter, gameLog: appendLog(stateAfter.gameLog, pulse) };
      }

      gridRef.current = gridAfter;
      gameStateRef.current = stateAfter;
      setGrid(gridAfter);
      setGameState(stateAfter);
      setAutoPulse(pulse);
      pushAutoLog(pulse);
      return;
    }

    const autonomousQuestPositions = findTilePositions(
      nextGrid,
      (tile) => tile.type === "quest" && Boolean(tile.asset?.description.includes(AUTONOMOUS_MODEL_NAME))
    );
    const roll = Math.random();

    if (autonomousQuestPositions.length > 0 && roll < 0.35) {
      const quest = pickOne(autonomousQuestPositions);
      if (!quest?.tile.asset) return;

      nextGrid[quest.y][quest.x] = { ...EMPTY_TILE };
      gridRef.current = nextGrid;
      setGrid(nextGrid);
      setGameState((state) => {
        if (!state || state.questsCompleted.includes(quest.tile.asset!.name)) return state;
        return applyRewards(
          { ...state, questsCompleted: [...state.questsCompleted, quest.tile.asset!.name] },
          12,
          6,
          [`Autonomous clan completed "${quest.tile.asset!.name}" while you watched.`]
        );
      });
      pushAutoLog(`Completed micro-quest: ${quest.tile.asset.name}`);
      return;
    }

    if (roll < 0.58) {
      const npcs = findTilePositions(nextGrid, (tile) => tile.type === "npc");
      const npc = pickOne(npcs);
      if (npc) {
        const directions = [
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
        ].sort(() => Math.random() - 0.5);
        const step = directions.find((direction) => {
          const x = npc.x + direction.x;
          const y = npc.y + direction.y;
          const target = nextGrid[y]?.[x];
          return target && canAutonomyOccupy(target) && !(player.x === x && player.y === y);
        });

        if (step) {
          const x = npc.x + step.x;
          const y = npc.y + step.y;
          const name = npc.tile.asset?.name || "Realm NPC";
          nextGrid[npc.y][npc.x] = { ...EMPTY_TILE };
          nextGrid[y][x] = npc.tile;
          gridRef.current = nextGrid;
          setGrid(nextGrid);
          const message = `${name} patrols to (${x}, ${y}).`;
          addLog(message);
          pushAutoLog(message);
          return;
        }
      }
    }

    if (roll < 0.82) {
      const openTiles = findTilePositions(
        nextGrid,
        (tile, x, y) => canAutonomyOccupy(tile) && !(player.x === x && player.y === y)
      );
      const target = pickOne(openTiles);
      if (target) {
        const asset = autonomousQuestAsset(currentRealm, currentTheme, autoTickRef.current);
        nextGrid[target.y][target.x] = { type: "quest", icon: "⭐", passable: true, asset };
        gridRef.current = nextGrid;
        setGrid(nextGrid);
        const message = `${AUTONOMOUS_MODEL_NAME} spawned "${asset.name}" at (${target.x}, ${target.y}).`;
        addLog(message);
        pushAutoLog(`Spawned micro-quest: ${asset.name}`);
        return;
      }
    }

    const mutableTiles = findTilePositions(
      nextGrid,
      (tile, x, y) => canAutonomyOccupy(tile) && !(player.x === x && player.y === y)
    );
    const target = pickOne(mutableTiles);
    if (!target) return;
    const decorationPool = currentTheme.decorationIcons.length > 0 ? currentTheme.decorationIcons : ["✦"];
    const icon = decorationPool[autoTickRef.current % decorationPool.length] || "✦";
    nextGrid[target.y][target.x] = { type: "decoration", icon, passable: true };
    gridRef.current = nextGrid;
    setGrid(nextGrid);
    const message = `The clan reshaped a ${currentTheme.name.toLowerCase()} tile at (${target.x}, ${target.y}).`;
    addLog(message);
    pushAutoLog(message);
  }, [addLog, igniteDragonBreath, playCue, pushAutoLog]);

  const saveProgress = async (markCompleted: boolean, options?: { quiet?: boolean }) => {
    if (!gameState || !realmPayload || !address || !contractAddress || tokenIdBig === undefined) return;
    if (!canPersist) {
      setSaveStatus("Spectator mode can explore, but only the clan owner can persist progress.");
      return;
    }

    setSaving(true);
    setSaveStatus(options?.quiet ? "Auto-saving progress to 0G Storage..." : "Saving progress to 0G Storage...");

    const progress: SaveProgressPayload = {
      completed: markCompleted,
      sessionId: gameState.sessionId,
      clanTitle: realmPayload.title,
      hp: gameState.hp,
      xp: gameState.xp,
      gold: gameState.gold,
      level: gameState.level,
      inventory: gameState.inventory,
      questsCompleted: gameState.questsCompleted,
      bossDefeated: gameState.bossDefeated,
      playerAddress: address,
      completedAt: markCompleted ? Date.now() : undefined,
    };

    try {
      const response = await fetch(`/api/realm/${tokenId}?chainId=${chainId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveProgress", tokenId, chainId, progress }),
      });
      const payload = (await response.json()) as {
        progressRootHash?: string;
        storageTxHash?: string;
        error?: string;
      };
      if (!response.ok || !payload.progressRootHash) throw new Error(payload.error || "Progress upload failed");

      if (markCompleted && gameState.bossDefeated) {
        setSaveStatus("Recording realm completion on-chain...");
        const latestState = normalizeClanState((await refetchClanState()).data) ?? clanState;
        const metadataHash = keccak256(toUtf8Bytes(JSON.stringify(progress))) as Hex;
        const memorySize = new TextEncoder().encode(JSON.stringify(progress)).length;

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: agentInftAbi,
          functionName: "recordClanEvolution",
          args: [
            tokenIdBig,
            metadataHash,
            payload.progressRootHash,
            latestState?.memoryRootURI ?? "",
            latestState?.realmRootURI ?? clanState?.realmRootURI ?? "",
            BigInt(memorySize),
            BigInt(latestState?.realmCount ?? clanState?.realmCount ?? 0),
            "0x",
          ],
        });

        await fetch("/api/clans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "recordMemoryEntry",
            tokenId,
            chainId,
            entry: `REALM COMPLETED: ${realmPayload.title}. XP: ${gameState.xp}, Gold: ${gameState.gold}, Boss defeated: ${gameState.bossDefeated ? "yes" : "no"}.`,
            executor: address,
          }),
        }).catch(() => undefined);

        setSaveStatus(`Completion recorded on-chain: ${hash}`);
        addLog(`Realm completion saved to 0G Storage and recorded on-chain.`);
      } else {
        setSaveStatus(`${options?.quiet ? "Auto-saved" : "Progress saved"} to 0G Storage: ${payload.progressRootHash}`);
        if (!options?.quiet) {
          addLog("Progress saved to 0G Storage.");
          playCue("save");
        }
      }
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Progress save failed");
    } finally {
      setSaving(false);
    }
  };
  saveProgressRef.current = saveProgress;

  useEffect(() => {
    if (!canPersist || saving || movesSinceAutosave < AUTOSAVE_MOVE_INTERVAL) return;
    setMovesSinceAutosave(0);
    void saveProgressRef.current(false, { quiet: true });
  }, [canPersist, movesSinceAutosave, saving]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading || !gameState) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18_000);
      const response = await fetch(`/api/realm/${tokenId}/chat?chainId=${chainId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMsg,
          stateSummary: `HP ${gameState.hp}/${gameState.maxHp}, Level ${gameState.level}, Gold ${gameState.gold}, XP ${gameState.xp}, Boss defeated: ${gameState.bossDefeated ? "yes" : "no"}, Quests done: ${gameState.questsCompleted.join(", ") || "none"}, Inventory: ${gameState.inventory.map((i) => i.name).join(", ") || "none"}`,
          recentLog: gameState.gameLog.slice(-5),
          history: chatMessages.slice(-6),
        }),
      });
      clearTimeout(timeout);
      const payload = (await response.json()) as { reply?: string; error?: string; verified?: boolean };
      const reply = payload.reply || payload.error || "The clan advisor is silent.";
      setChatMessages((prev) => [...prev, { role: "clan", text: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "clan",
          text: "Clan Advisor: Mainnet 0G Compute did not answer in time, so I am using local realm memory. Keep moving through quests, collect artifacts, and use autonomy to let NPCs patrol and reshape the map.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Autonomous clan world actions
  useEffect(() => {
    if (!autoMode || !gameState || !realmPayload) return;

    pushAutoLog("Autonomous clan is now moving NPCs and reshaping the realm.");
    const immediate = setTimeout(runAutonomousWorldAction, 900);
    const interval = setInterval(runAutonomousWorldAction, AUTO_WORLD_INTERVAL_MS);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [autoMode, gameState?.bossDefeated, realmPayload?.title, pushAutoLog, runAutonomousWorldAction]);

  // 0GM-style advisory directive. World actions continue even if compute is unavailable.
  useEffect(() => {
    if (!autoMode || !gameState || !realmPayload) return;

    const runAutoCycle = async () => {
      pushAutoLog(`${AUTONOMOUS_MODEL_NAME} is planning the next clan directive...`);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18_000);
        const response = await fetch(`/api/realm/${tokenId}/chat?chainId=${chainId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: `Act as ${AUTONOMOUS_MODEL_NAME}, the clan's autonomous world director. Give one concise directive for NPC movement, micro-quest creation, or terrain change. Do not ask for wallet signatures.`,
            stateSummary: `Autonomous mode active. HP ${gameState.hp}/${gameState.maxHp}, Level ${gameState.level}, Gold ${gameState.gold}, Boss defeated: ${gameState.bossDefeated ? "yes" : "no"}, Quests done: ${gameState.questsCompleted.length}/${realmPayload.assets.filter((a) => a.type === "quest").length}, Current auto pulse: ${autoPulseRef.current}`,
            recentLog: gameState.gameLog.slice(-3),
          }),
        });
        clearTimeout(timeout);
        const payload = (await response.json()) as { reply?: string; error?: string };
        const update = payload.reply || payload.error || "No update available.";
        pushAutoLog(`Directive: ${update}`);
        addLog(`Autonomous directive: ${update}`);
      } catch {
        pushAutoLog(`${AUTONOMOUS_MODEL_NAME} directive unavailable; local clan instincts continue.`);
      }
    };

    void runAutoCycle();
    const interval = setInterval(() => void runAutoCycle(), AUTO_DIRECTIVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [addLog, autoMode, chainId, gameState?.bossDefeated, gameState?.questsCompleted.length, realmPayload?.title, pushAutoLog, tokenId]);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-5 text-parchment">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
          Loading clan realm from 0G Storage...
        </div>
      </main>
    );
  }

  if (loadError || !realmPayload || !gameState || !grid) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center px-6">
        <Panel title="Realm Unavailable" icon={ShieldCheck}>
          <p className="text-sm leading-6 text-stone">{loadError || "The realm record could not be rendered."}</p>
          <a href="/play" className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian">
            <ArrowLeft className="h-4 w-4" />
            Back to realms
          </a>
        </Panel>
      </main>
    );
  }

  const questAssets = realmPayload.assets.filter((asset) => asset.type === "quest");

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden px-4 py-6 pb-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 rounded-md border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between">
          <a href="/app" className="inline-flex items-center gap-2 text-sm font-semibold text-stone transition hover:text-parchment">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </a>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">{theme.name} Tile Realm</p>
            <h1 className="mt-1 text-2xl font-black text-parchment md:text-4xl">{realmPayload.title}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-stone">
            <Crown className="h-4 w-4 text-gold" />
            Clan #{tokenId}
            <span className="rounded border border-white/10 px-2 py-1 text-xs text-parchment">
              {canPersist ? "Owner Save" : "Spectator"}
            </span>
            <button
              type="button"
              onClick={() => void toggleAudio()}
              title={audioEnabled ? "Mute realm audio" : "Enable realm audio"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/20 text-gold transition hover:border-gold/40 hover:bg-gold/10"
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,680px)_1fr]">
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-md border border-white/10 bg-black/35 p-4 shadow-2xl shadow-black/40">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-parchment">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Flame className="h-4 w-4 text-ember" />
                  {gameState.bossDefeated ? `${theme.bossName} has fallen` : `${theme.bossName} is breathing fire`}
                </span>
                <span className="font-mono text-ember">{gameState.bossDefeated ? "DEFEATED" : "DRAGON ACTIVE"}</span>
              </div>
              <div
                className="mx-auto grid w-max gap-1"
                style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, 40px)` }}
                aria-label={`${realmPayload.title} tile map`}
              >
                {grid.map((row, y) =>
                  row.map((tile, x) => (
                    <TileCell
                      key={`${x}-${y}`}
                      tile={tile}
                      theme={theme}
                      isPlayer={gameState.playerPos.x === x && gameState.playerPos.y === y}
                      firePhase={dragonFireByTile.get(`${x}:${y}`)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-3 gap-1.5">
                <div />
                <button onPointerDown={() => movePlayer(0, -1)} className="flex h-12 w-12 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-lg text-gold active:bg-gold/30">▲</button>
                <div />
                <button onPointerDown={() => movePlayer(-1, 0)} className="flex h-12 w-12 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-lg text-gold active:bg-gold/30">◀</button>
                <button
                  onPointerDown={() => {
                    if (!grid || !gameState) return;
                    const tile = grid[gameState.playerPos.y]?.[gameState.playerPos.x];
                    if (tile) triggerInteraction(tile, gameState.playerPos.x, gameState.playerPos.y);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-md border border-accent-primary/40 bg-accent-primary/10 text-xs font-bold text-parchment active:bg-accent-primary/30"
                >ACT</button>
                <button onPointerDown={() => movePlayer(1, 0)} className="flex h-12 w-12 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-lg text-gold active:bg-gold/30">▶</button>
                <div />
                <button onPointerDown={() => movePlayer(0, 1)} className="flex h-12 w-12 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-lg text-gold active:bg-gold/30">▼</button>
                <div />
              </div>
              <p className="w-full text-center text-xs text-stone">Tap to move. ACT interacts with your tile.</p>
            </div>

            <Panel title="Game Log" icon={ScrollText}>
              <div className="fantasy-scrollbar max-h-72 space-y-2 overflow-y-auto pr-2 font-mono text-xs leading-5 text-stone">
                {gameState.gameLog.map((entry, index) => (
                  <p key={`${entry}-${index}`}>&gt; {entry}</p>
                ))}
              </div>
              <p className="text-xs text-stone">WASD or arrow keys move. Space interacts with the tile beneath you.</p>
            </Panel>
          </div>

          <aside className="fantasy-scrollbar space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
            <Panel title="Realm Versions" icon={Crown}>
              {realmHistory.length === 0 ? (
                <p className="text-sm text-stone">No version history is available for this realm yet.</p>
              ) : (
                <div className="space-y-2">
                  {realmHistory.map((version) => (
                    <a
                      key={version.rootHash}
                      href={version.current ? `/play/${tokenId}` : `/play/${tokenId}?realmRoot=${encodeURIComponent(version.rootHash)}`}
                      className={`block rounded-md border px-3 py-3 transition ${
                        (selectedRealmRoot ? version.rootHash === selectedRealmRoot : version.current)
                          ? "border-gold bg-gold/10"
                          : "border-white/10 bg-black/20 hover:border-gold/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-parchment">Version {version.version}</p>
                      <p className="mt-1 text-xs text-stone">{version.title}</p>
                    </a>
                  ))}
                </div>
              )}
              {clanState && clanState.realmCount > realmHistory.length && (
                <p className="text-xs leading-5 text-stone">
                  Some earlier realm versions cannot be selected because they were created before version tracking was added.
                </p>
              )}
            </Panel>

            <Panel title="How to Play" icon={ScrollText}>
              <div className="space-y-3 text-sm leading-6 text-stone">
                <p>Move one tile at a time using <span className="text-parchment">WASD</span> or the <span className="text-parchment">arrow keys</span>.</p>
                <p>Use <span className="text-parchment">Space</span> to interact with the tile under your character.</p>
                <p>Talk to NPCs, attempt quests, collect artifacts, and defeat the boss to open the exit.</p>
                <ul className="space-y-2 text-xs leading-5 text-parchment">
                  <li>Goal: clear the boss and reach the exit tile.</li>
                  <li>Artifacts add to your inventory and grant XP.</li>
                  <li>NPCs now test your understanding of the realm; correct answers award Prism Memories.</li>
                  <li>The boss is immune until you gather enough Prism Memories and break every Memory Seal.</li>
                  <li>When the dragon marks tiles, move quickly. Warning tiles ignite into damaging fire.</li>
                  <li>Visible danger zones can erupt for heavy damage or pay out bonus gold and XP.</li>
                  <li>Quests now check against DC {QUEST_DC}; failures hit harder.</li>
                  <li>Empty tiles can trigger roaming hazards, so every step matters.</li>
                </ul>
              </div>
            </Panel>

            <Panel title="Stats" icon={Heart}>
              <StateRow label="HP" value={`${gameState.hp}/${gameState.maxHp}`} />
              <StateRow label="Level" value={String(gameState.level)} />
              <StateRow label="Run XP" value={`${xpProgressInLevel}/100 (${xpToNextLevel} to next level)`} />
              <StateRow label="Total Run XP" value={String(gameState.xp)} />
              <StateRow label="Lifetime iNFT XP" value={String(tokenLeaderboardEntry?.totalXpEarned ?? 0)} />
              <StateRow label="Prism Memories" value={`${gameState.prismMemories.length}/${PRISM_MEMORIES_REQUIRED} needed`} />
              <StateRow label="Memory Seals" value={`${gameState.memorySealsBroken}/${MEMORY_SEAL_COUNT} broken`} />
              <StateRow label="Gold" value={String(gameState.gold)} />
            </Panel>

            <Panel title="General Leaderboard" icon={Trophy}>
              {leaderboardStatus && (
                <p className="rounded-md border border-white/10 bg-black/25 p-3 text-xs text-stone">{leaderboardStatus}</p>
              )}
              {tokenLeaderboardEntry && (
                <div className="rounded-md border border-gold/25 bg-gold/10 p-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-gold">Your iNFT</p>
                  <p className="mt-2 text-lg font-black text-parchment">#{tokenLeaderboardEntry.tokenId} {tokenLeaderboardEntry.clanTitle}</p>
                  <p className="mt-1 text-sm text-stone">
                    {tokenLeaderboardEntry.totalXpEarned} lifetime XP, peak run {tokenLeaderboardEntry.highestRunXp}, {tokenLeaderboardEntry.completedRuns} clears
                  </p>
                </div>
              )}
              {leaderboard.length === 0 ? (
                <p className="text-sm text-stone">No on-chain tournament completion has been recorded on this network yet.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 8).map((entry, index) => (
                    <div
                      key={entry.tokenId}
                      className={`rounded-md border px-3 py-3 ${
                        entry.tokenId === tokenId ? "border-gold/40 bg-gold/10" : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-parchment">
                          {index + 1}. Clan #{entry.tokenId}
                        </p>
                        <p className="font-mono text-xs text-gold">{entry.totalXpEarned} XP</p>
                      </div>
                      <p className="mt-1 text-xs text-stone">{entry.clanTitle}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-stone">
                        Best run {entry.highestRunXp} • Boss kills {entry.bossKills} • Clears {entry.completedRuns}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Inventory" icon={Package}>
              {gameState.inventory.length === 0 ? (
                <p className="text-sm text-stone">No artifacts collected.</p>
              ) : (
                <div className="space-y-3">
                  {gameState.inventory.map((item) => (
                    <div key={item.name} className="rounded-md border border-white/10 bg-black/25 p-3">
                      <p className="font-semibold text-parchment">💎 {item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-stone">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Quests" icon={BookOpen}>
              {questAssets.length === 0 ? (
                <p className="text-sm text-stone">This realm has no explicit quest asset.</p>
              ) : (
                questAssets.map((quest) => (
                  <StateRow
                    key={quest.name}
                    label={gameState.questsCompleted.includes(quest.name) ? "Complete" : "Open"}
                    value={`${gameState.questsCompleted.includes(quest.name) ? "☑" : "☐"} ${quest.name}`}
                  />
                ))
              )}
              <StateRow label="Boss" value={gameState.bossDefeated ? "☑ Defeated" : "☐ Awaiting challenge"} />
              <StateRow label="Boss Gate" value={gameState.memorySealsBroken >= MEMORY_SEAL_COUNT ? "Vulnerable" : `Sealed (${MEMORY_SEAL_COUNT - gameState.memorySealsBroken} left)`} />
            </Panel>

            <Panel title="Persistence" icon={Save}>
              <button
                onClick={() => void saveProgress(false)}
                disabled={saving || !canPersist}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save progress
              </button>
              <p className="text-xs leading-5 text-stone">
                {canPersist
                  ? `Progress auto-saves every ${AUTOSAVE_MOVE_INTERVAL} moves. Manual saves persist immediately without a wallet transaction. Only the final completion flow records an on-chain clan evolution.`
                  : "Connect as the clan owner to enable progress saves. Movement, combat, and NPC interactions never require a wallet transaction."}
              </p>
              {saveStatus && <p className="break-words rounded-md border border-white/10 bg-black/25 p-3 font-mono text-xs text-parchment">{saveStatus}</p>}
            </Panel>

            <Panel title="Clan Chat" icon={MessageSquare}>
              <div className="fantasy-scrollbar max-h-52 space-y-2 overflow-y-auto pr-2">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-stone">Ask your Clan Advisor for help with quests, combat, or strategy. Powered by live 0G Compute.</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`rounded-md border p-2.5 text-sm leading-5 ${msg.role === "user" ? "border-white/10 bg-black/25 text-parchment" : "border-gold/20 bg-gold/5 text-stone"}`}>
                    <span className="font-bold text-gold">{msg.role === "user" ? "You" : "Clan AI"}:</span> {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-sm text-stone">
                    <Loader2 className="h-3 w-3 animate-spin text-gold" />
                    Querying 0G Compute...
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendChatMessage(); }}
                  placeholder="Ask the clan advisor..."
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-parchment outline-none focus:border-gold"
                />
                <button
                  onClick={() => void sendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-obsidian disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </Panel>

            <Panel title="Autonomous Clan" icon={Bot}>
              <p className="text-sm leading-6 text-stone">
                {autoMode
                  ? "The clan is piloting the run: the player avatar moves, NPCs patrol, quests resolve, artifacts are collected, and realm tiles shift while 0G Compute supplies periodic direction."
                  : "Let the clan play while you watch. The local pilot keeps moving even when mainnet Compute is catching up, then folds in 0G Compute directives when available."}
              </p>
              <StateRow label="Model" value={AUTONOMOUS_MODEL_NAME} />
              <StateRow label="Pulse" value={autoPulse} />
              <button
                onClick={() => setAutoMode((prev) => !prev)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold ${
                  autoMode
                    ? "border border-ember/40 bg-ember/10 text-ember"
                    : "bg-gold text-obsidian"
                }`}
              >
                {autoMode ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {autoMode ? "Stop Clan Autonomy" : "Let Clan Act Autonomously"}
              </button>
              {autoLog.length > 0 && (
                <div className="fantasy-scrollbar max-h-40 space-y-1 overflow-y-auto pr-2 font-mono text-xs leading-5 text-stone">
                  {autoLog.map((entry, i) => (
                    <p key={i}>{entry}</p>
                  ))}
                </div>
              )}
            </Panel>
          </aside>
        </section>
      </motion.div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-gold/40 bg-obsidian px-4 py-3 text-sm font-semibold text-gold shadow-glow">
          {toast}
        </div>
      )}

      {modal && (
        <EncounterDialog
          modal={modal}
          bossHp={bossHp}
          maxBossHp={maxBossHp}
          bossName={theme.bossName}
          onClose={() => setModal(null)}
          onTalk={talkToNpc}
          onNpcTrialAnswer={answerNpcTrial}
          onQuest={attemptQuest}
          onBossAttack={attackBoss}
          onBossSealChallenge={challengeBossSeal}
          onBossTrialAnswer={answerBossSealTrial}
        />
      )}

      {completed && (
        <CompletionDialog
          realm={realmPayload}
          gameState={gameState}
          saving={saving}
          canPersist={canPersist}
          saveStatus={saveStatus}
          onClose={() => setCompleted(false)}
          onSave={() => void saveProgress(true)}
        />
      )}
    </main>
  );
}

function TileCell({
  tile,
  theme,
  isPlayer,
  firePhase,
}: {
  tile: Tile;
  theme: BiomeTheme;
  isPlayer: boolean;
  firePhase?: DragonFirePhase;
}) {
  const type = isPlayer ? "player" : tile.type;
  const icon = isPlayer ? "⚔️" : type === "boss" ? "\u{1F409}" : tile.icon;
  const className =
    type === "player"
      ? "tile-player border-gold bg-gold/20 text-gold"
      : type === "wall"
        ? `${theme.wallClass} text-stone`
        : type === "npc"
          ? "border-moss bg-moss/20 text-moss"
          : type === "quest"
            ? "tile-quest border-accent-primary/70 bg-accent-primary/20 text-parchment"
            : type === "artifact"
              ? "tile-artifact border-gold/60 bg-gold/30 text-gold"
              : type === "danger"
                ? "tile-danger border-ember/70 bg-ember/20 text-ember"
              : type === "boss"
                ? "tile-boss border-ember bg-ember/20 text-ember"
                : type === "exit"
                  ? "border-accent-secondary/70 bg-accent-secondary/20 text-accent-secondary"
                  : `${theme.floorClass} border-white/5 text-stone`;

  const palette = (() => {
    if (theme.id === "neon") return { floor: "#11263c", wall: "#09101a", accent: "#ff4fd8", glow: "#25f3ff", line: "#6cf5ff" };
    if (theme.id === "underwater") return { floor: "#0c3340", wall: "#08252f", accent: "#38d6cf", glow: "#b8fff4", line: "#267a83" };
    if (theme.id === "volcanic") return { floor: "#351310", wall: "#210b0a", accent: "#ff6b35", glow: "#ffd166", line: "#8f3020" };
    if (theme.id === "citadel") return { floor: "#2a2430", wall: "#1d1823", accent: "#d4b06a", glow: "#f7ead2", line: "#8c6b3f" };
    if (theme.id === "desert") return { floor: "#3e2a14", wall: "#2a1b0f", accent: "#f0b34d", glow: "#ffd27a", line: "#8e6231" };
    if (theme.id === "cave") return { floor: "#1d1c25", wall: "#121119", accent: "#ff7a3d", glow: "#ffd166", line: "#714126" };
    return { floor: "#173322", wall: "#0f2016", accent: "#9be36a", glow: "#b7ffd1", line: "#335f46" };
  })();

  const backgroundImage = (() => {
    const shape =
      type === "wall"
        ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.wall}'/><path d='M0 12h40M0 24h40M0 36h40' stroke='${palette.line}' stroke-width='1' opacity='0.5'/>`
        : type === "boss"
          ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><circle cx='20' cy='20' r='11' fill='${palette.accent}' opacity='0.22'/><path d='M9 30 L20 8 L31 30 Z' fill='${palette.accent}' opacity='0.7'/>`
          : type === "quest"
            ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><rect x='8' y='8' width='24' height='24' rx='6' fill='${palette.accent}' opacity='0.16'/><path d='M20 9 L23 17 L31 17 L24 22 L27 30 L20 25 L13 30 L16 22 L9 17 L17 17 Z' fill='${palette.glow}'/>`
            : type === "artifact"
              ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><path d='M20 7 L30 20 L20 33 L10 20 Z' fill='${palette.glow}' opacity='0.82'/><path d='M20 11 L26 20 L20 29 L14 20 Z' fill='${palette.accent}' opacity='0.55'/>`
              : type === "npc"
                ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><circle cx='20' cy='15' r='6' fill='${palette.glow}' opacity='0.72'/><rect x='13' y='22' width='14' height='9' rx='4' fill='${palette.accent}' opacity='0.55'/>`
                : type === "exit"
                  ? `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><rect x='11' y='8' width='18' height='24' rx='3' fill='${palette.accent}' opacity='0.28'/><rect x='15' y='11' width='10' height='18' rx='2' fill='${palette.glow}' opacity='0.3'/>`
                  : `<rect x='0' y='0' width='40' height='40' rx='4' fill='${palette.floor}'/><path d='M0 31 Q20 25 40 31' stroke='${palette.line}' stroke-width='1' opacity='0.4'/><circle cx='32' cy='8' r='2' fill='${palette.glow}' opacity='0.5'/>`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${shape}</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  })();

  return (
    <div
      className={`relative flex h-10 w-10 select-none items-center justify-center overflow-hidden rounded-sm border text-lg transition hover:shadow-glow ${className} ${
        firePhase === "warning" ? "tile-fire-warning" : firePhase === "burning" ? "tile-fire-burning" : ""
      }`}
      title={type === "boss" ? `${theme.bossName} - realm dragon` : tile.asset?.name ?? tile.type}
      style={{ backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <span className="relative z-10">{icon}</span>
      {firePhase && (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-xl" aria-hidden>
          {firePhase === "burning" ? "\u{1F525}" : "!"}
        </span>
      )}
    </div>
  );
}

function EncounterDialog(props: {
  modal: EncounterModal;
  bossHp: number;
  maxBossHp: number;
  bossName: string;
  onClose: () => void;
  onTalk: (asset: RealmAsset) => void;
  onNpcTrialAnswer: (asset: RealmAsset, question: RealmTrialQuestion, answer: string) => void;
  onQuest: (asset: RealmAsset) => void;
  onBossAttack: () => void;
  onBossSealChallenge: () => void;
  onBossTrialAnswer: (question: RealmTrialQuestion, answer: string) => void;
}) {
  const { modal } = props;
  const title = modal.type === "boss" ? props.bossName : modal.asset.name;
  const description = modal.type === "boss" ? "A realm boss bars the path to completion. Strike, endure, and force open the exit." : modal.asset.description;
  const result = modal.result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-lg rounded-md border border-white/10 bg-obsidian p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          {modal.type === "boss" ? <Swords className="h-5 w-5 text-ember" /> : <Sparkles className="h-5 w-5 text-gold" />}
          <h2 className="text-2xl font-black text-parchment">{title}</h2>
        </div>
        <p className="text-sm leading-6 text-stone">{description}</p>
        {modal.type === "npc" && modal.loading && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-parchment">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
            Querying live 0G Compute memory...
          </div>
        )}
        {result && <p className="mt-4 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-parchment">{result}</p>}
        {"trialFeedback" in modal && modal.trialFeedback && (
          <p className="mt-4 rounded-md border border-gold/20 bg-gold/5 p-3 text-sm text-stone">{modal.trialFeedback}</p>
        )}

        {modal.type === "npc" && modal.question && (
          <div className="mt-5 space-y-3 rounded-md border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Prism Trial</p>
            <p className="text-sm text-parchment">{modal.question.prompt}</p>
            <p className="text-xs text-stone">Hint: {modal.question.loreHint}</p>
            <div className="space-y-2">
              {modal.question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => props.onNpcTrialAnswer(modal.asset, modal.question!, option)}
                  disabled={modal.trialResolved || modal.loading}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-parchment transition hover:border-gold/40 disabled:opacity-60"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {modal.type === "boss" && (
          <div className="mt-5 space-y-2">
            <div className="flex justify-between font-mono text-xs text-stone">
              <span>Boss HP</span>
              <span>{props.bossHp}/{props.maxBossHp}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-ember transition-all" style={{ width: `${Math.max(0, (props.bossHp / props.maxBossHp) * 100)}%` }} />
            </div>
          </div>
        )}

        {modal.type === "boss" && modal.question && (
          <div className="mt-5 space-y-3 rounded-md border border-ember/25 bg-ember/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ember">Memory Seal Trial</p>
            <p className="text-sm text-parchment">{modal.question.prompt}</p>
            <p className="text-xs text-stone">Hint: {modal.question.loreHint}</p>
            <div className="space-y-2">
              {modal.question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => props.onBossTrialAnswer(modal.question!, option)}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-parchment transition hover:border-ember/40"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {modal.type === "npc" && (
            <button onClick={() => props.onTalk(modal.asset)} className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian">
              <MessageSquare className="mr-2 inline h-4 w-4" />
              Talk
            </button>
          )}
          {modal.type === "quest" && (
            <button onClick={() => props.onQuest(modal.asset)} className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian">
              Attempt Quest
            </button>
          )}
          {modal.type === "boss" && (
            <>
              <button onClick={props.onBossAttack} className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-obsidian">
                Attack Boss
              </button>
              {!modal.question && (
                <button onClick={props.onBossSealChallenge} className="rounded-lg border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold">
                  Challenge Armor Seal
                </button>
              )}
            </>
          )}
          <button onClick={props.onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-semibold text-parchment">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CompletionDialog(props: {
  realm: RealmPayload;
  gameState: GameState;
  saving: boolean;
  canPersist: boolean;
  saveStatus: string;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-2xl rounded-md border border-gold/30 bg-obsidian p-6 shadow-glow">
        <div className="mb-4 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-gold" />
          <h2 className="text-3xl font-black text-parchment">Realm Complete</h2>
        </div>
        <p className="text-sm leading-6 text-stone">{props.realm.title} has been cleared and can now be recorded as a clan evolution.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Metric icon={Heart} label="HP" value={`${props.gameState.hp}/${props.gameState.maxHp}`} />
          <Metric icon={Sparkles} label="XP" value={String(props.gameState.xp)} />
          <Metric icon={Coins} label="Gold" value={String(props.gameState.gold)} />
          <Metric icon={Package} label="Artifacts" value={String(props.gameState.inventory.length)} />
        </div>
        {props.saveStatus && <p className="mt-4 break-words rounded-md border border-white/10 bg-black/25 p-3 font-mono text-xs text-parchment">{props.saveStatus}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={props.onSave}
            disabled={props.saving || !props.canPersist}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian disabled:opacity-60"
          >
            {props.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
            Save and record on-chain
          </button>
          <button onClick={props.onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-semibold text-parchment">
            Return to realm
          </button>
        </div>
      </motion.div>
    </div>
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

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-3 last:border-b-0">
      <p className="text-xs uppercase text-stone">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-parchment">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <Icon className="mb-2 h-4 w-4 text-gold" />
      <p className="text-xs uppercase text-stone">{label}</p>
      <p className="mt-1 font-mono text-sm text-parchment">{value}</p>
    </div>
  );
}
