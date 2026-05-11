import { uploadAgentIntelligence, INFTClient } from "@0gclawforge/sdk";
import { ethers } from "ethers";
import type { StorageConfig } from "@0gclawforge/sdk";

export interface ForgeAgentInput {
  agentName: string;
  personality: string;
  modelType: string;
  capabilities: string[];
  skills: Record<string, unknown>;
  memorySeed: string;
}

export async function forgeAgent(
  input: ForgeAgentInput,
  storageConfig: StorageConfig,
  inftAddress: string,
  signer: ethers.Signer
) {
  const signerAddress = await signer.getAddress();

  // 1. Upload intelligence to 0G Storage
  const { storageURI, metadataHash } = await uploadAgentIntelligence(
    `agent_${Date.now()}`,
    {
      encryptedPersonality: Buffer.from(input.personality).toString("base64"),
      encryptedMemoryIndex: Buffer.from("{}").toString("base64"),
      encryptedSkills: Buffer.from(JSON.stringify(input.skills)).toString("base64"),
      publicSummary: `${input.agentName}: ${input.personality.slice(0, 100)}`,
      modelType: input.modelType,
      version: 1,
      timestamp: Date.now(),
    },
    storageConfig
  );

  // 2. Mint iNFT on 0G Chain
  const inft = new INFTClient(inftAddress, signer);
  const { tokenId, txHash } = await inft.mintAgent({
    to: signerAddress,
    agentName: input.agentName,
    personality: input.personality,
    modelType: input.modelType,
    metadataHash,
    storageURI,
  });

  return { tokenId, txHash, storageURI, metadataHash };
}
