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
        await this.appendMemory(`DAO PROPOSAL (${source}): ${text}`, ["proposal", source]);
        this.deployment!.proposal = text;
        return `Proposal recorded: ${text}`;
      },
      onQuestRun: async () => {
        const result = await this.runAutonomousCycle();
        return result.lastQuestOutcome || "Quest cycle completed.";
      },
      onDepinSnapshot: async () => {
        await this.updateDepinSummary();
        return this.lastDepinSummary;
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
      );
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

    await Promise.allSettled([
      this.telegramBot?.sendMessage(socialSummary),
      this.discordBot?.postMessage(socialSummary),
    ]);

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
      return {
        title: "Autonomous quest",
        summary: `Verified compute unavailable. Using degraded runtime mode. ${message}`,
        actions: [],
        outcome: "Runtime stayed online, but autonomous quest generation is unavailable until 0G Compute succeeds.",
      };
    }
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
      this.lastQuestOutcome = `Runtime deployed without verified compute: ${message}`;
    }
  }
}

declare global {
  var __0gclawforgeRuntime: ClanRuntimeManager | undefined;
}

export function getRuntimeManager(
  computeConfig: ComputeConfig,
  storageConfig: StorageConfig
): ClanRuntimeManager {
  if (!global.__0gclawforgeRuntime) {
    global.__0gclawforgeRuntime = new ClanRuntimeManager(computeConfig, storageConfig);
  }
  return global.__0gclawforgeRuntime;
}
