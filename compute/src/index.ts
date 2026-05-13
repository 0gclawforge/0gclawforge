import { ZGComputeClient } from "@0gclawforge/sdk";
import type { ComputeConfig, ComputeQueryOptions } from "@0gclawforge/sdk";

export interface VerifiableInferenceResult {
  readonly text: string;
  readonly verified: boolean;
  readonly providerAddress: string;
  readonly attestation: {
    readonly mode: "0g-tee";
    readonly issuedAt: number;
  };
}

/**
 * A typed guardrail around 0G Compute. Every agent-facing call returns the
 * verification status required by the MVP instead of exposing raw model text.
 */
export class VerifiableInference {
  private readonly client: ZGComputeClient;

  constructor(config: ComputeConfig) {
    this.client = new ZGComputeClient(config);
  }

  async run(prompt: string, options: ComputeQueryOptions = {}): Promise<VerifiableInferenceResult> {
    const result = await this.client.query(prompt, options);
    return {
      ...result,
      attestation: {
        mode: "0g-tee",
        issuedAt: Date.now(),
      },
    };
  }

  async evolveClan(clanName: string, proposal: string, memoryContext: string): Promise<VerifiableInferenceResult> {
    return this.run(
      `Evolve the Eternal Clans civilization named "${clanName}" from this approved community proposal: ${proposal}\n\nPermanent memory context:\n${memoryContext}`,
      {
        systemPrompt:
          "You are an OpenClaw clan evolution swarm running through verified 0G TEE inference. Return concise JSON-friendly world updates.",
        temperature: 0.35,
        maxTokens: 900,
      }
    );
  }
}
