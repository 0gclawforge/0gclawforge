import { uploadJSON, downloadFromStorage } from "./storage";
import type { StorageConfig, MemoryEntry, MemoryIndex } from "./types";

export class MemoryEngine {
  private storageConfig: StorageConfig;

  constructor(storageConfig: StorageConfig) {
    this.storageConfig = storageConfig;
  }

  async loadMemory(rootHash: string): Promise<MemoryIndex | null> {
    try {
      const tmpPath = `/tmp/memory_${Date.now()}.json`;
      await downloadFromStorage(rootHash, tmpPath, this.storageConfig);
      const { readFileSync } = await import("fs");
      const data = readFileSync(tmpPath, "utf-8");
      return JSON.parse(data) as MemoryIndex;
    } catch {
      return null;
    }
  }

  async appendMemory(
    currentRootHash: string | null,
    agentId: string,
    entry: Omit<MemoryEntry, "id" | "timestamp">
  ): Promise<{ rootHash: string; memorySize: number }> {
    let index: MemoryIndex = currentRootHash
      ? ((await this.loadMemory(currentRootHash)) ?? this.createEmptyIndex(agentId))
      : this.createEmptyIndex(agentId);

    const newEntry: MemoryEntry = {
      ...entry,
      id: `mem_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    index.entries.push(newEntry);
    index.version++;
    index.lastUpdated = Date.now();
    index.totalTokens = index.entries.reduce(
      (sum, e) => sum + Math.ceil(e.content.length / 4),
      0
    );

    if (index.entries.length > 500) {
      index.entries = this.pruneMemory(index.entries, 500);
    }

    const result = await uploadJSON(index, this.storageConfig);
    index.storageRootHash = result.rootHash;

    return {
      rootHash: result.rootHash,
      memorySize: new TextEncoder().encode(JSON.stringify(index)).length,
    };
  }

  async queryMemory(
    rootHash: string,
    query: string,
    topK: number = 5
  ): Promise<MemoryEntry[]> {
    const index = await this.loadMemory(rootHash);
    if (!index || index.entries.length === 0) return [];

    const keywords = query.toLowerCase().split(/\s+/);
    const scored = index.entries.map((entry) => {
      const text = entry.content.toLowerCase();
      const keywordScore = keywords.filter((kw) => text.includes(kw)).length;
      const recencyScore = entry.timestamp / Date.now();
      const importanceScore = entry.importance;
      return {
        entry,
        score: keywordScore * 0.6 + recencyScore * 0.2 + importanceScore * 0.2,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.entry);
  }

  async recordLearning(
    currentRootHash: string | null,
    agentId: string,
    taskDescription: string,
    outcome: string,
    sessionId: string
  ): Promise<{ rootHash: string; memorySize: number }> {
    return this.appendMemory(currentRootHash, agentId, {
      agentId,
      content: `TASK: ${taskDescription}\nOUTCOME: ${outcome}`,
      tags: ["learning", "task-completion"],
      sessionId,
      importance: 0.8,
    });
  }

  private createEmptyIndex(agentId: string): MemoryIndex {
    return {
      agentId,
      version: 0,
      entries: [],
      storageRootHash: "",
      lastUpdated: Date.now(),
      totalTokens: 0,
    };
  }

  private pruneMemory(entries: MemoryEntry[], maxCount: number): MemoryEntry[] {
    return entries
      .sort((a, b) => {
        const recencyA = a.timestamp / Date.now();
        const recencyB = b.timestamp / Date.now();
        return b.importance + recencyB - (a.importance + recencyA);
      })
      .slice(0, maxCount);
  }
}
