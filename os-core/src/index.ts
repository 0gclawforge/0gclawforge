import { VerifiableInference } from "@0gclawforge/compute";
import { OG_TESTNET } from "@0gclawforge/shared";
import { PermanentMemory } from "@0gclawforge/storage";
import type { ComputeConfig, StorageConfig } from "@0gclawforge/sdk";

export interface RuntimeNetworkConfig {
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly explorerUrl: string;
  readonly storageIndexer: string;
}

export interface ForgeRuntimeConfig {
  readonly network: RuntimeNetworkConfig;
  readonly storage: StorageConfig;
  readonly compute: ComputeConfig;
}

export interface ClanBlueprint {
  readonly name: string;
  readonly archetype: string;
  readonly members: readonly string[];
  readonly mission: string;
}

export interface ClanMintPlan {
  readonly blueprint: ClanBlueprint;
  readonly storageURI: string;
  readonly metadataHash: string;
  readonly memoryRootHash: string;
  readonly inferenceVerified: boolean;
}

const runtimeEnv = (): Record<string, string | undefined> => {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.process?.env ?? {};
};

const required = (value: string | undefined, fallback = ""): string => value ?? fallback;

export function loadRuntimeConfig(env: Record<string, string | undefined> = runtimeEnv()): ForgeRuntimeConfig {
  const rpcUrl = required(env.VITE_RPC_URL ?? env.NEXT_PUBLIC_OG_RPC_URL, OG_TESTNET.rpcUrl);
  const storageIndexer = required(env.VITE_STORAGE_INDEXER ?? env.OG_STORAGE_INDEXER_TURBO, OG_TESTNET.storageIndexer);
  const privateKey = required(env.PRIVATE_KEY);
  const providerAddress = required(
    env.OG_COMPUTE_PROVIDER_ADDR,
    "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08"
  );

  return {
    network: {
      chainId: Number(env.VITE_CHAIN_ID ?? env.NEXT_PUBLIC_OG_CHAIN_ID ?? OG_TESTNET.chainId),
      rpcUrl,
      explorerUrl: required(env.VITE_EXPLORER_URL ?? env.NEXT_PUBLIC_OG_EXPLORER, OG_TESTNET.explorer),
      storageIndexer,
    },
    storage: {
      rpcUrl,
      indexerUrl: storageIndexer,
      privateKey,
    },
    compute: {
      rpcUrl,
      privateKey,
      providerAddress,
    },
  };
}

/**
 * SovereignAgentOS composes permanent memory and verifiable inference into the
 * mint plan consumed by Eternal Clans and ERC-7857 contracts.
 */
export class SovereignAgentOS {
  readonly memory: PermanentMemory;
  readonly inference: VerifiableInference;

  constructor(readonly config: ForgeRuntimeConfig) {
    this.memory = new PermanentMemory(config.storage);
    this.inference = new VerifiableInference(config.compute);
  }

  async prepareClanMint(blueprint: ClanBlueprint): Promise<ClanMintPlan> {
    const memoryRoot = await this.memory.initializeClan(blueprint.name);
    const inference = await this.inference.run(
      `Create a compact sovereign clan intelligence summary for ${blueprint.name}: ${blueprint.mission}`,
      {
        systemPrompt:
          "You produce OpenClaw-compatible clan intelligence for a multi-agent ERC-7857 iNFT. Keep output concise.",
        temperature: 0.3,
        maxTokens: 600,
      }
    );
    const metadata = await this.memory.commitRecord("memory", blueprint.name, {
      blueprint,
      intelligence: inference.text,
      memoryRootHash: memoryRoot.rootHash,
    });

    return {
      blueprint,
      storageURI: metadata.rootHash,
      metadataHash: metadata.rootHash,
      memoryRootHash: memoryRoot.rootHash,
      inferenceVerified: inference.verified,
    };
  }
}
