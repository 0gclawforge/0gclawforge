import { Compute as KitCompute, type ChatMessage } from "@foundryprotocol/0gkit-compute";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import type { ComputeConfig, ComputeQueryOptions, SwarmResult } from "./types";

type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

type ProviderService = {
  provider?: string;
  serviceType?: string;
  teeSignerAcknowledged?: boolean;
  [index: number]: unknown;
};

/**
 * ZGComputeClient — same surface as the original (init / listServices /
 * setupProvider / query / stop / runSwarmTask) but the broker lifecycle,
 * acknowledge-signer, ledger init, and request-headers work is delegated
 * to @foundryprotocol/0gkit-compute.
 *
 * The provider-discovery + multi-provider retry behavior unique to
 * 0GClawForge is preserved on top.
 */
export class ZGComputeClient {
  private kit: KitCompute | null = null;
  private broker: Broker | null = null;
  private config: ComputeConfig;
  private providerReady = new Set<string>();

  /** Bytes the broker returned in the last verification response, if any. */
  public lastAttestation: { providerAddress: string; verified: boolean } | null = null;

  constructor(config: ComputeConfig) {
    this.config = config;
  }

  private kitFor(provider: string): KitCompute {
    return new KitCompute({
      network: this.config.rpcUrl.includes("evmrpc.0g.ai") && !this.config.rpcUrl.includes("testnet")
        ? "aristotle"
        : "galileo",
      brokerRpc: this.config.rpcUrl,
      brokerKey: this.config.privateKey,
      provider,
    });
  }

  async init(): Promise<void> {
    if (this.kit) return;
    this.kit = this.kitFor(this.config.providerAddress);
    const raw = await this.kit.raw();
    // 0gkit exposes `inference` only; obtain the full broker for `ledger`.
    // This is the one place we still touch the broker directly — the
    // ledger/balance check semantics are clawforge-specific.
    if (!this.broker) {
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const wallet = new ethers.Wallet(this.config.privateKey, provider);
      this.broker = await createZGComputeNetworkBroker(wallet);
    }
    void raw;
  }

  async listServices() {
    await this.init();
    return await this.broker!.inference.listService();
  }

  async setupProvider(providerAddress: string, fundAmountOG: number = 1): Promise<void> {
    const providerKey = providerAddress.toLowerCase();
    if (this.providerReady.has(providerKey)) return;
    await this.init();

    // Same ledger init + auto-funding semantics as before. Kept as-is
    // because 0gkit does not yet surface ledger management.
    let hasLedger = false;
    try {
      const ledger = await this.broker!.ledger.getLedger();
      hasLedger = Boolean(ledger);
    } catch {
      hasLedger = false;
    }
    if (!hasLedger) {
      try {
        await this.broker!.ledger.addLedger(Math.max(3, fundAmountOG));
      } catch (e: unknown) {
        if (!isDuplicateSetupError(e)) throw e;
      }
    }
    try {
      await this.broker!.inference.acknowledgeProviderSigner(providerAddress);
    } catch (e: unknown) {
      if (!isDuplicateSetupError(e)) throw e;
    }
    let providerFunded = false;
    try {
      const balances = await this.broker!.ledger.getProvidersWithBalance("inference");
      providerFunded = balances.some(
        ([addr, balance]: [string, bigint, bigint]) =>
          addr.toLowerCase() === providerAddress.toLowerCase() && balance > BigInt(0),
      );
    } catch {
      // best-effort
    }
    if (!providerFunded) {
      const transferAmount = ethers.parseEther(fundAmountOG.toString());
      await this.broker!.ledger.transferFund(providerAddress, "inference", transferAmount);
    }
    try {
      await this.broker!.inference.startAutoFunding(providerAddress, {
        interval: 30_000,
        bufferMultiplier: 2,
      });
    } catch {
      // auto-funding is a latency optimization
    }
    this.providerReady.add(providerKey);
  }

  private async getProviderCandidates(): Promise<string[]> {
    await this.init();
    const candidates = new Set<string>();
    if (this.config.providerAddress) candidates.add(this.config.providerAddress);
    try {
      const services = (await this.broker!.inference.listService(0, 50, true)) as ProviderService[];
      for (const service of services) {
        const provider = service.provider ?? service[0];
        if (typeof provider !== "string" || !provider.startsWith("0x")) continue;
        const serviceType = service.serviceType ?? service[1];
        if (typeof serviceType === "string" && serviceType && serviceType !== "inference") continue;
        candidates.add(provider);
      }
    } catch {
      // best-effort discovery
    }
    return [...candidates];
  }

  async query(
    userMessage: string,
    options: ComputeQueryOptions = {},
  ): Promise<{ text: string; verified: boolean; providerAddress: string }> {
    await this.init();
    const providers = await this.getProviderCandidates();
    const errors: string[] = [];

    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    for (const providerAddress of providers) {
      try {
        await this.setupProvider(providerAddress);
        const kit = this.kitFor(providerAddress);
        const result = await kit.inference({
          messages,
          temperature: options.temperature ?? 0.7,
        });

        const text = postProcessReasoning(result.output);
        if (!text.trim()) throw new Error("Provider returned an empty completion");

        const verified = result.receipt.attestation === undefined ? true : Boolean(result.receipt.attestation);
        this.lastAttestation = { providerAddress, verified };
        return { text, verified, providerAddress };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider error";
        errors.push(`${providerAddress}: ${message}`);
      }
    }

    throw new Error(`0G Compute failed across ${providers.length} provider(s): ${errors.join(" | ")}`);
  }

  async stop(): Promise<void> {
    if (!this.broker) return;
    for (const providerAddress of this.providerReady) {
      try {
        this.broker.inference.stopAutoFunding(providerAddress);
      } catch {
        // no-op
      }
    }
  }

  async runSwarmTask(
    supervisorPrompt: string,
    workerCount: number = 3,
    taskContext: string = "",
  ): Promise<SwarmResult> {
    const supervisorResult = await this.query(
      `You are a supervisor agent. Break down this task into ${workerCount} parallel sub-tasks. Respond with a JSON array of sub-task descriptions only.\n\nTask: ${supervisorPrompt}\n\nContext: ${taskContext}`,
      {
        systemPrompt:
          "You are a precise task decomposition supervisor. Output only valid JSON arrays.",
      },
    );

    let subTasks: string[];
    try {
      subTasks = JSON.parse(supervisorResult.text);
    } catch {
      subTasks = [supervisorPrompt];
    }

    const workerResults = await Promise.all(
      subTasks.slice(0, workerCount).map((task: string) =>
        this.query(task, {
          systemPrompt:
            "You are a specialized worker agent. Complete your assigned sub-task thoroughly.",
        }).then((r) => r.text),
      ),
    );

    const synthesis = await this.query(
      `Synthesize these worker results into a final coherent answer:\n${workerResults.map((r, i) => `Worker ${i + 1}: ${r}`).join("\n\n")}`,
      {
        systemPrompt:
          "You are a synthesis supervisor. Combine worker outputs into the best possible final answer.",
      },
    );

    return {
      supervisorPlan: supervisorResult.text,
      workerResults,
      synthesis: synthesis.text,
    };
  }
}

function isDuplicateSetupError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  return msg.includes("already") || msg.includes("exists") || msg.includes("duplicate");
}

/**
 * Some 0G inference providers return `reasoning_content` instead of a
 * regular completion. Strip the meta-commentary so callers always get
 * clean prose. Same heuristic the original implementation used.
 */
function postProcessReasoning(raw: string): string {
  if (!raw) return raw;
  let text = raw;
  text = text.replace(/\n\s*(?:Count:|Checks?:|Check constraint)[\s\S]*$/i, "").trim();
  return text;
}
