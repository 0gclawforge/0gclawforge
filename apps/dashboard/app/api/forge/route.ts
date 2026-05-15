import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { uploadAgentIntelligence, INFTClient } from "@0gclawforge/sdk";
import { createCipheriv, randomBytes } from "crypto";
import { getAgentInftAddress } from "../../../lib/contract-addresses";

function encryptBlob(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  // Prefix IV so it can be decrypted later
  return Buffer.concat([iv, encrypted]).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, personality, model, capabilities, skills, memorySeed } = body;

    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server wallet not configured" }, { status: 500 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL;
    const indexerUrl = process.env.OG_STORAGE_INDEXER_TURBO;
    const inftAddress = getAgentInftAddress();

    if (!rpcUrl || !indexerUrl) {
      return NextResponse.json({ error: "0G endpoints not configured" }, { status: 500 });
    }
    if (!inftAddress) {
      return NextResponse.json({ error: "iNFT contract not deployed" }, { status: 500 });
    }

    // Derive a deterministic encryption key from the private key
    // (In production, use a per-agent key sealed via TEE)
    const encryptionKey = Buffer.from(
      ethers.keccak256(ethers.toUtf8Bytes(privateKey + "_agent_encryption")).slice(2),
      "hex"
    ).subarray(0, 32);

    // Encrypt intelligence fields before uploading to 0G Storage
    const intelligenceBlob = {
      encryptedPersonality: encryptBlob(JSON.stringify(personality ?? ""), encryptionKey),
      encryptedMemoryIndex: encryptBlob(JSON.stringify(memorySeed ?? ""), encryptionKey),
      encryptedSkills: encryptBlob(JSON.stringify({ capabilities, skills }), encryptionKey),
      publicSummary: name,
      modelType: model,
      version: 1,
      timestamp: Date.now(),
    };

    const storageConfig = {
      rpcUrl,
      indexerUrl,
      privateKey,
    };

    // Upload encrypted intelligence blob to 0G Storage
    const { storageURI, metadataHash } = await uploadAgentIntelligence(
      `agent_${Date.now()}`,
      intelligenceBlob,
      storageConfig
    );

    // Mint iNFT on-chain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const inft = new INFTClient(inftAddress, wallet);

    const { tokenId, txHash } = await inft.mintAgent({
      to: wallet.address,
      agentName: name,
      personality: personality || "Default agent",
      modelType: model,
      metadataHash,
      storageURI,
    });

    return NextResponse.json({
      tokenId,
      txHash,
      storageURI,
      metadataHash,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
