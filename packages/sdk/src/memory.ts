import { uploadJSON, downloadFromStorage } from "./storage";
import type { StorageConfig, MemoryEntry, MemoryIndex } from "./types";

export class MemoryEngine {
  private storageConfig: StorageConfig;

  constructor(storageConfig: StorageConfig) {
    this.storageConfig = storageConfig;
  }

  async loadMemory(rootHash: string): Promise<MemoryIndex | null> {
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { readFile, rm } = await import("node:fs/promises");
    const tmpPath = join(tmpdir(), `0gclawforge-memory-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    try {
      await downloadFromStorage(rootHash, tmpPath, this.storageConfig);
      const data = await readFile(tmpPath, "utf8");
      return this.normalizeStoredMemory(JSON.parse(data), rootHash);
    } catch {
      return null;
    } finally {
      await rm(tmpPath, { force: true });
    }
  }

  private normalizeStoredMemory(value: unknown, rootHash: string): MemoryIndex {
    const stored = value as Partial<MemoryIndex> & {
      kind?: string;
      createdAt?: number;
      payload?: unknown;
    };
    if (Array.isArray(stored.entries)) {
      return stored as MemoryIndex;
    }

    const strings: Array<{ path: string; content: string }> = [];
    const seen = new Set<string>();
    const ignoredKeys = new Set(["tiles", "palette", "storageRootHash", "rootHash", "txHash", "metadataHash"]);

    const visit = (node: unknown, path: string, depth: number) => {
      if (strings.length >= 40 || depth > 5 || node == null) return;
      if (typeof node === "string") {
        const content = node.replace(/\s+/g, " ").trim();
        if (content.length < 12 || seen.has(content) || /^0x[a-f0-9]{32,}$/i.test(content)) return;
        seen.add(content);
        strings.push({ path, content: content.slice(0, 1200) });
        return;
      }
      if (Array.isArray(node)) {
        node.slice(0, 20).forEach((entry, index) => visit(entry, `${path}.${index}`, depth + 1));
        return;
      }
      if (typeof node === "object") {
        Object.entries(node as Record<string, unknown>).forEach(([key, entry]) => {
          if (!ignoredKeys.has(key)) visit(entry, path ? `${path}.${key}` : key, depth + 1);
        });
      }
    };

    visit(stored.payload ?? stored, "", 0);
    const timestamp = Number(stored.createdAt || Date.now());
    const kind = stored.kind || "legacy-memory";
    const entries: MemoryEntry[] = strings.map(({ path, content }, index) => ({
      id: `legacy_${rootHash.slice(2, 12)}_${index}`,
      agentId: "legacy-clan",
      content: `${path ? `${path}: ` : ""}${content}`,
      tags: ["legacy-memory", kind, path.split(".").filter(Boolean).slice(-1)[0] || "record"],
      sessionId: rootHash,
      importance: path.includes("proposal") || path.includes("outcome") ? 0.85 : 0.65,
      timestamp,
    }));

    return {
      agentId: "legacy-clan",
      version: 1,
      entries,
      storageRootHash: rootHash,
      lastUpdated: timestamp,
      totalTokens: entries.reduce((sum, entry) => sum + Math.ceil(entry.content.length / 4), 0),
    };
  }

  async appendMemory(
    currentRootHash: string | null,
    agentId: string,
    entry: Omit<MemoryEntry, "id" | "timestamp">
  ): Promise<{ rootHash: string; memorySize: number }> {
    let index: MemoryIndex = currentRootHash
      ? ((await this.loadMemory(currentRootHash)) ?? this.createEmptyIndex(agentId))
      : this.createEmptyIndex(agentId);

    // Guard against stored indexes with missing or corrupted entries
    if (!Array.isArray(index.entries)) {
      index.entries = [];
    }

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
    if (!index || !Array.isArray(index.entries) || index.entries.length === 0) return [];

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
