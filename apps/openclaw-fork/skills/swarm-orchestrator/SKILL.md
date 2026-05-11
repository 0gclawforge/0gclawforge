# Swarm Orchestrator Skill

Coordinate supervisor + worker agent swarms on 0G Compute.

## Triggers
- "run a swarm on *"
- "launch * agents to *"
- "coordinate agents to *"
- "spawn workers for *"

## Pattern: MapReduce for AI
1. Supervisor decomposes task into N sub-tasks (via 0G Compute)
2. N worker agents execute sub-tasks in parallel
3. Supervisor synthesizes worker outputs into final answer
4. Learnings written to each agent's 0G Storage memory

## Usage
```typescript
const client = new ZGComputeClient(computeConfig);
const result = await client.runSwarmTask(
  "Research the top DeFi protocols by TVL",
  3, // worker count
  "Focus on Ethereum mainnet"
);
// result.supervisorPlan, result.workerResults, result.synthesis
```

## Roles
- **Supervisor**: Task decomposition + synthesis
- **Worker**: Sub-task execution
