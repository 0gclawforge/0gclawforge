import type { VerifiableInference } from "@0gclawforge/compute";

export interface QuestRunInput {
  clanName: string;
  realmPrompt: string;
  proposal: string;
  depinSummary: string;
  memoryContext: string;
}

export interface QuestRunResult {
  title: string;
  summary: string;
  actions: string[];
  outcome: string;
}

export class AutonomousQuestEngine {
  constructor(private readonly inference: VerifiableInference) {}

  async runQuest(input: QuestRunInput): Promise<QuestRunResult> {
    const response = await this.inference.run(
      [
        `Clan: ${input.clanName}`,
        `Realm: ${input.realmPrompt}`,
        `Current proposal: ${input.proposal}`,
        `Live DePIN context: ${input.depinSummary}`,
        `Permanent memory context: ${input.memoryContext}`,
        "Return JSON with keys: title, summary, actions, outcome.",
      ].join("\n\n"),
      {
        systemPrompt:
          "You are an autonomous Eternal Clans quest director. Create concise, executable quest state using the provided DePIN and memory context.",
        temperature: 0.4,
        maxTokens: 700,
      }
    );

    try {
      const parsed = JSON.parse(response.text) as QuestRunResult;
      return {
        title: parsed.title || "Autonomous quest",
        summary: parsed.summary || response.text,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        outcome: parsed.outcome || "Quest cycle completed.",
      };
    } catch {
      return {
        title: "Autonomous quest",
        summary: response.text,
        actions: [],
        outcome: "Quest cycle completed.",
      };
    }
  }
}
