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
  id: "forest" | "desert" | "cave" | "default";
  name: string;
  floorClass: string;
  wallIcon: string;
  wallClass: string;
  decorationIcons: string[];
  npcIcon: string;
  bossName: string;
}

export type EncounterModal =
  | { type: "npc"; asset: RealmAsset }
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
