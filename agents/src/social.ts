import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client as DiscordClient,
  type SendableChannels,
} from "discord.js";

export interface TelegramDeploymentConfig {
  token: string;
  clanName: string;
  chatId?: string;
}

export interface DiscordDeploymentConfig {
  token: string;
  applicationId: string;
  clanName: string;
  guildId?: string;
  channelId?: string;
}

export interface SocialMessageHandler {
  onProposalCreate(source: "telegram" | "discord", text: string): Promise<string>;
  onQuestRun(source: "telegram" | "discord"): Promise<string>;
  onDepinSnapshot(source: "telegram" | "discord"): Promise<string>;
  onStatus(source: "telegram" | "discord"): Promise<string>;
}

export class TelegramClanBot {
  private offset = 0;
  private polling = false;
  private abortController: AbortController | null = null;
  private username: string | null = null;
  private learnedChatId: string | null = null;

  constructor(
    private readonly config: TelegramDeploymentConfig,
    private readonly handler: SocialMessageHandler
  ) {}

  async deploy(): Promise<void> {
    const profile = await this.call<{ result?: { username?: string } }>("getMe", {});
    this.username = profile.result?.username ?? null;

    await this.call("setMyCommands", {
      commands: JSON.stringify([
        { command: "status", description: "Show clan status" },
        { command: "proposal", description: "Create a proposal" },
        { command: "propose", description: "Create a proposal (alias)" },
        { command: "quest", description: "Run autonomous quest" },
        { command: "depin", description: "Fetch live DePIN snapshot" },
      ]),
    });

    if (this.config.chatId) {
      try {
        await this.sendMessage(
          `0GClawForge Telegram runtime is live for ${this.config.clanName}.`
        );
      } catch (error) {
        console.warn("Telegram startup message failed", error);
      }
    }

    if (process.env.TELEGRAM_POLLING_ENABLED !== "false") {
      this.startPolling();
    }
  }

  async sendMessage(text: string): Promise<void> {
    const targetChat = this.learnedChatId || this.config.chatId;
    if (!targetChat) return;
    await this.call("sendMessage", {
      chat_id: targetChat,
      text,
    });
  }

  getBotUrl(): string | null {
    return this.username ? `https://t.me/${this.username}` : null;
  }

  stop(): void {
    this.polling = false;
    this.abortController?.abort();
  }

  private startPolling(): void {
    if (this.polling) return;
    this.polling = true;
    this.abortController = new AbortController();
    void this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const response = await this.call<{ result?: Array<{ update_id: number; message?: { text?: string; chat?: { id: number } } }> }>(
          "getUpdates",
          {
            timeout: 25,
            offset: this.offset,
          },
          this.abortController?.signal
        );

        for (const update of response.result || []) {
          this.offset = update.update_id + 1;
          const text = update.message?.text?.trim();
          const chatId = update.message?.chat?.id;
          if (!text || !chatId) continue;

          // Auto-learn the chat ID so broadcast messages reach the right place
          if (!this.learnedChatId) {
            this.learnedChatId = String(chatId);
          }

          try {
            const reply = await this.handleCommand(text);
            if (reply) {
              await this.call("sendMessage", {
                chat_id: chatId,
                text: reply,
              });
            }
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Unknown error";
            try {
              await this.call("sendMessage", {
                chat_id: chatId,
                text: `Command failed: ${errMsg}`,
              });
            } catch {
              // If even the error reply fails, just continue polling
            }
          }
        }
      } catch (error) {
        if (!this.polling) break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleCommand(text: string): Promise<string | null> {
    // Strip @botname suffix so commands work in groups
    const cleaned = text.replace(/@\S+/, "").trim();
    if (cleaned.startsWith("/status")) return this.handler.onStatus("telegram");
    if (cleaned.startsWith("/quest")) return this.handler.onQuestRun("telegram");
    if (cleaned.startsWith("/depin")) return this.handler.onDepinSnapshot("telegram");
    if (cleaned.startsWith("/proposal") || cleaned.startsWith("/propose")) {
      const proposal = cleaned.replace(/^\/(proposal|propose)\s*/, "").trim();
      if (!proposal) {
        return "Please include your proposal text. Example:\n/propose Add a dragon boss to the forest realm";
      }
      return this.handler.onProposalCreate("telegram", proposal);
    }
    if (cleaned.startsWith("/start") || cleaned.startsWith("/help")) {
      return [
        `0GClawForge Clan Bot (${this.config.clanName})`,
        "",
        "/status - Show clan runtime status",
        "/quest - Run an autonomous quest cycle",
        "/depin - Fetch live WeatherXM snapshot",
        "/proposal <text> - Create a DAO proposal",
        "/propose <text> - Alias for /proposal",
      ].join("\n");
    }
    return null;
  }

  private async call<T = unknown>(
    method: string,
    params: Record<string, string | number>,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(`https://api.telegram.org/bot${this.config.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(
        Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
      ),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Telegram Bot API ${method} failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

export class DiscordClanBot {
  private client: DiscordClient | null = null;

  constructor(
    private readonly config: DiscordDeploymentConfig,
    private readonly handler: SocialMessageHandler
  ) {}

  async deploy(): Promise<void> {
    await this.registerGuildCommands();

    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
      partials: [Partials.Channel],
    });

    client.once(Events.ClientReady, async () => {
      if (this.config.channelId) {
        const channel = await client.channels.fetch(this.config.channelId);
        if (isSendableChannel(channel)) {
          await channel.send(`0GClawForge Discord runtime is live for ${this.config.clanName}.`);
        }
      }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleInteraction(interaction);
    });

    await client.login(this.config.token);
    this.client = client;
  }

  async postMessage(text: string): Promise<void> {
    if (!this.client || !this.config.channelId) return;
    const channel = await this.client.channels.fetch(this.config.channelId);
    if (isSendableChannel(channel)) {
      await channel.send(text);
    }
  }

  async fetchMemberSummary(): Promise<string> {
    if (!this.client) {
      return "Discord bot is not connected.";
    }
    if (!this.config.guildId) {
      return "Discord commands are deployed globally. Provide a guild ID to fetch live member counts.";
    }
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const hydratedGuild = await guild.fetch();
    return `Guild members: ${hydratedGuild.memberCount}`;
  }

  stop(): void {
    this.client?.destroy();
    this.client = null;
  }

  private async registerGuildCommands(): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(this.config.token);
    const commands = [
      new SlashCommandBuilder().setName("status").setDescription("Show clan status"),
      new SlashCommandBuilder().setName("quest").setDescription("Run autonomous quest"),
      new SlashCommandBuilder().setName("depin").setDescription("Fetch live DePIN snapshot"),
      new SlashCommandBuilder()
        .setName("proposal")
        .setDescription("Create a DAO proposal")
        .addStringOption((option) =>
          option.setName("text").setDescription("Proposal text").setRequired(true)
        ),
      new SlashCommandBuilder().setName("members").setDescription("Show guild member summary"),
    ].map((command) => command.toJSON());

    if (this.config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(this.config.applicationId, this.config.guildId),
        { body: commands }
      );
      return;
    }

    await rest.put(
      Routes.applicationCommands(this.config.applicationId),
      { body: commands }
    );
  }

  private async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName === "status") {
      await interaction.reply(await this.handler.onStatus("discord"));
      return;
    }

    if (interaction.commandName === "quest") {
      await interaction.reply(await this.handler.onQuestRun("discord"));
      return;
    }

    if (interaction.commandName === "depin") {
      await interaction.reply(await this.handler.onDepinSnapshot("discord"));
      return;
    }

    if (interaction.commandName === "proposal") {
      const text = interaction.options.getString("text", true);
      await interaction.reply(await this.handler.onProposalCreate("discord", text));
      return;
    }

    if (interaction.commandName === "members") {
      await interaction.reply(await this.fetchMemberSummary());
    }
  }
}

function isSendableChannel(channel: unknown): channel is SendableChannels {
  return Boolean(
    channel &&
      typeof channel === "object" &&
      "isTextBased" in channel &&
      typeof (channel as { isTextBased: () => boolean }).isTextBased === "function" &&
      (channel as { isTextBased: () => boolean }).isTextBased() &&
      "send" in channel &&
      typeof (channel as { send: unknown }).send === "function"
  );
}
