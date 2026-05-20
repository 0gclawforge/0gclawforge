import { Storage as KitStorage } from "@foundryprotocol/0gkit-storage";
import { ethers } from "ethers";
import type { StorageConfig, UploadResult } from "./types";

function normalizeStorageRoot(rootHashOrUri: string): string {
  return rootHashOrUri.replace(/^0g:\/\//i, "").replace(/^zg:\/\//i, "").trim();
}

function clientFor(config: StorageConfig): KitStorage {
  return new KitStorage({
    network: pickNetwork(config),
    indexerUrl: config.indexerUrl,
    rpcUrl: config.rpcUrl,
    privateKey: config.privateKey,
  });
}

function pickNetwork(config: StorageConfig): "aristotle" | "galileo" {
  // The indexer URL is the strongest network signal; fall back to galileo.
  if (config.indexerUrl.includes("testnet")) return "galileo";
  if (config.indexerUrl.includes("turbo")) return "aristotle";
  return "galileo";
}

/**
 * Upload arbitrary bytes (string or Buffer) to 0G Storage.
 *
 * Internally delegates to @foundryprotocol/0gkit-storage so the gas-price
 * lookup, retry policy, and merkle-tree handling stay in one place and the
 * footprint here shrinks by ~80 lines.
 */
export async function uploadToStorage(
  data: Buffer | string,
  config: StorageConfig,
): Promise<UploadResult> {
  if (!config.privateKey) {
    throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  }
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  const result = await clientFor(config).upload(bytes);
  return {
    rootHash: result.root,
    txHash: typeof result.tx.txHash === "string" ? result.tx.txHash : "",
  };
}

export async function uploadJSON(
  obj: unknown,
  config: StorageConfig,
): Promise<UploadResult> {
  return uploadToStorage(JSON.stringify(obj, null, 2), config);
}

/**
 * Download by root hash and return the bytes directly. **Preferred over
 * `downloadFromStorage`** in serverless / edge environments (no fs writes).
 * Also avoids a /tmp round-trip on long-running servers.
 */
export async function downloadBytes(
  rootHashOrUri: string,
  config: StorageConfig,
): Promise<Uint8Array> {
  const rootHash = normalizeStorageRoot(rootHashOrUri);
  if (/^https?:\/\//i.test(rootHash)) {
    const response = await fetch(rootHash);
    if (!response.ok) {
      throw new Error(`0G Storage download failed: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  return clientFor(config).download(rootHash);
}

/** Convenience: download + decode + JSON.parse. */
export async function downloadJSON<T = unknown>(
  rootHashOrUri: string,
  config: StorageConfig,
): Promise<T> {
  const bytes = await downloadBytes(rootHashOrUri, config);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * Legacy filesystem download. Preserved for backwards compatibility with
 * existing call sites. New code should use `downloadBytes` /
 * `downloadJSON` — they work in serverless environments and avoid disk IO.
 */
export async function downloadFromStorage(
  rootHashOrUri: string,
  outputPath: string,
  config: StorageConfig,
): Promise<void> {
  const bytes = await downloadBytes(rootHashOrUri, config);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, bytes);
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
  config: StorageConfig,
): Promise<{ storageURI: string; metadataHash: string }> {
  const result = await uploadJSON(intelligenceBlob, config);
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(intelligenceBlob)),
  );
  return { storageURI: result.rootHash, metadataHash };
}
