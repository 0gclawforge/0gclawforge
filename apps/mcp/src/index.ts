#!/usr/bin/env node
/**
 * 0GClawForge MCP server.
 *
 * Exposes clan-aware tools (mint, evolve, propose, query state/memory) plus
 * the neutral 0G primitives (storage, compute, DA, attestation) over the
 * Model Context Protocol. Drop this into Claude Code / Cursor / Cline /
 * any MCP-compatible runtime to give an agent first-class access to a clan.
 *
 * Usage:
 *   pnpm --filter @0gclawforge/mcp build
 *   node dist/index.js
 *
 * Env vars consumed (all optional except PRIVATE_KEY for write ops):
 *   PRIVATE_KEY, OG_RPC_URL / NEXT_PUBLIC_OG_RPC_URL,
 *   NEXT_PUBLIC_STORAGE_INDEXER, OG_COMPUTE_PROVIDER_ADDR,
 *   NEXT_PUBLIC_AGENT_INFT_ADDRESS, NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS,
 *   OG_DA_ENCODER_URL, OG_DA_API_KEY.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  ClanDA,
  FoundryCompute,
  FoundryStorage,
  anchorQuestOutcome,
  resolveFoundryEnv,
  verifyClanAttestation,
} from "@0gclawforge/foundry";
import { agentInftAbi } from "@0gclawforge/sdk";

const env = resolveFoundryEnv();

const server = new Server(
  { name: "0gclawforge", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const clanIdSchema = z.union([z.string(), z.number(), z.bigint()]);

const tools = [
  {
    name: "clan_get_state",
    description:
      "Read on-chain clan state (memoryRootURI, realmRootURI, voteRootURI, realmCount, proposalCount, evolutionCount) for a tokenId.",
    inputSchema: {
      type: "object",
      properties: { tokenId: { type: ["string", "number"] } },
      required: ["tokenId"],
    },
  },
  {
    name: "clan_list_owned",
    description: "List AgentINFT tokenIds owned by an address.",
    inputSchema: {
      type: "object",
      properties: { owner: { type: "string" } },
      required: ["owner"],
    },
  },
  {
    name: "clan_read_memory",
    description:
      "Download a clan's memory blob from 0G Storage by root hash and return the parsed JSON.",
    inputSchema: {
      type: "object",
      properties: { rootHash: { type: "string" } },
      required: ["rootHash"],
    },
  },
  {
    name: "clan_publish_event",
    description:
      "Anchor a clan event envelope on 0G DA. Returns the digest, DA reference, and canonical encoding.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [
            "clan.quest.outcome",
            "clan.vote.tally",
            "clan.realm.snapshot",
            "clan.evolution.record",
            "clan.memory.delta",
          ],
        },
        tokenId: { type: ["string", "number"] },
        payload: {},
        storageRoot: { type: "string" },
      },
      required: ["kind", "tokenId", "payload"],
    },
  },
  {
    name: "clan_anchor_quest",
    description:
      "End-to-end quest anchor: builds a clan event, publishes the digest to 0G DA, optionally signs a Foundry attestation, optionally calls AgentINFT.recordTaskCompletion.",
    inputSchema: {
      type: "object",
      properties: {
        tokenId: { type: ["string", "number"] },
        prompt: { type: "string" },
        outcome: { type: "string" },
        success: { type: "boolean" },
        teeAttestation: { type: "string" },
        recordOnChain: { type: "boolean" },
      },
      required: ["tokenId", "prompt", "outcome", "success"],
    },
  },
  {
    name: "clan_verify_attestation",
    description:
      "Verify a signed Foundry attestation envelope returned by clan_anchor_quest.",
    inputSchema: {
      type: "object",
      properties: {
        signed: { type: "object" },
        expectedSigner: { type: "string" },
      },
      required: ["signed", "expectedSigner"],
    },
  },
  {
    name: "zerog_storage_upload",
    description: "Upload bytes (utf-8 string or base64) to 0G Storage; returns root + tx hash.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string" },
        encoding: { type: "string", enum: ["utf-8", "base64"] },
      },
      required: ["data"],
    },
  },
  {
    name: "zerog_storage_download",
    description: "Download a 0G Storage blob by root hash; returns base64-encoded bytes.",
    inputSchema: {
      type: "object",
      properties: { rootHash: { type: "string" } },
      required: ["rootHash"],
    },
  },
  {
    name: "zerog_compute_query",
    description:
      "Run an inference request through 0G Compute (via @foundryprotocol/0gkit-compute). Returns the model output and provider address used.",
    inputSchema: {
      type: "object",
      properties: {
        userMessage: { type: "string" },
        systemPrompt: { type: "string" },
        temperature: { type: "number" },
      },
      required: ["userMessage"],
    },
  },
  {
    name: "foundry_env",
    description:
      "Return the resolved Foundry environment (network, chainId, endpoints, contract addresses). Useful for sanity checks before write ops.",
    inputSchema: { type: "object", properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "foundry_env":
        return ok({
          network: env.network,
          chainId: env.chainId,
          rpcUrl: env.rpcUrl,
          indexerUrl: env.indexerUrl,
          daEncoderUrl: env.daEncoderUrl,
          agentInftAddress: env.agentInftAddress,
          marketplaceAddress: env.marketplaceAddress,
          hasPrivateKey: Boolean(env.privateKey),
        });

      case "clan_get_state": {
        const tokenId = parseTokenId(args.tokenId);
        const contract = readContract();
        const [agentData, clanState] = await Promise.all([
          contract.getAgentData(tokenId).catch(() => null),
          contract.getClanState(tokenId).catch(() => null),
        ]);
        return ok({ tokenId: tokenId.toString(), agentData: stringifyBigints(agentData), clanState: stringifyBigints(clanState) });
      }

      case "clan_list_owned": {
        const owner = z.string().parse(args.owner);
        const contract = readContract();
        const balance: bigint = await contract.balanceOf(owner);
        const tokenIds: string[] = [];
        for (let i = 0n; i < balance; i++) {
          const id = await contract.tokenOfOwnerByIndex(owner, i);
          tokenIds.push(String(id));
        }
        return ok({ owner, tokenIds });
      }

      case "clan_read_memory": {
        const rootHash = z.string().parse(args.rootHash);
        const storage = new FoundryStorage({
          rpcUrl: env.rpcUrl,
          indexerUrl: env.indexerUrl,
          privateKey: env.privateKey,
        });
        const json = await storage.downloadJSON(rootHash);
        return ok(json);
      }

      case "clan_publish_event": {
        const kind = z
          .enum([
            "clan.quest.outcome",
            "clan.vote.tally",
            "clan.realm.snapshot",
            "clan.evolution.record",
            "clan.memory.delta",
          ])
          .parse(args.kind);
        const tokenId = parseTokenId(args.tokenId).toString();
        const payload = args.payload;
        const storageRoot = typeof args.storageRoot === "string" ? args.storageRoot : undefined;
        const da = new ClanDA();
        const envelope = da.envelope(kind, tokenId, payload, storageRoot);
        const result = await da.publish(envelope);
        return ok({
          envelope: { kind, tokenId, timestamp: envelope.timestamp, payload, storageRoot },
          digest: result.digest,
          daRef: result.daRef,
          blobId: result.blobId,
          mode: result.mode,
          latencyMs: result.latencyMs,
          canonical: envelope.canonical,
        });
      }

      case "clan_anchor_quest": {
        const tokenId = parseTokenId(args.tokenId).toString();
        const prompt = z.string().parse(args.prompt);
        const outcome = z.string().parse(args.outcome);
        const success = z.boolean().parse(args.success);
        const teeAttestation =
          typeof args.teeAttestation === "string"
            ? (args.teeAttestation as `0x${string}`)
            : undefined;
        const recordOnChain = args.recordOnChain === true;
        const result = await anchorQuestOutcome(
          tokenId,
          { prompt, outcome, success },
          {
            teeAttestation,
            signerKey: env.privateKey,
            recordOnChain,
          },
        );
        return ok({
          envelope: result.envelope,
          digest: result.da.digest,
          daRef: result.da.daRef,
          mode: result.da.mode,
          attestation: result.attestation,
          recordedTx: result.recordedTx,
        });
      }

      case "clan_verify_attestation": {
        const signed = args.signed as Parameters<typeof verifyClanAttestation>[0];
        const expectedSigner = z.string().parse(args.expectedSigner);
        const result = await verifyClanAttestation(signed, expectedSigner);
        return ok(result);
      }

      case "zerog_storage_upload": {
        const data = z.string().parse(args.data);
        const encoding = z.enum(["utf-8", "base64"]).default("utf-8").parse(args.encoding ?? "utf-8");
        const bytes = encoding === "base64" ? Buffer.from(data, "base64") : Buffer.from(data, "utf-8");
        const storage = new FoundryStorage({
          rpcUrl: env.rpcUrl,
          indexerUrl: env.indexerUrl,
          privateKey: env.privateKey,
        });
        const r = await storage.upload(bytes);
        return ok(r);
      }

      case "zerog_storage_download": {
        const rootHash = z.string().parse(args.rootHash);
        const storage = new FoundryStorage({
          rpcUrl: env.rpcUrl,
          indexerUrl: env.indexerUrl,
        });
        const bytes = await storage.download(rootHash);
        return ok({ base64: Buffer.from(bytes).toString("base64"), byteLength: bytes.length });
      }

      case "zerog_compute_query": {
        const userMessage = z.string().parse(args.userMessage);
        const systemPrompt =
          typeof args.systemPrompt === "string" ? args.systemPrompt : undefined;
        const temperature =
          typeof args.temperature === "number" ? args.temperature : undefined;
        if (!env.privateKey || !env.computeProvider) {
          throw new Error(
            "zerog_compute_query needs PRIVATE_KEY and OG_COMPUTE_PROVIDER_ADDR in the environment",
          );
        }
        const compute = new FoundryCompute({
          rpcUrl: env.rpcUrl,
          privateKey: env.privateKey,
          providerAddress: env.computeProvider,
        });
        const r = await compute.query(userMessage, { systemPrompt, temperature });
        return ok({ text: r.text, providerAddress: r.providerAddress, verified: r.verified });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

function ok(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, jsonReplacer, 2) }],
  };
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function stringifyBigints(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBigints);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stringifyBigints(v)]),
    );
  }
  return value;
}

function parseTokenId(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("tokenId must be a string, number, or bigint");
}

function readContract(): ethers.Contract {
  if (!env.agentInftAddress) {
    throw new Error("NEXT_PUBLIC_AGENT_INFT_ADDRESS is not set");
  }
  const provider = new ethers.JsonRpcProvider(env.rpcUrl);
  return new ethers.Contract(env.agentInftAddress, agentInftAbi as unknown as ethers.InterfaceAbi, provider);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP transport.
  process.stderr.write(`[0gclawforge-mcp] listening on stdio (network=${env.network}, chain=${env.chainId})\n`);
}

main().catch((err) => {
  process.stderr.write(`[0gclawforge-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
