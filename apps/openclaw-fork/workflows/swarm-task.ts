import { ZGComputeClient, MemoryEngine } from "@0gclawforge/sdk";
import type { ComputeConfig, StorageConfig } from "@0gclawforge/sdk";

export interface SwarmTaskInput {
  task: string;
  workerCount: number;
  agentIds: string[];
  context?: string;
}

export async function runSwarmTask(
  input: SwarmTaskInput,
  computeConfig: ComputeConfig,
  storageConfig: StorageConfig,
  memoryRootHashes: Record<string, string>
) {
  const compute = new ZGComputeClient(computeConfig);
  const memory = new MemoryEngine(storageConfig);

  // 1. Load relevant memories for context
  let contextFromMemory = "";
  for (const agentId of input.agentIds) {
    const rootHash = memoryRootHashes[agentId];
    if (rootHash) {
      const entries = await memory.queryMemory(rootHash, input.task, 3);
      contextFromMemory += entries.map((e) => e.content).join("\n");
    }
  }

  // 2. Run swarm task
  const result = await compute.runSwarmTask(
    input.task,
    input.workerCount,
    `${input.context || ""}\n\nPrior knowledge:\n${contextFromMemory}`
  );

  // 3. Record learnings for each agent
  const sessionId = `swarm_${Date.now()}`;
  const updatedHashes: Record<string, string> = {};

  for (const agentId of input.agentIds) {
    const currentHash = memoryRootHashes[agentId] || null;
    const { rootHash } = await memory.recordLearning(
      currentHash,
      agentId,
      input.task,
      result.synthesis,
      sessionId
    );
    updatedHashes[agentId] = rootHash;
  }

  return { ...result, updatedMemoryHashes: updatedHashes };
}
