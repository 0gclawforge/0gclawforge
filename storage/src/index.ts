import { MemoryEngine, uploadJSON } from "@0gclawforge/sdk";
import type { MemoryEntry, MemoryIndex, StorageConfig, UploadResult } from "@0gclawforge/sdk";

export interface PermanentRecord<TPayload> {
  readonly kind: "memory" | "realm" | "vote" | "evolution";
  readonly clanId: string;
  readonly payload: TPayload;
  readonly createdAt: number;
}

export interface ClanMemoryCommit {
  readonly rootHash: string;
  readonly memorySize: number;
  readonly entryId?: string;
}

/**
 * PermanentMemory wraps 0G Storage as the append-only memory/log layer for a clan.
 * It keeps the SDK primitive small while giving the OS layer a typed contract.
 */
export class PermanentMemory {
  private readonly engine: MemoryEngine;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.engine = new MemoryEngine(config);
  }

  async initializeClan(clanId: string): Promise<UploadResult> {
    const index: MemoryIndex = {
      agentId: clanId,
      version: 1,
      entries: [],
      storageRootHash: "",
      lastUpdated: Date.now(),
      totalTokens: 0,
    };
    return uploadJSON(index, this.config);
  }

  async appendClanMemory(
    currentRootHash: string | null,
    clanId: string,
    content: string,
    tags: string[],
    importance = 0.75
  ): Promise<ClanMemoryCommit> {
    const commit = await this.engine.appendMemory(currentRootHash, clanId, {
      agentId: clanId,
      content,
      tags,
      sessionId: `clan-${clanId}`,
      importance,
    });
    return commit;
  }

  async queryClanMemory(rootHash: string, query: string, topK = 5): Promise<MemoryEntry[]> {
    return this.engine.queryMemory(rootHash, query, topK);
  }

  async commitRecord<TPayload>(
    kind: PermanentRecord<TPayload>["kind"],
    clanId: string,
    payload: TPayload
  ): Promise<UploadResult> {
    return uploadJSON(
      {
        kind,
        clanId,
        payload,
        createdAt: Date.now(),
      } satisfies PermanentRecord<TPayload>,
      this.config
    );
  }
}
