import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentInftAddress, getOgRpcUrl } from "../../../lib/contract-addresses";

const INFT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function getAgentData(uint256) view returns (tuple(bytes32,string,string,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256))",
];

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });

  try {
    const chainId = Number(req.nextUrl.searchParams.get("chainId") || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);
    const contractAddress = getAgentInftAddress(chainId);
    if (!contractAddress) {
      return NextResponse.json({ agents: [] });
    }

    const provider = new ethers.JsonRpcProvider(getOgRpcUrl(chainId));
    const contract = new ethers.Contract(
      contractAddress,
      INFT_ABI,
      provider
    );

    const balance = await contract.balanceOf(owner);
    const agents = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(owner, i);
      const data = await contract.getAgentData(tokenId);
      agents.push({
        tokenId: Number(tokenId),
        metadataHash: data[0],
        storageURI: data[1],
        name: data[2],
        personality: data[3],
        modelType: data[4],
        skillCount: Number(data[5]),
        taskCount: Number(data[6]),
        memorySize: Number(data[7]),
        createdAt: Number(data[8]),
        lastActiveAt: Number(data[9]),
        isListed: data[10],
        salePrice: data[11].toString(),
      });
    }

    return NextResponse.json({ agents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
