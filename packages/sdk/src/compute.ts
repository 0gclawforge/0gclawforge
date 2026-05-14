import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import OpenAI from "openai";
import type { ComputeConfig, ComputeQueryOptions, SwarmResult } from "./types";

export class ZGComputeClient {
  private broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
  private config: ComputeConfig;
  private initialized = false;

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

  private providerReady = false;

  async setupProvider(
    providerAddress: string,
    fundAmountOG: number = 0.1
  ): Promise<void> {
    if (this.providerReady) return;
    await this.init();

    // addLedger expects balance in 0G units (plain number), not wei
    try {
      await this.broker!.ledger.addLedger(fundAmountOG);
    } catch (e: any) {
      if (!e.message?.includes("already") && !e.message?.includes("exists") && !e.message?.includes("duplicate")) {
        throw e;
      }
    }

    try {
      await this.broker!.inference.acknowledgeProviderSigner(providerAddress);
    } catch (e: any) {
      if (!e.message?.includes("already") && !e.message?.includes("exists") && !e.message?.includes("duplicate")) {
        throw e;
      }
    }

    // transferFund expects amount in neuron (bigint)
    const transferAmount = ethers.parseEther(fundAmountOG.toString());
    try {
      await this.broker!.ledger.transferFund(providerAddress, "inference", transferAmount);
    } catch (e: any) {
      if (!e.message?.includes("already") && !e.message?.includes("exists") && !e.message?.includes("duplicate")) {
        throw e;
      }
    }

    this.providerReady = true;
  }

  async query(
    userMessage: string,
    options: ComputeQueryOptions = {}
  ): Promise<{ text: string; verified: boolean; providerAddress: string }> {
    await this.init();
    await this.setupProvider(this.config.providerAddress);
    const providerAddress = this.config.providerAddress;

    const { endpoint, model } =
      await this.broker!.inference.getServiceMetadata(providerAddress);
    const headers = await this.broker!.inference.getRequestHeaders(
      providerAddress,
      userMessage
    );

    const openai = new OpenAI({ baseURL: endpoint, apiKey: "" });
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    const completion = await openai.chat.completions.create(
      {
        model,
        messages,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
      { headers: headers as unknown as Record<string, string> }
    );

    const chatId = (completion as any).id;
    if (chatId) {
      try {
        await this.broker!.inference.processResponse(
          providerAddress,
          completion as any,
          chatId
        );
      } catch (_) {
        /* non-fatal */
      }
    }

    return {
      text: completion.choices[0]?.message?.content ?? "",
      verified: true,
      providerAddress,
    };
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
