import { VerifiableInference } from "@0gclawforge/compute";
import { PermanentMemory } from "@0gclawforge/storage";
import type { ComputeConfig, StorageConfig } from "@0gclawforge/sdk";
import { AutonomousQuestEngine } from "./quests";
import { WeatherXMClient } from "./depin";
import {
  DiscordClanBot,
  TelegramClanBot,
  type DiscordDeploymentConfig,
  type SocialMessageHandler,
  type TelegramDeploymentConfig,
} from "./social";

export interface ClanRuntimeDeployment {
  clanName: string;
  tokenId: string;
  proposal: string;
  realmPrompt: string;
  depinQuery: string;
  memoryRootHash: string | null;
  telegram?: TelegramDeploymentConfig;
  discord?: DiscordDeploymentConfig;
}

export interface RuntimeStatus {
  deployed: boolean;
  telegramActive: boolean;
  discordActive: boolean;
  lastDepinSummary?: string;
  lastQuestOutcome?: string;
  memoryRootHash?: string | null;
}

export class ClanRuntimeManager {
  private readonly inference: VerifiableInference;
  private readonly memory: PermanentMemory;
  private readonly depin = new WeatherXMClient();
  private readonly questEngine: AutonomousQuestEngine;
  private telegramBot: TelegramClanBot | null = null;
  private discordBot: DiscordClanBot | null = null;
  private interval: NodeJS.Timeout | null = null;
  private deployment: ClanRuntimeDeployment | null = null;
  private lastDepinSummary = "";
  private lastQuestOutcome = "";

  constructor(
    computeConfig: ComputeConfig,
    storageConfig: StorageConfig
  ) {
    this.inference = new VerifiableInference(computeConfig);
    this.memory = new PermanentMemory(storageConfig);
    this.questEngine = new AutonomousQuestEngine(this.inference);
  }

  async deploy(deployment: ClanRuntimeDeployment): Promise<RuntimeStatus> {
    this.stop();
    this.deployment = deployment;
    await this.prepareComputeProvider();

    const handler: SocialMessageHandler = {
      onProposalCreate: async (source, text) => {
        if (!this.deployment) return `Proposal noted but runtime is not deployed: ${text}`;
        this.deployment.proposal = text;
        try {
          await this.appendMemory(`DAO PROPOSAL (${source}): ${text}`, ["proposal", source]);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown storage error";
          return `Proposal recorded locally but storage failed: ${msg}. Proposal: ${text}`;
        }
        return `Proposal recorded: ${text}`;
      },
      onQuestRun: async () => {
        if (!this.deployment) return "Runtime is not deployed yet. Deploy from the dashboard first.";
        const result = await this.runAutonomousCycle();
        return result.lastQuestOutcome || "Quest cycle completed.";
      },
      onDepinSnapshot: async () => {
        await this.updateDepinSummary();
        return this.lastDepinSummary || "No DePIN data available.";
      },
      onStatus: async () => JSON.stringify(this.getStatus(), null, 2),
    };

    if (deployment.telegram) {
      this.telegramBot = new TelegramClanBot(deployment.telegram, handler);
      await this.telegramBot.deploy();
    }

    if (deployment.discord) {
      this.discordBot = new DiscordClanBot(deployment.discord, handler);
      await this.discordBot.deploy();
    }

    const intervalMs = Number(process.env.AUTONOMY_INTERVAL_MS || 300000);
    this.interval = setInterval(() => {
      void this.runAutonomousCycle();
    }, intervalMs);

    try {
      await this.runAutonomousCycle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown autonomous cycle error";
      this.lastQuestOutcome = `Runtime deployed, but the initial autonomous cycle failed: ${message}`;
    }
    return this.getStatus();
  }

  getStatus(): RuntimeStatus {
    return {
      deployed: this.deployment !== null,
      telegramActive: this.telegramBot !== null,
      discordActive: this.discordBot !== null,
      lastDepinSummary: this.lastDepinSummary,
      lastQuestOutcome: this.lastQuestOutcome,
      memoryRootHash: this.deployment?.memoryRootHash ?? null,
    };
  }

  stop(): void {
    this.interval && clearInterval(this.interval);
    this.interval = null;
    this.telegramBot?.stop();
    this.discordBot?.stop();
    this.telegramBot = null;
    this.discordBot = null;
  }

  async runAutonomousCycle(): Promise<RuntimeStatus> {
    if (!this.deployment) {
      throw new Error("Runtime has not been deployed yet.");
    }

    await this.updateDepinSummary();

    let memoryContext = "";
    if (this.deployment.memoryRootHash) {
      const entries = await this.memory.queryClanMemory(
        this.deployment.memoryRootHash,
        `${this.deployment.clanName} ${this.deployment.proposal} ${this.deployment.realmPrompt}`,
        5
      ) ?? [];
      if (entries.length > 0) {
        memoryContext = entries.map((e) => `[${e.tags.join(",")}] ${e.content}`).join("\n\n");
      }
    }

    const quest = await this.runQuestWithFallback({
      clanName: this.deployment.clanName,
      realmPrompt: this.deployment.realmPrompt,
      proposal: this.deployment.proposal,
      depinSummary: this.lastDepinSummary,
      memoryContext,
    });

    this.lastQuestOutcome = `${quest.title}: ${quest.outcome}`;
    await this.appendMemory(
      `QUEST: ${quest.title}\nSUMMARY: ${quest.summary}\nOUTCOME: ${quest.outcome}\nDEPIN:\n${this.lastDepinSummary}`,
      ["quest", "depin", "autonomy"]
    );

    const socialSummary = [
      `Quest: ${quest.title}`,
      quest.outcome,
      this.lastDepinSummary,
    ].join("\n\n");

    const results = await Promise.allSettled([
      this.telegramBot?.sendMessage(socialSummary),
      this.discordBot?.postMessage(socialSummary),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("Social broadcast failed:", result.reason);
      }
    }

    return this.getStatus();
  }

  private async updateDepinSummary(): Promise<void> {
    if (!this.deployment) return;
    try {
      this.lastDepinSummary = await this.depin.summarize(this.deployment.depinQuery);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DePIN fetch error";
      this.lastDepinSummary = `WeatherXM data unavailable: ${message}`;
    }
  }

  private async appendMemory(content: string, tags: string[]): Promise<void> {
    if (!this.deployment) return;
    const result = await this.memory.appendClanMemory(
      this.deployment.memoryRootHash,
      this.deployment.tokenId,
      content,
      tags,
      0.9
    );
    this.deployment.memoryRootHash = result.rootHash;
  }

  private async runQuestWithFallback(input: {
    clanName: string;
    realmPrompt: string;
    proposal: string;
    depinSummary: string;
    memoryContext: string;
  }) {
    try {
      return await this.questEngine.runQuest(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown compute quest error";
      console.warn("0G Compute quest generation failed; using deterministic quest generator:", message);
      return this.generateDeterministicQuest(input);
    }
  }

  private generateDeterministicQuest(input: {
    clanName: string;
    realmPrompt: string;
    proposal: string;
    depinSummary: string;
    memoryContext: string;
  }) {
    const realmTheme = this.extractTheme(input.realmPrompt || input.proposal);
    const depinSignal = this.extractDepinSignal(input.depinSummary);
    const memorySignal = input.memoryContext
      ? "Honor the strongest memory fragment before reporting back."
      : "Write the first field report into permanent clan memory.";
    const title = `${realmTheme} Signal Hunt`;
    const actions = [
      `Scout the ${realmTheme.toLowerCase()} around the latest WeatherXM signal.`,
      `Use the DePIN clue: ${depinSignal}`,
      `Resolve the council order: ${input.proposal}`,
      memorySignal,
    ];

    return {
      title,
      summary: `${input.clanName} receives a live realm task from WeatherXM context and clan memory. ${actions.join(" ")}`,
      actions,
      outcome: `${input.clanName} quest available: complete "${title}" by confirming the DePIN signal, logging one discovery, and returning with a memory proof.`,
    };
  }

  private extractTheme(text: string): string {
    const clean = text.trim();
    if (!clean) return "Realm";
    const words = clean
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !["with", "from", "that", "this", "into", "realm", "quest"].includes(word.toLowerCase()))
      .slice(0, 3);
    return words.length > 0 ? words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ") : "Realm";
  }

  private extractDepinSignal(summary: string): string {
    const lines = summary
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const liveCell = lines.find((line) => line.toLowerCase().includes("top live cell"));
    const quality = lines.find((line) => line.toLowerCase().includes("average qod"));
    const active = lines.find((line) => line.toLowerCase().includes("active stations"));
    return liveCell || quality || active || "No direct station match; use the nearest live network cell.";
  }

  private async prepareComputeProvider(): Promise<void> {
    try {
      await this.inference.ensureProviderReady();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider setup error";
      if (
        message.includes("already") ||
        message.includes("exists") ||
        message.includes("duplicate")
      ) {
        return;
      }
      console.warn("0G Compute provider setup failed:", message);
      this.lastQuestOutcome = `Runtime deployed without verified compute: ${message}`;
    }
  }
}

export function getRuntimeManager(
  computeConfig: ComputeConfig,
  storageConfig: StorageConfig
): ClanRuntimeManager {
  const g = globalThis as Record<string, unknown>;
  if (!g.__0gclawforgeRuntime) {
    g.__0gclawforgeRuntime = new ClanRuntimeManager(computeConfig, storageConfig);
  }
  return g.__0gclawforgeRuntime as ClanRuntimeManager;
}
