import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import type { StorageConfig, UploadResult } from "./types";

async function resolveUploadOptions(provider: ethers.JsonRpcProvider): Promise<{
  gasPrice?: bigint;
}> {
  try {
    const gasPriceHex = (await provider.send("eth_gasPrice", [])) as string | null;
    if (typeof gasPriceHex === "string" && gasPriceHex.startsWith("0x")) {
      return { gasPrice: BigInt(gasPriceHex) };
    }
  } catch {
    // Fall back to the SDK default fee lookup if the raw RPC call fails.
  }

  return {};
}

export async function uploadToStorage(
  data: Buffer | string,
  config: StorageConfig
): Promise<UploadResult> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.privateKey, provider);
  const indexer = new Indexer(config.indexerUrl);

  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  const memData = new MemData(bytes);
  const uploadOpts = await resolveUploadOptions(provider);

  const [tx, err] = await indexer.upload(memData, config.rpcUrl, signer, undefined, undefined, uploadOpts);
  if (err !== null) throw new Error(`0G Storage upload failed: ${err}`);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

  const rootHash = tree!.rootHash() ?? "";
  const txHash = typeof tx === "string" ? tx : (tx as any)?.txHash ?? "";
  return { rootHash, txHash };
}

export async function uploadJSON(
  obj: unknown,
  config: StorageConfig
): Promise<UploadResult> {
  return uploadToStorage(JSON.stringify(obj, null, 2), config);
}

export async function downloadFromStorage(
  rootHash: string,
  outputPath: string,
  config: StorageConfig
): Promise<void> {
  const indexer = new Indexer(config.indexerUrl);
  const err = await indexer.download(rootHash, outputPath, true);
  if (err !== null) throw new Error(`0G Storage download failed: ${err}`);
}

export async function uploadAgentIntelligence(
  agentId: string,
  intelligenceBlob: {
    encryptedPersonality: string;
    encryptedMemoryIndex: string;
    encryptedSkills: string;
    publicSummary: string;
    modelType: string;
    version: number;
    timestamp: number;
  },
  config: StorageConfig
): Promise<{ storageURI: string; metadataHash: string }> {
  const result = await uploadJSON(intelligenceBlob, config);
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(intelligenceBlob))
  );
  return { storageURI: result.rootHash, metadataHash };
}
