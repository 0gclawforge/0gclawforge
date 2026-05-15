export interface StorageConfig {
  rpcUrl: string;
  indexerUrl: string;
  privateKey?: string;
}

export interface ComputeConfig {
  rpcUrl: string;
  privateKey: string;
  providerAddress: string;
}

export interface UploadResult {
  rootHash: string;
  txHash: string;
}

export interface AgentMintParams {
  to: string;
  agentName: string;
  personality: string;
  modelType: string;
  metadataHash: string;
  storageURI: string;
}

export interface ClanMintParams extends AgentMintParams {
  memoryRootURI: string;
  realmRootURI: string;
}

export interface ClanState {
  memoryRootURI: string;
  realmRootURI: string;
  voteRootURI: string;
  realmCount: bigint;
  proposalCount: bigint;
  evolutionCount: bigint;
}

export interface AgentTransferParams {
  tokenId: number;
  to: string;
  newMetadataHash: string;
  newStorageURI: string;
  sealedKey: string;
  transferProof: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  embedding?: number[];
  tags: string[];
  timestamp: number;
  sessionId: string;
  importance: number;
}

export interface MemoryIndex {
  agentId: string;
  version: number;
  entries: MemoryEntry[];
  storageRootHash: string;
  lastUpdated: number;
  totalTokens: number;
}

export interface ComputeQueryOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface SwarmResult {
  supervisorPlan: string;
  workerResults: string[];
  synthesis: string;
}
