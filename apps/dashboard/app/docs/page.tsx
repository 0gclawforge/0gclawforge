"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Book,
  Code2,
  Cpu,
  Database,
  Gamepad2,
  Globe,
  Key,
  Layers,
  MessageSquare,
  ScrollText,
  Shield,
  Users,
  Vote,
  Zap,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-ember">
      {children}
    </code>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-lg font-bold text-parchment">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 leading-relaxed text-stone/90">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 ml-4 list-disc space-y-1 text-stone/80">{children}</ul>;
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="mb-4 overflow-x-auto rounded border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-parchment">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-stone/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sections                                                           */
/* ------------------------------------------------------------------ */

const sections: Section[] = [
  {
    id: "overview",
    icon: <Book className="h-5 w-5" />,
    title: "Overview",
    content: (
      <>
        <P>
          <strong>0GClawForge</strong> is a sovereign agent operating system that combines the
          OpenClaw autonomous agent framework with the 0G decentralized AI ecosystem. It enables
          the creation, governance, and gameplay of <strong>Eternal Clans</strong> — on-chain AI
          collectives that own memory, generate realms, run autonomous behavior, and evolve through
          community governance.
        </P>
        <H3>Core Pillars</H3>
        <UL>
          <li><strong>0G Storage</strong> — Content-addressable immutable storage for all agent data (memories, realms, votes)</li>
          <li><strong>0G Compute</strong> — Decentralized AI inference for realm generation, NPC dialogue, and clan chat</li>
          <li><strong>0G Chain</strong> — ERC-7857 intelligent NFTs (iNFTs) that store encrypted agent intelligence on-chain</li>
          <li><strong>OpenClaw</strong> — Autonomous agent skills framework for social integrations (Telegram, Discord)</li>
        </UL>
        <H3>Architecture</H3>
        <P>
          The project is a Turbo monorepo with four main packages: the <Code>@0gclawforge/sdk</Code>{" "}
          TypeScript wrapper library, Solidity smart contracts, the Next.js dashboard application,
          and the OpenClaw agent fork with custom skills.
        </P>
      </>
    ),
  },
  {
    id: "smart-contracts",
    icon: <ScrollText className="h-5 w-5" />,
    title: "Smart Contracts",
    content: (
      <>
        <H3>AgentInft.sol — ERC-7857 Intelligent NFT</H3>
        <P>
          The core contract implements ERC-721 with ERC-7857 encrypted metadata extensions.
          Each token represents a clan with on-chain state tracking for memory, realms, votes,
          and evolution history.
        </P>
        <Table
          headers={["Function", "Description"]}
          rows={[
            ["mintClan(to, uri)", "Mints a new clan iNFT with initial metadata URI"],
            ["updateMemoryRoot(tokenId, rootHash)", "Updates the 0G Storage root hash for clan memory"],
            ["updateRealmRoot(tokenId, rootHash)", "Updates the active realm root hash"],
            ["updateVoteRoot(tokenId, rootHash)", "Updates the governance vote chain root"],
            ["getClanState(tokenId)", "Returns full on-chain state: memory/realm/vote roots + counters"],
            ["evolve(tokenId, newURI)", "Triggers clan evolution, incrementing evolution counter"],
          ]}
        />
        <H3>Network Deployment</H3>
        <Table
          headers={["Network", "Chain ID", "RPC"]}
          rows={[
            ["0G Galileo Testnet", "16602", "https://evmrpc-testnet.0g.ai"],
            ["0G Mainnet", "16661", "https://evmrpc.0g.ai"],
          ]}
        />
      </>
    ),
  },
  {
    id: "sdk",
    icon: <Code2 className="h-5 w-5" />,
    title: "SDK Package",
    content: (
      <>
        <P>
          The <Code>@0gclawforge/sdk</Code> package provides typed wrappers around all 0G SDKs.
          All application code must use these wrappers instead of calling 0G SDKs directly.
        </P>
        <H3>Storage Utilities</H3>
        <UL>
          <li><Code>uploadJSON(data, config)</Code> — Serializes and uploads JSON to 0G Storage, returns root hash + tx hash</li>
          <li><Code>downloadFromStorage(rootHash, filePath, config)</Code> — Downloads content by root hash to local file</li>
          <li><Code>StorageConfig</Code> — Type with rpcUrl, indexerUrl, and optional privateKey</li>
        </UL>
        <H3>Compute Client</H3>
        <UL>
          <li><Code>ZGComputeClient</Code> — Wraps 0G Serving Broker for AI inference</li>
          <li><Code>client.setupProvider(address)</Code> — Initializes the compute provider</li>
          <li><Code>client.query(prompt, options)</Code> — Sends inference request, returns text + verification status</li>
        </UL>
        <H3>Contract ABI</H3>
        <UL>
          <li><Code>agentInftAbi</Code> — Exported ABI for the AgentInft contract</li>
        </UL>
      </>
    ),
  },
  {
    id: "storage",
    icon: <Database className="h-5 w-5" />,
    title: "0G Storage",
    content: (
      <>
        <P>
          0G Storage is a content-addressable immutable storage layer. Every piece of data — memories,
          realms, vote records — is stored as a JSON blob and identified by its <strong>root hash</strong>.
          Root hashes serve as URIs stored on-chain in the iNFT contract.
        </P>
        <H3>Data Flow</H3>
        <UL>
          <li>Application serializes data to JSON</li>
          <li><Code>uploadJSON()</Code> writes to 0G Storage via the Indexer</li>
          <li>Returns a root hash (content address) and transaction hash</li>
          <li>Root hash is written to the smart contract via <Code>updateMemoryRoot</Code>, <Code>updateRealmRoot</Code>, or <Code>updateVoteRoot</Code></li>
          <li>Readers fetch data by calling the contract for the root hash, then downloading from storage</li>
        </UL>
        <H3>Cross-Network Fallback</H3>
        <P>
          When data was uploaded on testnet but is being accessed on mainnet (or vice versa),
          the system automatically falls back to the testnet storage indexer if the primary
          network lookup fails. This ensures realm data remains accessible across networks.
        </P>
        <H3>Storage Indexers</H3>
        <Table
          headers={["Network", "Indexer URL"]}
          rows={[
            ["Testnet (Galileo)", "https://indexer-storage-testnet-turbo.0g.ai"],
            ["Mainnet", "https://indexer-storage-turbo.0g.ai"],
          ]}
        />
      </>
    ),
  },
  {
    id: "compute",
    icon: <Cpu className="h-5 w-5" />,
    title: "0G Compute",
    content: (
      <>
        <P>
          0G Compute provides decentralized AI inference through a provider network. ClawForge uses
          the <Code>0GM-1.0-35B-A3B</Code> model for all AI-powered features.
        </P>
        <H3>Use Cases</H3>
        <UL>
          <li><strong>Realm Generation</strong> — Transforms user prompts into full game worlds with maps, NPCs, quests, and bosses</li>
          <li><strong>NPC Dialogue</strong> — Live in-game NPC conversations powered by realm context and player state</li>
          <li><strong>Clan Chat</strong> — Strategic advisor AI with access to realm state and game history</li>
          <li><strong>Proposal Evaluation</strong> — AI analysis of governance proposals</li>
          <li><strong>Autonomous Mode</strong> — Self-directed clan behavior including auto-proposals and realm evolution</li>
        </UL>
        <H3>Verification</H3>
        <P>
          Each compute response includes a <Code>verified</Code> flag indicating whether
          the response was cryptographically verified by the 0G network. Verified responses
          are labeled <Code>verified-0g-compute</Code> in the UI.
        </P>
      </>
    ),
  },
  {
    id: "realms",
    icon: <Gamepad2 className="h-5 w-5" />,
    title: "Realm System & Gameplay",
    content: (
      <>
        <P>
          Realms are procedurally generated game worlds created from natural language prompts.
          Each clan can have an active realm stored on 0G Storage with full version history.
        </P>
        <H3>Realm Structure</H3>
        <UL>
          <li><strong>Map</strong> — 16×16 tile grid with terrain types (grass, stone, water, wall, lava, sand, forest, ice)</li>
          <li><strong>NPCs</strong> — Named characters with descriptions, dialogue, positions, and optional quest assignments</li>
          <li><strong>Quests</strong> — Named objectives with descriptions, types (fetch, kill, explore, puzzle), and reward items</li>
          <li><strong>Artifacts</strong> — Collectible items placed on the map with stat effects</li>
          <li><strong>Boss</strong> — End-game enemy with HP, attack, defense, and loot tables</li>
          <li><strong>Spawn Point</strong> — Player starting position</li>
        </UL>
        <H3>Generation Pipeline</H3>
        <P>
          When a clan owner submits a realm prompt, the system first attempts AI generation via
          0G Compute. If compute is unavailable, it falls back to a deterministic generator
          that uses time-based randomness to create unique realms from prompt keywords.
        </P>
        <H3>Gameplay Mechanics</H3>
        <UL>
          <li><strong>Movement</strong> — WASD or arrow keys on the tile map</li>
          <li><strong>Combat</strong> — Turn-based attacks against the boss, using base attack + weapon bonuses</li>
          <li><strong>Quests</strong> — Talk to NPCs, complete objectives, earn inventory items</li>
          <li><strong>Artifacts</strong> — Walk over to collect, granting HP/attack/defense bonuses</li>
          <li><strong>Progress Saving</strong> — Player state (HP, XP, gold, level, inventory) saved to 0G Storage</li>
          <li><strong>Realm History</strong> — Previous realm versions accessible via <Code>previousRealmRootURI</Code> chain</li>
        </UL>
      </>
    ),
  },
  {
    id: "governance",
    icon: <Vote className="h-5 w-5" />,
    title: "Governance & Voting",
    content: (
      <>
        <P>
          Clans are governed through an on-chain proposal and voting system. Any member can submit
          proposals, and the community votes to accept or reject them.
        </P>
        <H3>Proposal Flow</H3>
        <UL>
          <li>A member submits a proposal (via dashboard or Telegram bot)</li>
          <li>The proposal is evaluated by 0G Compute AI for feasibility</li>
          <li>Community members cast Yes/No votes</li>
          <li>Vote results are stored as a linked list on 0G Storage</li>
          <li>Each vote record contains a <Code>previousVoteRoot</Code> pointer to the prior vote</li>
          <li>The latest vote root hash is written to the smart contract</li>
        </UL>
        <H3>Vote History</H3>
        <P>
          The Vote History panel (in the Governance tab) traverses the vote chain by following
          <Code>previousVoteRoot</Code> links from 0G Storage, displaying all past proposals
          with their vote counts, pass/reject status, timestamps, and storage hashes.
        </P>
        <H3>Vote Record Structure</H3>
        <Table
          headers={["Field", "Description"]}
          rows={[
            ["proposal", "The proposal text"],
            ["yesVotes", "Number of yes votes"],
            ["noVotes", "Number of no votes"],
            ["previousVoteRoot", "Root hash of the previous vote record (linked list)"],
            ["createdAt", "Timestamp of vote creation"],
          ]}
        />
      </>
    ),
  },
  {
    id: "autonomous",
    icon: <Zap className="h-5 w-5" />,
    title: "Autonomous Mode",
    content: (
      <>
        <P>
          Autonomous mode allows clans to operate independently — proposing realm changes,
          evolving their identity, and managing governance without constant human input.
        </P>
        <H3>Capabilities</H3>
        <UL>
          <li><strong>Auto-Proposals</strong> — AI generates governance proposals based on clan state and history</li>
          <li><strong>Realm Evolution</strong> — Automatic realm generation and updates</li>
          <li><strong>Memory Management</strong> — Clan memory updates based on events and interactions</li>
          <li><strong>Social Posting</strong> — Automated updates via Telegram/Discord bots</li>
        </UL>
        <P>
          Autonomous behavior is powered by 0G Compute inference and coordinated through
          the OpenClaw skills framework. All autonomous actions are recorded on 0G Storage
          for full auditability.
        </P>
      </>
    ),
  },
  {
    id: "social",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Social Integrations",
    content: (
      <>
        <H3>Telegram Bot</H3>
        <P>
          The Telegram bot provides a conversational interface to clan features directly
          in group chats or DMs.
        </P>
        <Table
          headers={["Command", "Description"]}
          rows={[
            ["/start", "Welcome message and feature overview"],
            ["/status", "Current clan state, realm info, and proposal count"],
            ["/realm", "Active realm details — title, lore, and asset summary"],
            ["/proposal <text> or /propose <text>", "Submit a governance proposal with your text"],
            ["/vote <yes|no>", "Cast a vote on the active proposal"],
            ["/evolve", "Trigger clan evolution"],
            ["/memory", "View clan memory summary"],
            ["/autonomous", "Toggle autonomous mode on/off"],
            ["/help", "List all available commands"],
          ]}
        />
        <H3>Discord Bot</H3>
        <P>
          The Discord integration mirrors Telegram functionality with slash commands,
          enabling clan management from Discord servers. Uses the same underlying
          handler system for consistent behavior across platforms.
        </P>
      </>
    ),
  },
  {
    id: "api",
    icon: <Globe className="h-5 w-5" />,
    title: "API Routes",
    content: (
      <>
        <P>All API routes are Next.js App Router server functions under <Code>/api/</Code>.</P>
        <Table
          headers={["Route", "Methods", "Description"]}
          rows={[
            ["/api/clans", "GET, POST", "List clans, create proposals, store votes, generate realms, manage memory"],
            ["/api/realm/[tokenId]", "GET, POST", "Fetch realm with version history; save player progress"],
            ["/api/realm/[tokenId]/chat", "POST", "Clan advisor chat powered by 0G Compute"],
            ["/api/realm/[tokenId]/npc", "POST", "Live NPC dialogue with realm context"],
            ["/api/votes", "GET", "Fetch vote history chain from 0G Storage"],
            ["/api/agents", "GET, POST", "Agent registry and management"],
            ["/api/autonomy", "POST", "Trigger autonomous clan behavior"],
            ["/api/compute", "POST", "Direct 0G Compute inference endpoint"],
            ["/api/forge", "POST", "Clan forging (minting) operations"],
            ["/api/marketplace", "GET", "Browse available clans and agents"],
            ["/api/memory", "GET, POST", "Clan memory retrieval and updates"],
          ]}
        />
      </>
    ),
  },
  {
    id: "dashboard",
    icon: <Layers className="h-5 w-5" />,
    title: "Dashboard Pages",
    content: (
      <>
        <Table
          headers={["Page", "Path", "Description"]}
          rows={[
            ["Home / App", "/", "Main clan management dashboard with tabs for Overview, Memory, Governance, Realm, Chat, Autonomous"],
            ["Play", "/play", "Browse and enter playable clan realms"],
            ["Play Realm", "/play/[tokenId]", "Full game engine — tile map, combat, quests, NPCs, inventory, boss fights"],
            ["Forge", "/forge", "Create new clans by minting ERC-7857 iNFTs"],
            ["Marketplace", "/marketplace", "Browse and discover clans and agents"],
            ["Memory", "/memory", "View and manage clan memory blobs"],
            ["Swarm", "/swarm", "Multi-agent swarm coordination view"],
            ["Docs", "/docs", "This documentation page"],
          ]}
        />
      </>
    ),
  },
  {
    id: "security",
    icon: <Shield className="h-5 w-5" />,
    title: "Security Model",
    content: (
      <>
        <H3>Key Principles</H3>
        <UL>
          <li><strong>Private keys are server-side only</strong> — Never exposed in client-side bundles or browser code</li>
          <li><strong>ERC-7857 encryption</strong> — Agent intelligence blobs are encrypted before storage on 0G</li>
          <li><strong>Wallet-gated actions</strong> — Mutations require connected wallet signatures</li>
          <li><strong>Content addressing</strong> — 0G Storage root hashes are tamper-proof; data integrity is guaranteed by the network</li>
          <li><strong>Compute verification</strong> — 0G Compute responses include cryptographic verification flags</li>
        </UL>
        <H3>Environment Variables</H3>
        <Table
          headers={["Variable", "Description", "Required"]}
          rows={[
            ["PRIVATE_KEY", "Server-side signing key for 0G Storage/Compute", "Yes"],
            ["OG_COMPUTE_PROVIDER_ADDR", "0G Compute provider address", "For AI features"],
            ["NEXT_PUBLIC_OG_CHAIN_ID", "Default chain ID (16602 or 16661)", "No (defaults to 16602)"],
            ["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "WalletConnect project ID", "For wallet connections"],
          ]}
        />
      </>
    ),
  },
  {
    id: "networks",
    icon: <Key className="h-5 w-5" />,
    title: "Network Reference",
    content: (
      <>
        <H3>0G Galileo Testnet</H3>
        <Table
          headers={["Service", "Endpoint"]}
          rows={[
            ["RPC", "https://evmrpc-testnet.0g.ai"],
            ["Storage Indexer", "https://indexer-storage-testnet-turbo.0g.ai"],
            ["Faucet", "https://faucet.0g.ai"],
            ["Explorer", "https://chainscan-galileo.0g.ai"],
            ["Chain ID", "16602"],
          ]}
        />
        <H3>0G Mainnet</H3>
        <Table
          headers={["Service", "Endpoint"]}
          rows={[
            ["RPC", "https://evmrpc.0g.ai"],
            ["Storage Indexer", "https://indexer-storage-turbo.0g.ai"],
            ["Chain ID", "16661"],
          ]}
        />
      </>
    ),
  },
  {
    id: "contributing",
    icon: <Users className="h-5 w-5" />,
    title: "Development Guide",
    content: (
      <>
        <H3>Prerequisites</H3>
        <UL>
          <li>Node.js 18+</li>
          <li>pnpm 8+</li>
          <li>A 0G testnet wallet with test tokens (get from faucet)</li>
        </UL>
        <H3>Getting Started</H3>
        <P>
          Clone the repository, install dependencies with <Code>pnpm install</Code>, copy
          <Code>.env.example</Code> to <Code>.env</Code> and fill in your private key and
          compute provider address.
        </P>
        <H3>Common Commands</H3>
        <Table
          headers={["Command", "Description"]}
          rows={[
            ["pnpm install", "Install all dependencies"],
            ["pnpm dev", "Start development server"],
            ["npx next build", "Production build (use this, not turbo build)"],
            ["pnpm deploy:testnet", "Deploy contracts to 0G testnet"],
          ]}
        />
        <H3>Project Structure</H3>
        <Table
          headers={["Path", "Description"]}
          rows={[
            ["apps/dashboard/", "Next.js 14 dashboard application"],
            ["apps/openclaw-fork/", "OpenClaw agent fork with custom skills"],
            ["packages/sdk/", "TypeScript SDK wrapping all 0G services"],
            ["packages/contracts/", "Solidity smart contracts"],
            ["agents/", "Telegram/Discord bot and social integrations"],
          ]}
        />
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  return (
    <div className="min-h-screen bg-obsidian text-parchment">
      <div className="mx-auto flex max-w-7xl gap-0 px-4 py-8 md:gap-8 md:px-6">
        {/* Sidebar */}
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 md:block">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-stone/60">
            Documentation
          </h2>
          <nav className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActive(s.id);
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active === s.id
                    ? "bg-ember/20 text-ember"
                    : "text-stone/70 hover:bg-white/5 hover:text-parchment"
                }`}
              >
                {s.icon}
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="mb-2 text-4xl font-black">
              <span className="text-ember">0G</span>ClawForge Documentation
            </h1>
            <p className="mb-10 text-lg text-stone/70">
              Sovereign Agent OS — comprehensive technical reference
            </p>
          </motion.div>

          <div className="space-y-12">
            {sections.map((s, i) => (
              <motion.section
                key={s.id}
                id={s.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.02 }}
                className="scroll-mt-24 rounded-xl border border-white/10 bg-white/[0.02] p-6 md:p-8"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember/20 text-ember">
                    {s.icon}
                  </div>
                  <h2 className="text-2xl font-bold">{s.title}</h2>
                </div>
                {s.content}
              </motion.section>
            ))}
          </div>

          {/* Mobile TOC */}
          <div className="fixed bottom-4 right-4 z-40 md:hidden">
            <details className="group">
              <summary className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-ember text-white shadow-lg">
                <Book className="h-5 w-5" />
              </summary>
              <div className="absolute bottom-14 right-0 w-56 rounded-xl border border-white/10 bg-obsidian/95 p-3 shadow-xl backdrop-blur-xl">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActive(s.id);
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-stone/70 hover:bg-white/5 hover:text-parchment"
                  >
                    <ChevronRight className="h-3 w-3" />
                    {s.title}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
