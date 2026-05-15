import type { Address } from "viem";

export type RealmAssetType = "biome" | "npc" | "quest" | "artifact";

export interface RealmAsset {
  type: RealmAssetType;
  name: string;
  description: string;
}

export interface RealmPayload {
  tokenId: string;
  prompt: string;
  title: string;
  lore: string;
  assets: RealmAsset[];
  version?: number;
  previousRealmRootURI?: string;
  visualTheme?: {
    id: "forest" | "desert" | "cave" | "neon" | "citadel" | "default";
    palette: {
      bg: string;
      floor: string;
      wall: string;
      accent: string;
      glow: string;
    };
    motifs: string[];
    tileStyle: "organic" | "ruin" | "cyber" | "royal";
  };
  map?: RealmMap;
  layout?: {
    style: "grove" | "labyrinth" | "corridor" | "sanctum";
    wallDensity: number;
    landmarkIcons: string[];
    bossIcon?: string;
  };
}

export interface RealmMap {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  boss: { x: number; y: number };
  exit?: { x: number; y: number };
  tiles: RealmMapTile[][];
}

export interface RealmMapTile {
  type: "wall" | "floor" | "npc" | "quest" | "artifact" | "boss" | "decoration" | "exit";
  assetName?: string;
  motif?: string;
}

export interface RealmRecord {
  kind: "ugc-realm";
  payload: RealmPayload;
  network?: {
    chainId: number;
    storageIndexer: string;
  };
  createdAt: number;
}

export interface ClanState {
  memoryRootURI: string;
  realmRootURI: string;
  voteRootURI: string;
  realmCount: number;
  proposalCount: number;
  evolutionCount: number;
}

export interface RealmApiResponse {
  realm: RealmRecord;
  clanState: ClanState;
  history?: RealmVersionSummary[];
}

export interface RealmVersionSummary {
  rootHash: string;
  title: string;
  createdAt: number;
  version: number;
  current: boolean;
}

export interface InventoryItem {
  name: string;
  description: string;
  type: string;
}

export interface GameState {
  playerPos: { x: number; y: number };
  hp: number;
  maxHp: number;
  gold: number;
  xp: number;
  level: number;
  inventory: InventoryItem[];
  questsCompleted: string[];
  npcsSpoken: string[];
  bossDefeated: boolean;
  gameLog: string[];
}

export type TileType = "wall" | "floor" | "npc" | "quest" | "artifact" | "boss" | "decoration" | "exit";

export interface Tile {
  type: TileType;
  icon: string;
  passable: boolean;
  asset?: RealmAsset;
}

export interface BiomeTheme {
  id: "forest" | "desert" | "cave" | "neon" | "citadel" | "default";
  name: string;
  floorClass: string;
  wallIcon: string;
  wallClass: string;
  decorationIcons: string[];
  npcIcon: string;
  bossName: string;
}

export type EncounterModal =
  | { type: "npc"; asset: RealmAsset; result?: string; loading?: boolean }
  | { type: "quest"; asset: RealmAsset; result?: string }
  | { type: "boss"; result?: string };

export interface SaveProgressPayload {
  completed: boolean;
  hp: number;
  xp: number;
  gold: number;
  level: number;
  inventory: InventoryItem[];
  questsCompleted: string[];
  bossDefeated: boolean;
  playerAddress: Address;
  completedAt?: number;
}

export interface NpcDialogueResponse {
  npcName: string;
  reply: string;
  memorySignal?: string;
}
