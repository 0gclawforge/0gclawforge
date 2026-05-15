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
  RealmApiResponse,
  RealmAsset,
  RealmPayload,
  RealmRecord,
  RealmVersionSummary,
  SaveProgressPayload,
  Tile,
} from "./types";

const MAP_SIZE = 16;
const PLAYER_SPAWN = { x: 8, y: 14 };
const EMPTY_TILE: Tile = { type: "floor", icon: "", passable: true };
const AUTONOMOUS_MODEL_NAME = "0GM-1.0-35B-A3B";
const AUTO_WORLD_INTERVAL_MS = 7_000;
const AUTO_DIRECTIVE_INTERVAL_MS = 35_000;

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
  if (/(castle|citadel|fortress|cathedral|throne)/.test(text)) return themes.citadel;
  if (/(desert|dune|sand|oasis|cactus|sun)/.test(text)) return themes.desert;
  if (/(cave|dungeon|stone|crypt|lava|vault|ember|under)/.test(text)) return themes.cave;
  if (/(forest|grove|moss|tree|root|moonlit|wood|wild)/.test(text)) return themes.forest;
  return themes.default;
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
            : cell.type === "exit" ? "🚪"
            : cell.type === "wall" ? theme.wallIcon
            : "",
        passable: cell.type !== "wall",
        asset: cell.assetName ? assetByName.get(cell.assetName) : undefined,
      }))
    );

    return {
      grid: explicitGrid,
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

  return { grid, theme, spawn: PLAYER_SPAWN };
}

function bossMaxHp(realm: RealmPayload | null) {
  return 32 + (realm?.assets.length ?? 0) * 6;
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
    playerPos: spawn,
    hp: 100,
    maxHp: 100,
    gold: 0,
    xp: 0,
    level: 1,
    inventory: [],
    questsCompleted: [],
    npcsSpoken: [],
    bossDefeated: false,
    gameLog: appendLog([], [`You entered ${realm.title}.`, "WASD or arrow keys move one tile at a time."]),
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

function autonomousQuestAsset(realm: RealmPayload, theme: BiomeTheme, index: number): RealmAsset {
  const names = ["Signal Patrol", "Memory Relay", "Border Rite", "Artifact Census", "Warden Errand"];
  const name = `${theme.name} ${names[index % names.length]} ${index + 1}`;
  return {
    type: "quest",
    name,
    description: `${AUTONOMOUS_MODEL_NAME} issued a small live objective for ${realm.title}. Watch the clan complete it without taking over your player.`,
  };
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
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "clan"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const [autoPulse, setAutoPulse] = useState("Idle");
  const autoTickRef = useRef(0);
  const gridRef = useRef<Tile[][] | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const realmPayloadRef = useRef<RealmPayload | null>(null);
  const themeRef = useRef<BiomeTheme>(themes.default);
  const completedRef = useRef(false);
  const autoPulseRef = useRef("Idle");

  const clanState = normalizeClanState(chainStateData) ?? apiClanState;
  const realmPayload = realm?.payload ?? null;
  const maxBossHp = bossMaxHp(realmPayload);
  const isOwner = Boolean(
    address && ownerAddress && String(ownerAddress).toLowerCase() === address.toLowerCase()
  );
  const canPersist = isConnected && isOwner && !forcedSpectator;

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
  }, [realmPayload]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addLog = useCallback((message: string | string[]) => {
    setGameState((state) => (state ? { ...state, gameLog: appendLog(state.gameLog, message) } : state));
  }, []);

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
          15,
          0,
          [`Collected artifact: ${asset.name}.`]
        );
      });
      replaceTile(x, y, { ...EMPTY_TILE });
      setToast(`${asset.name} added to inventory`);
    },
    [replaceTile]
  );

  const triggerInteraction = useCallback(
    (tile: Tile, x: number, y: number) => {
      if (tile.type === "npc" && tile.asset) setModal({ type: "npc", asset: tile.asset });
      if (tile.type === "quest" && tile.asset) setModal({ type: "quest", asset: tile.asset });
      if (tile.type === "artifact" && tile.asset) collectArtifact(tile.asset, x, y);
      if (tile.type === "boss") {
        setModal({
          type: "boss",
          result: "The boss challenges your clan. Attack to start combat. Defeating it opens the realm exit.",
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

      setGameState((state) => (state ? { ...state, playerPos: next } : state));
      triggerInteraction(tile, next.x, next.y);
    },
    [addLog, completed, gameState, grid, modal, triggerInteraction]
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
    if (!gameState) return;
    const firstConversation = !gameState.npcsSpoken.includes(asset.name);
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
            ? applyRewards(nextState, 10, 0, [dialogue])
            : { ...nextState, gameLog: appendLog(nextState.gameLog, dialogue) };
        });
        setToast(`Spoke with ${asset.name}`);
        setModal((current) => (current && current.type === "npc" ? { ...current, loading: false, result: dialogue } : current));
      } catch (error) {
        const fallback = `${asset.name}: ${asset.description} I can still guide you from local realm memory while live 0G Compute catches up.`;
        addLog(fallback);
        setModal((current) => (current && current.type === "npc" ? { ...current, loading: false, result: fallback } : current));
      } finally {
        clearTimeout(timeout);
      }
    })();
  };

  const attemptQuest = (asset: RealmAsset) => {
    if (!gameState) return;
    const roll = rollDie(20);
    const total = roll + gameState.level;

    if (total >= 12) {
      setGameState((state) => {
        if (!state || state.questsCompleted.includes(asset.name)) return state;
        return applyRewards(
          { ...state, questsCompleted: [...state.questsCompleted, asset.name] },
          25,
          20,
          [`Quest "${asset.name}" completed. Roll ${roll} + level ${state.level} = ${total}.`]
        );
      });
      const pos = gameState.playerPos;
      replaceTile(pos.x, pos.y, { ...EMPTY_TILE });
      setModal(null);
      return;
    }

    setGameState((state) => {
      if (!state) return state;
      const hp = Math.max(1, state.hp - 10);
      return {
        ...state,
        hp,
        gameLog: appendLog(state.gameLog, `Quest "${asset.name}" failed. Roll ${roll} + level ${state.level} = ${total}. Lose 10 HP.`),
      };
    });
    setModal({ type: "quest", asset, result: `Roll ${roll} + level ${gameState.level} = ${total}. DC 12 resisted you.` });
  };

  const attackBoss = () => {
    if (!gameState || !realmPayload) return;
    const roll = rollDie(20);
    const total = roll + gameState.level;
    const hit = total >= 8;
    const damage = hit ? 8 + rollDie(8) + gameState.level * 2 : 0;
    const nextBossHp = Math.max(0, bossHp - damage);
    const combatLog = hit
      ? [`You hit the boss for ${damage}. Roll ${roll} + level ${gameState.level} = ${total}.`]
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
          100,
          50,
          [...combatLog, `${theme.bossName} falls. The exit opens near the north gate.`]
        );
      });
      setModal(null);
      setToast("Boss defeated. Exit opened.");
      return;
    }

    const bossDamage = 3 + rollDie(6) + Math.max(0, Math.floor((realmPayload.assets.length - 2) / 3));
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
  }, [addLog, pushAutoLog]);

  const saveProgress = async (markCompleted: boolean) => {
    if (!gameState || !realmPayload || !address || !contractAddress || tokenIdBig === undefined) return;
    if (!canPersist) {
      setSaveStatus("Spectator mode can explore, but only the clan owner can persist progress.");
      return;
    }

    setSaving(true);
    setSaveStatus("Saving progress to 0G Storage...");

    const progress: SaveProgressPayload = {
      completed: markCompleted,
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
      const payload = (await response.json()) as { progressRootHash?: string; storageTxHash?: string; error?: string };
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
        setSaveStatus(`Progress saved to 0G Storage: ${payload.progressRootHash}`);
        addLog("Progress saved to 0G Storage.");
      }
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Progress save failed");
    } finally {
      setSaving(false);
    }
  };

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
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-stone transition hover:text-parchment">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </a>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">{theme.name} Tile Realm</p>
            <h1 className="mt-1 text-2xl font-black text-parchment md:text-4xl">{realmPayload.title}</h1>
          </div>
          <div className="flex items-center justify-center gap-3 text-sm text-stone">
            <Crown className="h-4 w-4 text-gold" />
            Clan #{tokenId}
            <span className="rounded border border-white/10 px-2 py-1 text-xs text-parchment">
              {canPersist ? "Owner Save" : "Spectator"}
            </span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,680px)_1fr]">
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-md border border-white/10 bg-black/35 p-4 shadow-2xl shadow-black/40">
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
                  <li>Failing quests costs HP, so start with nearby NPCs and artifacts first.</li>
                </ul>
              </div>
            </Panel>

            <Panel title="Stats" icon={Heart}>
              <StateRow label="HP" value={`${gameState.hp}/${gameState.maxHp}`} />
              <StateRow label="Level" value={String(gameState.level)} />
              <StateRow label="XP" value={`${gameState.xp}/100`} />
              <StateRow label="Gold" value={String(gameState.gold)} />
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
                  ? "Manual saves persist progress to 0G Storage without a wallet transaction. Only the final completion flow records an on-chain clan evolution."
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
                  ? "The clan is acting on its own: NPCs patrol, micro-quests resolve, and realm tiles shift while 0G Compute supplies periodic direction."
                  : "Let the clan act without taking over your player. World changes run locally with 0G Compute directives when available."}
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
          onQuest={attemptQuest}
          onBossAttack={attackBoss}
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

function TileCell({ tile, theme, isPlayer }: { tile: Tile; theme: BiomeTheme; isPlayer: boolean }) {
  const type = isPlayer ? "player" : tile.type;
  const icon = isPlayer ? "⚔️" : tile.icon;
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
              : type === "boss"
                ? "tile-boss border-ember bg-ember/20 text-ember"
                : type === "exit"
                  ? "border-accent-secondary/70 bg-accent-secondary/20 text-accent-secondary"
                  : `${theme.floorClass} border-white/5 text-stone`;

  const palette = (() => {
    if (theme.id === "neon") return { floor: "#11263c", wall: "#09101a", accent: "#ff4fd8", glow: "#25f3ff", line: "#6cf5ff" };
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
      className={`flex h-10 w-10 select-none items-center justify-center rounded-sm border text-lg transition hover:shadow-glow ${className}`}
      title={tile.asset?.name ?? tile.type}
      style={{ backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {icon}
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
  onQuest: (asset: RealmAsset) => void;
  onBossAttack: () => void;
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
            <button onClick={props.onBossAttack} className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-obsidian">
              Attack
            </button>
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
