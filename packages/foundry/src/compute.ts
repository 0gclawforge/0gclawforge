import { Compute as KitCompute, type ChatMessage } from "@foundryprotocol/0gkit-compute";
import type { ClawForgeComputeConfig } from "./types";
import { resolveFoundryEnv } from "./env";

export interface FoundryInferenceOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface FoundryInferenceResult {
  text: string;
  /** Echoed back so callers can pin the next call to the same provider. */
  providerAddress: string;
  /** Provider-reported verification status from the broker, when available. */
  verified: boolean;
  /** Raw upstream response, unparsed — for callers that want everything. */
  raw: unknown;
}

/**
 * 0G Compute client built on @foundryprotocol/0gkit-compute. Matches the
 * `query`/`stop` surface of @0gclawforge/sdk ZGComputeClient so it can be
 * swapped in. Auto-funding/provider acknowledgement is handled by 0gkit.
 */
export class FoundryCompute {
  private readonly inner: KitCompute;
  readonly providerAddress: string;

  constructor(config: ClawForgeComputeConfig) {
    if (!config.privateKey) {
      throw new Error("FoundryCompute requires a privateKey");
    }
    const env = resolveFoundryEnv({
      rpcUrl: config.rpcUrl,
      privateKey: config.privateKey,
      computeProvider: config.providerAddress,
    });
    this.providerAddress = config.providerAddress;
    this.inner = new KitCompute({
      network: env.network,
      brokerRpc: env.rpcUrl,
      brokerKey: env.privateKey!,
      provider: config.providerAddress,
    });
  }

  async query(userMessage: string, options: FoundryInferenceOptions = {}): Promise<FoundryInferenceResult> {
    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    const result = await this.inner.inference({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
    });

    return {
      text: result.output,
      providerAddress: this.providerAddress,
      verified: result.receipt.attestation === undefined ? true : Boolean(result.receipt.attestation),
      raw: result.raw,
    };
  }

  /** OpenAI-compatible shim — useful for code that already speaks `openai`. */
  openai() {
    return this.inner.openai();
  }
}
