import { MemoryEngine, INFTClient } from "@0gclawforge/sdk";
import { ethers } from "ethers";
import type { StorageConfig } from "@0gclawforge/sdk";

export async function selfImprove(
  tokenId: number,
  taskDescription: string,
  outcome: string,
  currentMemoryRootHash: string | null,
  storageConfig: StorageConfig,
  inftAddress: string,
  signer: ethers.Signer
) {
  const agentId = `agent_${tokenId}`;
  const sessionId = `improve_${Date.now()}`;
  const memory = new MemoryEngine(storageConfig);

  // 1. Record the learning
  const { rootHash, memorySize } = await memory.recordLearning(
    currentMemoryRootHash,
    agentId,
    taskDescription,
    outcome,
    sessionId
  );

  // 2. Update iNFT metadata on-chain
  const inft = new INFTClient(inftAddress, signer);
  const newMetadataHash = ethers.keccak256(ethers.toUtf8Bytes(rootHash));
  // Use mock proof for testnet
  const mockProof = "0x00";

  // Note: updateMetadata requires direct contract call
  // This would be called via the contract directly in production

  return { rootHash, memorySize, metadataHash: newMetadataHash };
}
