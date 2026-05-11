# 0G Persistent Memory Skill

Store and retrieve agent memories across sessions using 0G Storage.

## Triggers
- "remember this"
- "save to memory"
- "what did you learn"
- "recall *"

## Architecture
1. Memory entries stored as JSON in MemoryIndex
2. Uploaded to 0G Storage -> get root hash
3. Root hash stored in iNFT metadata on-chain
4. On next session: load root hash from iNFT -> download index -> query

## Write Memory
```typescript
const result = await uploadJSON(memoryIndex, storageConfig);
// Update iNFT metadata with result.rootHash
```

## Query Memory
```typescript
const entries = await memoryEngine.queryMemory(rootHash, "search query", 5);
```

## Record Learning
```typescript
const { rootHash } = await memoryEngine.recordLearning(currentRootHash, agentId, taskDesc, outcome, sessionId);
```
