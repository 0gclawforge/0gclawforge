"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Coins,
  Crown,
  DoorOpen,
  Heart,
  Loader2,
  Package,
  Save,
  ScrollText,
  ShieldCheck,
  Sparkles,
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
  const biome = realm.assets.find((asset) => asset.type === "biome");
  const text = `${realm.title} ${realm.lore} ${biome?.name ?? ""} ${biome?.description ?? ""}`.toLowerCase();

  if (/(desert|dune|sand|oasis|cactus|sun)/.test(text)) return themes.desert;
  if (/(cave|dungeon|stone|crypt|lava|vault|ember|under)/.test(text)) return themes.cave;
  if (/(forest|grove|moss|tree|root|moonlit|wood|wild)/.test(text)) return themes.forest;
  return themes.default;
}

function generateMap(realm: RealmPayload) {
  const theme = selectTheme(realm);
  const random = mulberry32(hashSeed(`${realm.tokenId}:${realm.title}:${realm.lore}`));
  const layout = realm.layout ?? {
    style: "grove" as const,
    wallDensity: 0.08,
    landmarkIcons: theme.decorationIcons,
    bossIcon: "🐉",
  };
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

  return { grid, theme };
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
  return {
    playerPos: PLAYER_SPAWN,
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

  const clanState = normalizeClanState(chainStateData) ?? apiClanState;
  const realmPayload = realm?.payload ?? null;
  const maxBossHp = bossMaxHp(realmPayload);
  const isOwner = Boolean(
    address && ownerAddress && String(ownerAddress).toLowerCase() === address.toLowerCase()
  );
  const canPersist = isConnected && isOwner && !forcedSpectator;

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
    setGameState(initialGameState(realmPayload));
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
    const firstConversation = !gameState?.npcsSpoken.includes(asset.name);
    const dialogue = firstConversation
      ? `${asset.name}: ${asset.description} You feel a pulse of remembered history.`
      : `${asset.name}: We have already spoken, but the memory remains.`;

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
    setModal((current) => (current && current.type === "npc" ? { ...current, result: dialogue } : current));
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
              playerPos: PLAYER_SPAWN,
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
      const response = await fetch(`/api/realm/${tokenId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveProgress", tokenId, progress }),
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,680px)_1fr]">
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

            <Panel title="Game Log" icon={ScrollText}>
              <div className="fantasy-scrollbar max-h-44 space-y-2 overflow-y-auto pr-2 font-mono text-xs leading-5 text-stone">
                {gameState.gameLog.map((entry, index) => (
                  <p key={`${entry}-${index}`}>&gt; {entry}</p>
                ))}
              </div>
              <p className="text-xs text-stone">WASD or arrow keys move. Space interacts with the tile beneath you.</p>
            </Panel>
          </div>

          <aside className="space-y-5">
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
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => movePlayer(0, -1)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-parchment">
                  North
                </button>
                <button onClick={() => movePlayer(0, 1)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-parchment">
                  South
                </button>
                <button onClick={() => movePlayer(-1, 0)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-parchment">
                  West
                </button>
                <button onClick={() => movePlayer(1, 0)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-parchment">
                  East
                </button>
              </div>
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

  return (
    <div
      className={`flex h-10 w-10 select-none items-center justify-center rounded-sm border text-lg transition hover:shadow-glow ${className}`}
      title={tile.asset?.name ?? tile.type}
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
