import { MemoryEngine } from "@0gclawforge/sdk";
import type { StorageConfig } from "@0gclawforge/sdk";

export async function recallMemory(
  query: string,
  rootHash: string,
  storageConfig: StorageConfig,
  topK: number = 5
) {
  const memory = new MemoryEngine(storageConfig);
  const entries = await memory.queryMemory(rootHash, query, topK);
  return { entries, count: entries.length };
}
