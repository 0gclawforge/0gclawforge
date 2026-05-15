import { ethers } from "ethers";
import type { AgentMintParams, ClanMintParams } from "./types";

export const agentInftAbi = [
  {
    type: "function",
    name: "mintClan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "clanName", type: "string" },
      { name: "archetype", type: "string" },
      { name: "modelType", type: "string" },
      { name: "metadataHash", type: "bytes32" },
      { name: "storageURI", type: "string" },
      { name: "memoryRootURI", type: "string" },
      { name: "realmRootURI", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "updateRealmRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newRealmRootURI", type: "string" },
      { name: "newRealmCount", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateVoteRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newVoteRootURI", type: "string" },
      { name: "newProposalCount", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordClanEvolution",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newMetadataHash", type: "bytes32" },
      { name: "newStorageURI", type: "string" },
      { name: "newMemoryRootURI", type: "string" },
      { name: "newRealmRootURI", type: "string" },
      { name: "newMemorySize", type: "uint256" },
      { name: "newRealmCount", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getClanState",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "memoryRootURI", type: "string" },
          { name: "realmRootURI", type: "string" },
          { name: "voteRootURI", type: "string" },
          { name: "realmCount", type: "uint256" },
          { name: "proposalCount", type: "uint256" },
          { name: "evolutionCount", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAgentData",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "metadataHash", type: "bytes32" },
          { name: "encryptedStorageURI", type: "string" },
          { name: "agentName", type: "string" },
          { name: "agentPersonality", type: "string" },
          { name: "modelType", type: "string" },
          { name: "skillCount", type: "uint256" },
          { name: "taskCount", type: "uint256" },
          { name: "memorySize", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "lastActiveAt", type: "uint256" },
          { name: "isListedForSale", type: "bool" },
          { name: "salePrice", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ABI subset for AgentINFT interactions
const AGENT_INFT_ABI = [
  "function mint(address to, string agentName, string personality, string modelType, bytes32 metadataHash, string storageURI) returns (uint256)",
  "function mintClan(address to, string clanName, string archetype, string modelType, bytes32 metadataHash, string storageURI, string memoryRootURI, string realmRootURI) returns (uint256)",
  "function getAgentData(uint256 tokenId) view returns (tuple(bytes32 metadataHash, string encryptedStorageURI, string agentName, string agentPersonality, string modelType, uint256 skillCount, uint256 taskCount, uint256 memorySize, uint256 createdAt, uint256 lastActiveAt, bool isListedForSale, uint256 salePrice))",
  "function getClanState(uint256 tokenId) view returns (tuple(string memoryRootURI, string realmRootURI, string voteRootURI, uint256 realmCount, uint256 proposalCount, uint256 evolutionCount))",
  "function updateMetadata(uint256 tokenId, bytes32 newMetadataHash, string newStorageURI, uint256 newMemorySize, bytes proof)",
  "function updateRealmRoot(uint256 tokenId, string newRealmRootURI, uint256 newRealmCount, bytes proof)",
  "function updateVoteRoot(uint256 tokenId, string newVoteRootURI, uint256 newProposalCount, bytes proof)",
  "function recordClanEvolution(uint256 tokenId, bytes32 newMetadataHash, string newStorageURI, string newMemoryRootURI, string newRealmRootURI, uint256 newMemorySize, uint256 newRealmCount, bytes proof)",
  "function secureTransfer(address from, address to, uint256 tokenId, bytes32 newMetadataHash, string newStorageURI, bytes sealedKey, bytes transferProof)",
  "function listForSale(uint256 tokenId, uint256 price)",
  "function delist(uint256 tokenId)",
  "function recordTaskCompletion(uint256 tokenId)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string agentName, string encryptedStorageURI)",
];

export class INFTClient {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(contractAddress: string, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, AGENT_INFT_ABI, signer);
  }

  async mintAgent(
    params: AgentMintParams
  ): Promise<{ tokenId: number; txHash: string }> {
    const tx = await this.contract.mint(
      params.to,
      params.agentName,
      params.personality,
      params.modelType,
      params.metadataHash,
      params.storageURI
    );
    const receipt = await tx.wait();

    const event = receipt?.logs
      .map((log: any) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "AgentMinted");

    const tokenId = Number(event?.args?.tokenId ?? 0);
    return { tokenId, txHash: receipt?.hash ?? "" };
  }

  async mintClan(
    params: ClanMintParams
  ): Promise<{ tokenId: number; txHash: string }> {
    const tx = await this.contract.mintClan(
      params.to,
      params.agentName,
      params.personality,
      params.modelType,
      params.metadataHash,
      params.storageURI,
      params.memoryRootURI,
      params.realmRootURI
    );
    const receipt = await tx.wait();

    const event = receipt?.logs
      .map((log: any) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "ClanMinted" || e?.name === "AgentMinted");

    const tokenId = Number(event?.args?.tokenId ?? 0);
    return { tokenId, txHash: receipt?.hash ?? "" };
  }

  async getAgentData(tokenId: number) {
    return await this.contract.getAgentData(tokenId);
  }

  async getClanState(tokenId: number) {
    return await this.contract.getClanState(tokenId);
  }

  async updateVoteRoot(tokenId: number, voteRootUri: string, proposalCount: number, proof = "0x00") {
    const tx = await this.contract.updateVoteRoot(tokenId, voteRootUri, proposalCount, proof);
    return await tx.wait();
  }

  async recordClanEvolution(
    tokenId: number,
    metadataHash: string,
    storageUri: string,
    memoryRootUri: string,
    realmRootUri: string,
    memorySize: number,
    realmCount: number,
    proof = "0x00"
  ) {
    const tx = await this.contract.recordClanEvolution(
      tokenId,
      metadataHash,
      storageUri,
      memoryRootUri,
      realmRootUri,
      memorySize,
      realmCount,
      proof
    );
    return await tx.wait();
  }

  async listForSale(tokenId: number, priceWei: bigint) {
    const tx = await this.contract.listForSale(tokenId, priceWei);
    return await tx.wait();
  }

  async recordTaskCompletion(tokenId: number) {
    const tx = await this.contract.recordTaskCompletion(tokenId);
    return await tx.wait();
  }

  async getAllAgentsForOwner(ownerAddress: string): Promise<number[]> {
    const balance = await this.contract.balanceOf(ownerAddress);
    const tokenIds: number[] = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await this.contract.tokenOfOwnerByIndex(ownerAddress, i);
      tokenIds.push(Number(tokenId));
    }
    return tokenIds;
  }

  async getListedAgents(): Promise<
    Array<{ tokenId: number; price: bigint; owner: string }>
  > {
    const totalSupply = await this.contract.totalSupply();
    const listed: Array<{ tokenId: number; price: bigint; owner: string }> = [];
    for (let i = 1; i <= Number(totalSupply); i++) {
      const data = await this.contract.getAgentData(i);
      if (data.isListedForSale) {
        const owner = await this.contract.ownerOf(i);
        listed.push({ tokenId: i, price: data.salePrice, owner });
      }
    }
    return listed;
  }
}
