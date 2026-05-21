import type { Hex } from "viem";

/** 0G network preset name shared with @foundryprotocol/0gkit-core. */
export type FoundryNetwork = "aristotle" | "galileo";

/** Shape mirrored from @0gclawforge/sdk to keep the bridge a drop-in. */
export interface ClawForgeStorageConfig {
  rpcUrl: string;
  indexerUrl: string;
  privateKey?: string;
}

export interface ClawForgeComputeConfig {
  rpcUrl: string;
  privateKey: string;
  providerAddress: string;
}

/** Result of a DA publish for a clan event. */
export interface ClanDigestPublishResult {
  /** keccak256 of the canonical-JSON encoded payload — the on-chain anchor. */
  digest: Hex;
  /** DA reference returned by the encoder, when running in "live" mode. */
  daRef?: string;
  /** DA blob id (when the encoder returns one). */
  blobId?: string;
  /** "live" when the encoder accepted the blob; "local" when it was digested only. */
  mode: "live" | "local";
  /** Round-trip latency for the publish call, in milliseconds. */
  latencyMs: number;
}

/** Kinds of clan events anchored to 0G DA. */
export type ClanEventKind =
  | "clan.quest.outcome"
  | "clan.vote.tally"
  | "clan.realm.snapshot"
  | "clan.evolution.record"
  | "clan.memory.delta";

/** The canonical envelope shape published to 0G DA for clan events. */
export interface ClanEventEnvelope {
  kind: ClanEventKind;
  /** AgentINFT tokenId — string to survive JSON without precision loss. */
  tokenId: string;
  /** Unix millis. */
  timestamp: number;
  /** Free-form, schema-by-kind payload (validated by callers). */
  payload: unknown;
  /** Optional pointer to the upstream 0G Storage root for the full blob. */
  storageRoot?: string;
}

/** Resolution of a Foundry network preset (network + overrides). */
export interface FoundryEnv {
  network: FoundryNetwork;
  rpcUrl: string;
  indexerUrl: string;
  chainId: number;
  daEncoderUrl?: string;
  daApiKey?: string;
  privateKey?: string;
  computeProvider?: string;
  agentInftAddress?: string;
  marketplaceAddress?: string;
}
