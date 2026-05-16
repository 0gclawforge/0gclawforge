import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import type { ComputeConfig, ComputeQueryOptions, SwarmResult } from "./types";

type ProviderService = {
  provider?: string;
  serviceType?: string;
  teeSignerAcknowledged?: boolean;
  [index: number]: unknown;
};

export class ZGComputeClient {
  private broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
  private config: ComputeConfig;
  private initialized = false;
  private providerReady = new Set<string>();

  constructor(config: ComputeConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    const wallet = new ethers.Wallet(this.config.privateKey, provider);
    this.broker = await createZGComputeNetworkBroker(wallet);
    this.initialized = true;
  }

  async listServices() {
    await this.init();
    return await this.broker!.inference.listService();
  }

  async setupProvider(
    providerAddress: string,
    fundAmountOG: number = 1
  ): Promise<void> {
    const providerKey = providerAddress.toLowerCase();
    if (this.providerReady.has(providerKey)) return;
    await this.init();

    // Check if a ledger already exists before trying to create one
    let hasLedger = false;
    try {
      const ledger = await this.broker!.ledger.getLedger();
      hasLedger = Boolean(ledger);
    } catch {
      hasLedger = false;
    }

    if (!hasLedger) {
      // addLedger expects balance in 0G units (plain number), minimum 3.
      try {
        await this.broker!.ledger.addLedger(Math.max(3, fundAmountOG));
      } catch (e: any) {
        if (!this.isDuplicateSetupError(e)) throw e;
      }
    }

    try {
      await this.broker!.inference.acknowledgeProviderSigner(providerAddress);
    } catch (e: any) {
      if (!this.isDuplicateSetupError(e)) throw e;
    }

    // Only transfer funds if provider has no balance yet. Do not swallow
    // insufficient-funds errors here; the caller needs to know compute is not ready.
    let providerFunded = false;
    try {
      const balances = await this.broker!.ledger.getProvidersWithBalance("inference");
      providerFunded = balances.some(
        ([addr, balance]: [string, bigint, bigint]) =>
          addr.toLowerCase() === providerAddress.toLowerCase() && balance > BigInt(0)
      );
    } catch {
      // If we can't check, try the transfer anyway
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
      // Auto-funding is a latency optimization. A funded provider account is enough.
    }

    this.providerReady.add(providerKey);
  }

  private isDuplicateSetupError(e: any): boolean {
    const msg = (e?.message ?? "").toLowerCase();
    return (
      msg.includes("already") ||
      msg.includes("exists") ||
      msg.includes("duplicate")
    );
  }

  private providerAddressFromService(service: ProviderService): string | null {
    const provider = service.provider ?? service[0];
    return typeof provider === "string" && provider.startsWith("0x") ? provider : null;
  }

  private async getProviderCandidates(): Promise<string[]> {
    await this.init();
    const candidates = new Set<string>();
    if (this.config.providerAddress) candidates.add(this.config.providerAddress);

    try {
      const services = (await this.broker!.inference.listService(0, 50, true)) as ProviderService[];
      for (const service of services) {
        const address = this.providerAddressFromService(service);
        if (!address) continue;
        const serviceType = service.serviceType ?? service[1];
        if (typeof serviceType === "string" && serviceType && serviceType !== "inference") continue;
        candidates.add(address);
      }
    } catch {
      // If discovery fails, still try the configured provider.
    }

    return [...candidates];
  }

  private buildChatBody(
    userMessage: string,
    options: ComputeQueryOptions
  ) {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    return {
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    };
  }

  async query(
    userMessage: string,
    options: ComputeQueryOptions = {}
  ): Promise<{ text: string; verified: boolean; providerAddress: string }> {
    await this.init();
    const providers = await this.getProviderCandidates();
    const errors: string[] = [];

    for (const providerAddress of providers) {
      try {
        await this.setupProvider(providerAddress);
        const { endpoint, model } =
          await this.broker!.inference.getServiceMetadata(providerAddress);
        const requestBody = {
          ...this.buildChatBody(userMessage, options),
          model,
        };
        const headers = await this.broker!.inference.getRequestHeaders(
          providerAddress,
          JSON.stringify(requestBody)
        );

        const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(headers as unknown as Record<string, string>),
          },
          body: JSON.stringify(requestBody),
        });

        const raw = await response.text();
        if (!response.ok) {
          throw new Error(`Provider returned ${response.status}: ${raw.slice(0, 240)}`);
        }

        const completion = JSON.parse(raw) as {
          id?: string;
          choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
          usage?: unknown;
        };
        const msg = completion.choices?.[0]?.message;
        const text = msg?.content ?? msg?.reasoning_content ?? "";
        const chatId = response.headers.get("ZG-Res-Key") || completion.id;
        let verified = true;

        if (chatId) {
          try {
            const result = await this.broker!.inference.processResponse(
              providerAddress,
              chatId,
              completion.usage ? JSON.stringify(completion.usage) : text
            );
            verified = result !== false;
          } catch {
            // Verification settlement should not discard a successful quest response.
            verified = false;
          }
        }

        if (!text.trim()) {
          throw new Error("Provider returned an empty completion");
        }

        return {
          text,
          verified,
          providerAddress,
        };
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
    taskContext: string = ""
  ): Promise<SwarmResult> {
    const supervisorResult = await this.query(
      `You are a supervisor agent. Break down this task into ${workerCount} parallel sub-tasks. Respond with a JSON array of sub-task descriptions only.\n\nTask: ${supervisorPrompt}\n\nContext: ${taskContext}`,
      {
        systemPrompt:
          "You are a precise task decomposition supervisor. Output only valid JSON arrays.",
      }
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
        }).then((r) => r.text)
      )
    );

    const synthesis = await this.query(
      `Synthesize these worker results into a final coherent answer:\n${workerResults.map((r, i) => `Worker ${i + 1}: ${r}`).join("\n\n")}`,
      {
        systemPrompt:
          "You are a synthesis supervisor. Combine worker outputs into the best possible final answer.",
      }
    );

    return {
      supervisorPlan: supervisorResult.text,
      workerResults,
      synthesis: synthesis.text,
    };
  }
}
