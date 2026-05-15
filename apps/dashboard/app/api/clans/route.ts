import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { uploadJSON, ZGComputeClient } from "@0gclawforge/sdk";

interface ClanApiBody {
  action: "prepareMint" | "storeRealm" | "storeVote" | "storeEvolution" | "recordMemoryEntry";
  clanName?: string;
  archetype?: string;
  mission?: string;
  owner?: string;
  tokenId?: string;
  prompt?: string;
  proposal?: string;
  yesVotes?: number;
  noVotes?: number;
  currentRealmCount?: number;
  currentRealmRootURI?: string;
  previousVoteRoot?: string;
  executor?: string;
  entry?: string;
}

type RealmLayout = {
  style: "grove" | "labyrinth" | "corridor" | "sanctum";
  wallDensity: number;
  landmarkIcons: string[];
  bossIcon?: string;
};

type RealmVisualTheme = {
  id: "forest" | "desert" | "cave" | "neon" | "citadel" | "default";
  palette: {
    bg: string;
    floor: string;
    wall: string;
    accent: string;
    glow: string;
  };
  motifs: string[];
  tileStyle: "organic" | "ruin" | "cyber" | "royal";
};

type RealmMapTile = {
  type: "wall" | "floor" | "npc" | "quest" | "artifact" | "boss" | "decoration" | "exit";
  assetName?: string;
  motif?: string;
};

type RealmMap = {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  boss: { x: number; y: number };
  exit?: { x: number; y: number };
  tiles: RealmMapTile[][];
};

type GeneratedRealm = {
  title: string;
  lore: string;
  assets: Array<{ type: string; name: string; description: string }>;
  layout: RealmLayout;
  visualTheme: RealmVisualTheme;
  map: RealmMap;
};

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  }
  return privateKey.split(/\s+/)[0];
}

function getComputeConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDR;
  if (!rpcUrl || !providerAddress) return null;
  return { rpcUrl, privateKey: readPrivateKey(), providerAddress };
}

function inferPromptRealm(prompt: string): GeneratedRealm {
  const lower = prompt.toLowerCase();
  const title = `${prompt.split(/\s+/).slice(0, 5).join(" ")} Realm`;

  const biome =
    /(neon|cyber|punk|street|city|district|arcade|rain-soaked)/.test(lower) ? "neon"
      : /(desert|dune|sand|oasis|sun)/.test(lower) ? "desert"
      : /(cave|vault|ember|under|crypt|lava|ruin)/.test(lower) ? "cave"
      : /(castle|fortress|citadel|hall|cathedral)/.test(lower) ? "citadel"
      : "forest";

  const style: RealmLayout["style"] =
    /(maze|labyrinth|twist|puzzle)/.test(lower) ? "labyrinth"
      : /(road|corridor|gauntlet|bridge|passage)/.test(lower) ? "corridor"
      : /(boss|dragon|throne|sanctum|altar)/.test(lower) ? "sanctum"
      : "grove";

  const landmarkIcons =
    biome === "neon" ? ["⬢", "✦", "◉", "▣"]
      : biome === "desert" ? ["🌵", "☀", "🏺", "✧"]
      : biome === "cave" ? ["🪨", "🕯", "💠", "✦"]
      : biome === "citadel" ? ["🏰", "⚜", "🛡", "✦"]
      : ["🌿", "🍄", "🌙", "✦"];

  const bossIcon =
    /(mech|android|synthetic|cyber)/.test(lower) ? "🤖"
      : /(dragon|wyrm|drake)/.test(lower) ? "🐉"
      : /(lich|necromancer|spirit|ghost)/.test(lower) ? "💀"
      : /(golem|guardian|construct)/.test(lower) ? "🗿"
      : "🐉";

  const visualTheme: RealmVisualTheme =
    biome === "neon"
      ? {
          id: "neon",
          palette: { bg: "#08111f", floor: "#10243c", wall: "#09101a", accent: "#ff4fd8", glow: "#25f3ff" },
          motifs: ["neon-kanji", "wet-asphalt", "holo-signs"],
          tileStyle: "cyber",
        }
      : biome === "desert"
        ? {
            id: "desert",
            palette: { bg: "#24160b", floor: "#3e2a14", wall: "#2a1b0f", accent: "#f0b34d", glow: "#ffd27a" },
            motifs: ["dune-ridges", "sun-banners", "carved-stone"],
            tileStyle: "ruin",
          }
        : biome === "cave"
          ? {
              id: "cave",
              palette: { bg: "#0d0d12", floor: "#1d1c25", wall: "#121119", accent: "#ff7a3d", glow: "#ffd166" },
              motifs: ["ember-veins", "vault-runes", "obsidian-cracks"],
              tileStyle: "ruin",
            }
          : biome === "citadel"
            ? {
                id: "citadel",
                palette: { bg: "#131018", floor: "#292232", wall: "#1c1624", accent: "#d4b06a", glow: "#f7ead2" },
                motifs: ["royal-banners", "sigil-stone", "vault-arches"],
                tileStyle: "royal",
              }
            : {
                id: "forest",
                palette: { bg: "#0b140f", floor: "#173322", wall: "#0f2016", accent: "#9be36a", glow: "#b7ffd1" },
                motifs: ["moss-veins", "moon-petals", "root-circles"],
                tileStyle: "organic",
              };

  const assets = [
    { type: "biome", name: `${biome[0].toUpperCase()}${biome.slice(1)} Frontier`, description: `A permanent world space shaped by: ${prompt}` },
    { type: "npc", name: biome === "neon" ? "Neon Fixer" : biome === "citadel" ? "Banner Marshal" : biome === "desert" ? "Dune Oracle" : biome === "cave" ? "Vault Hermit" : "Memory Warden", description: `A guide bound to the realm's core theme: ${prompt}.` },
    { type: "npc", name: /(merchant|market|trade)/.test(lower) ? "Caravan Broker" : "Rune Keeper", description: "Shares clues about the safest route and what the clan should recover." },
    { type: "quest", name: /(dragon|boss|wyrm)/.test(lower) ? "Break the Tyrant's Hold" : "First Echo", description: `A quest objective pulled from the realm prompt: ${prompt}.` },
    { type: "quest", name: style === "labyrinth" ? "Trace the Hidden Path" : style === "corridor" ? "Hold the Narrow Way" : "Awaken the Inner Gate", description: "A second objective that changes how the player navigates the map." },
    { type: "artifact", name: biome === "desert" ? "Sunglass Sigil" : biome === "cave" ? "Ember Vault Sigil" : biome === "citadel" ? "Throne Seal" : "Clan Sigil", description: "A clan-bound artifact that proves the realm can evolve." },
    { type: "artifact", name: /(moon|night|star)/.test(lower) ? "Lunar Thread" : "Memory Prism", description: "A secondary reward tied to the prompt's strongest motif." },
  ];

  const buildMap = (): RealmMap => {
    const width = 16;
    const height = 16;
    const spawn = { x: 8, y: 14 };
    const boss = { x: 8, y: 2 };
    const tiles: RealmMapTile[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        type: x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "wall" : "floor",
      }))
    );

    const mark = (x: number, y: number, tile: RealmMapTile) => {
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) tiles[y][x] = tile;
    };

    mark(boss.x, boss.y, { type: "boss", motif: bossIcon });

    if (style === "labyrinth") {
      for (let x = 3; x < width - 3; x += 3) {
        const gapY = 2 + ((x * 5) % (height - 4));
        for (let y = 1; y < height - 1; y++) {
          if (y !== gapY && !(x === spawn.x && y === spawn.y) && !(x === boss.x && y === boss.y)) {
            tiles[y][x] = { type: "wall" };
          }
        }
      }
    } else if (style === "corridor") {
      for (let y = 3; y < height - 3; y += 3) {
        const gapX = 2 + ((y * 7) % (width - 4));
        for (let x = 1; x < width - 1; x++) {
          if (Math.abs(x - gapX) > 1) tiles[y][x] = { type: "wall" };
        }
      }
    } else if (style === "sanctum") {
      for (let x = boss.x - 2; x <= boss.x + 2; x++) mark(x, 4, { type: "wall" });
      mark(boss.x - 2, 3, { type: "wall" });
      mark(boss.x + 2, 3, { type: "wall" });
    }

    const placements = [
      { x: 2, y: 5, type: "npc", assetName: assets[1]?.name },
      { x: 12, y: 11, type: "npc", assetName: assets[2]?.name },
      { x: 8, y: 6, type: "quest", assetName: assets[3]?.name },
      { x: 14, y: 6, type: "quest", assetName: assets[4]?.name },
      { x: 10, y: 8, type: "artifact", assetName: assets[5]?.name },
      { x: 10, y: 9, type: "artifact", assetName: assets[6]?.name },
    ] as const;

    for (const placement of placements) {
      mark(placement.x, placement.y, { type: placement.type, assetName: placement.assetName });
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (tiles[y][x].type === "floor" && (x * y + prompt.length) % 11 === 0) {
          tiles[y][x] = { type: "decoration", motif: landmarkIcons[(x + y) % landmarkIcons.length] };
        }
      }
    }

    return { width, height, spawn, boss, tiles };
  };

  return {
    title,
    lore: `A playable clan realm forged from the request: ${prompt}. Its layout, encounters, and rewards are tuned to reflect that fantasy instead of using a generic board.`,
    assets,
    visualTheme,
    map: buildMap(),
    layout: {
      style,
      wallDensity: style === "labyrinth" ? 0.18 : style === "corridor" ? 0.14 : style === "sanctum" ? 0.12 : 0.08,
      landmarkIcons,
      bossIcon,
    },
  };
}

async function generateRealmWithInference(prompt: string): Promise<GeneratedRealm> {
  const computeConfig = getComputeConfig();
  if (!computeConfig) {
    return fallbackRealm(prompt);
  }

  try {
    const client = new ZGComputeClient(computeConfig);
    await client.setupProvider(computeConfig.providerAddress);

    const result = await client.query(
      `Generate a detailed Eternal Clans realm from this prompt: ${prompt}

Return JSON with keys:
- title (string)
- lore (string, 2-3 sentences)
- assets (array of {type: "biome"|"npc"|"quest"|"artifact", name: string, description: string})
- visualTheme ({id, palette:{bg,floor,wall,accent,glow}, motifs:string[], tileStyle:"organic"|"ruin"|"cyber"|"royal"})
- map ({width,height,spawn,boss,tiles}) where tiles is a 2D array of {type, assetName?, motif?}
- layout ({style: "grove"|"labyrinth"|"corridor"|"sanctum", wallDensity: number between 0.05 and 0.2, landmarkIcons: string[], bossIcon?: string})
`,
      {
        systemPrompt: "You are an OpenClaw realm architect. Generate rich, unique fantasy game realm content. Return only valid JSON.",
        temperature: 0.55,
        maxTokens: 700,
      }
    );

    try {
      const parsed = JSON.parse(result.text);
      const inferred = inferPromptRealm(prompt);
      return {
        title: parsed.title || inferred.title,
        lore: parsed.lore || result.text.slice(0, 500),
        assets: Array.isArray(parsed.assets) && parsed.assets.length > 0 ? parsed.assets : inferred.assets,
        visualTheme: parsed.visualTheme?.palette ? {
          id: typeof parsed.visualTheme.id === "string" ? parsed.visualTheme.id : inferred.visualTheme.id,
          palette: {
            bg: parsed.visualTheme.palette.bg || inferred.visualTheme.palette.bg,
            floor: parsed.visualTheme.palette.floor || inferred.visualTheme.palette.floor,
            wall: parsed.visualTheme.palette.wall || inferred.visualTheme.palette.wall,
            accent: parsed.visualTheme.palette.accent || inferred.visualTheme.palette.accent,
            glow: parsed.visualTheme.palette.glow || inferred.visualTheme.palette.glow,
          },
          motifs: Array.isArray(parsed.visualTheme.motifs) ? parsed.visualTheme.motifs.slice(0, 6) : inferred.visualTheme.motifs,
          tileStyle: ["organic", "ruin", "cyber", "royal"].includes(parsed.visualTheme.tileStyle) ? parsed.visualTheme.tileStyle : inferred.visualTheme.tileStyle,
        } : inferred.visualTheme,
        map: parsed.map?.tiles ? parsed.map : inferred.map,
        layout: parsed.layout && Array.isArray(parsed.layout.landmarkIcons)
          ? {
              style: ["grove", "labyrinth", "corridor", "sanctum"].includes(parsed.layout.style) ? parsed.layout.style : inferred.layout.style,
              wallDensity:
                typeof parsed.layout.wallDensity === "number"
                  ? Math.max(0.05, Math.min(0.2, parsed.layout.wallDensity))
                  : inferred.layout.wallDensity,
              landmarkIcons: parsed.layout.landmarkIcons.slice(0, 6),
              bossIcon: typeof parsed.layout.bossIcon === "string" ? parsed.layout.bossIcon : inferred.layout.bossIcon,
            }
          : inferred.layout,
      };
    } catch {
      const inferred = inferPromptRealm(prompt);
      return {
        title: inferred.title,
        lore: result.text.slice(0, 500),
        assets: inferred.assets,
        visualTheme: inferred.visualTheme,
        map: inferred.map,
        layout: inferred.layout,
      };
    }
  } catch (error) {
    console.error("0G Compute realm generation failed, using fallback realm", error);
    return fallbackRealm(prompt);
  }
}

function fallbackRealm(prompt: string) {
  return inferPromptRealm(prompt);
}

function getStorageConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl =
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO;

  if (!rpcUrl || !indexerUrl) {
    throw new Error("0G Storage endpoints are not configured");
  }

  return {
    rpcUrl,
    indexerUrl,
    privateKey: readPrivateKey(),
  };
}

async function storeRecord(kind: string, payload: Record<string, unknown>) {
  const record = {
    kind,
    payload,
    network: {
      chainId: Number(process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602),
      storageIndexer:
        process.env.VITE_STORAGE_INDEXER ||
        process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
        process.env.OG_STORAGE_INDEXER_TURBO,
    },
    createdAt: Date.now(),
  };

  const upload = await uploadJSON(record, getStorageConfig());
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(record)));

  return {
    ...upload,
    storageURI: upload.rootHash,
    metadataHash,
    record,
    memorySize: new TextEncoder().encode(JSON.stringify(record)).length,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClanApiBody;

    if (body.action === "prepareMint") {
      if (!body.clanName || !body.archetype || !body.owner) {
        return NextResponse.json({ error: "clanName, archetype, and owner are required" }, { status: 400 });
      }

      const memory = await storeRecord("clan-memory-index", {
        clanName: body.clanName,
        owner: body.owner,
        entries: [
          {
            content: body.mission || body.archetype,
            tags: ["origin", "mission"],
            importance: 1,
          },
        ],
      });

      const metadata = await storeRecord("clan-metadata", {
        clanName: body.clanName,
        archetype: body.archetype,
        mission: body.mission,
        owner: body.owner,
        memoryRootURI: memory.storageURI,
        realmRootURI: "",
      });

      return NextResponse.json({
        storageURI: metadata.storageURI,
        metadataHash: metadata.metadataHash,
        memoryRootURI: memory.storageURI,
        realmRootURI: "",
        storageTxHash: metadata.txHash,
      });
    }

    if (body.action === "storeRealm") {
      if (!body.tokenId || !body.prompt) {
        return NextResponse.json({ error: "tokenId and prompt are required" }, { status: 400 });
      }

      const generated = await generateRealmWithInference(body.prompt);
      const realm = await storeRecord("ugc-realm", {
        tokenId: body.tokenId,
        prompt: body.prompt,
        title: generated.title,
        lore: generated.lore,
        assets: generated.assets,
        version: Number(body.currentRealmCount || 0) + 1,
        previousRealmRootURI: body.currentRealmRootURI || "",
        visualTheme: generated.visualTheme,
        map: generated.map,
        layout: generated.layout,
      });

      return NextResponse.json({
        realmRootURI: realm.storageURI,
        realmCount: Number(body.currentRealmCount || 0) + 1,
        storageTxHash: realm.txHash,
      });
    }

    if (body.action === "storeVote") {
      if (!body.tokenId || !body.proposal) {
        return NextResponse.json({ error: "tokenId and proposal are required" }, { status: 400 });
      }

      const vote = await storeRecord("community-evolution-vote", {
        tokenId: body.tokenId,
        proposal: body.proposal,
        yesVotes: body.yesVotes ?? 1,
        noVotes: body.noVotes ?? 0,
        ...(body.previousVoteRoot ? { previousVoteRoot: body.previousVoteRoot } : {}),
      });

      return NextResponse.json({
        voteRootURI: vote.storageURI,
        proposalCount: 1,
        storageTxHash: vote.txHash,
      });
    }

    if (body.action === "storeEvolution") {
      if (!body.tokenId || !body.proposal) {
        return NextResponse.json({ error: "tokenId and proposal are required" }, { status: 400 });
      }

      const generated = body.prompt ? await generateRealmWithInference(body.prompt) : null;
      const evolution = await storeRecord("clan-evolution", {
        tokenId: body.tokenId,
        proposal: body.proposal,
        prompt: body.prompt,
        realmGenerated: generated,
        executedBy: body.executor || "unknown",
      });

      return NextResponse.json({
        metadataHash: evolution.metadataHash,
        storageURI: evolution.storageURI,
        memoryRootURI: evolution.storageURI,
        realmRootURI: evolution.storageURI,
        memorySize: evolution.memorySize,
        realmCount: Number(body.currentRealmCount || 0) + 1,
        storageTxHash: evolution.txHash,
      });
    }

    if (body.action === "recordMemoryEntry") {
      if (!body.tokenId || !body.entry) {
        return NextResponse.json({ error: "tokenId and entry are required" }, { status: 400 });
      }

      const memory = await storeRecord("clan-memory-entry", {
        tokenId: body.tokenId,
        content: body.entry,
        tags: ["realm", "completion", "gameplay"],
        importance: 1,
        executor: body.executor || "unknown",
      });

      return NextResponse.json({
        memoryRootURI: memory.storageURI,
        metadataHash: memory.metadataHash,
        storageTxHash: memory.txHash,
      });
    }

    return NextResponse.json({ error: "Unsupported clan action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown clan API error";
    console.error("Clan API error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
