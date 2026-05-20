import { Storage as KitStorage } from "@foundryprotocol/0gkit-storage";
import type { ClawForgeStorageConfig } from "./types.js";
import { resolveFoundryEnv } from "./env.js";

/**
 * Drop-in 0G Storage client built on @foundryprotocol/0gkit-storage. Accepts
 * the same ClawForge `StorageConfig` shape, so this can replace the
 * sdk/storage import in any call site without surface changes.
 */
export class FoundryStorage {
  private readonly inner: KitStorage;
  readonly config: ClawForgeStorageConfig;

  constructor(config: ClawForgeStorageConfig) {
    this.config = config;
    const env = resolveFoundryEnv({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.privateKey,
    });
    this.inner = new KitStorage({
      network: env.network,
      indexerUrl: env.indexerUrl,
      rpcUrl: env.rpcUrl,
      privateKey: env.privateKey,
    });
  }

  /** Upload arbitrary bytes. Returns the storage root + tx receipt. */
  async upload(data: Buffer | Uint8Array | string): Promise<{ rootHash: string; txHash: string }> {
    const bytes =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
          ? data
          : new Uint8Array(data);
    const result = await this.inner.upload(bytes);
    return {
      rootHash: result.root,
      txHash: typeof result.tx.txHash === "string" ? result.tx.txHash : "",
    };
  }

  /** Upload pretty-printed JSON; mirrors @0gclawforge/sdk uploadJSON. */
  async uploadJSON(value: unknown): Promise<{ rootHash: string; txHash: string }> {
    return this.upload(JSON.stringify(value, null, 2));
  }

  /** Download by root hash and return raw bytes. */
  async download(root: string): Promise<Uint8Array> {
    return this.inner.download(stripScheme(root));
  }

  /** Convenience: download + JSON.parse. */
  async downloadJSON<T = unknown>(root: string): Promise<T> {
    const bytes = await this.download(root);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }

  /** True when the indexer has a header for the root. False on transport errors. */
  async exists(root: string): Promise<boolean> {
    return this.inner.exists(stripScheme(root));
  }
}

function stripScheme(rootOrUri: string): string {
  return rootOrUri.replace(/^0g:\/\//i, "").replace(/^zg:\/\//i, "").trim();
}
