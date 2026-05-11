export type { StorageConfig, ComputeConfig, UploadResult, AgentMintParams, AgentTransferParams, MemoryEntry, MemoryIndex, ComputeQueryOptions, SwarmResult } from "@0gclawforge/sdk";

export interface AgentCardData {
  tokenId: number;
  name: string;
  personality: string;
  modelType: string;
  capabilities: string[];
  taskCount: number;
  memorySize: number;
  owner: string;
  isListed: boolean;
  price?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface SwarmNode {
  id: string;
  type: "supervisor" | "worker";
  agentId: string;
  agentName: string;
  status: "idle" | "thinking" | "working" | "done" | "error";
  output?: string;
}

export interface SwarmEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export type ForgeStep = "identity" | "intelligence" | "mint" | "success";
