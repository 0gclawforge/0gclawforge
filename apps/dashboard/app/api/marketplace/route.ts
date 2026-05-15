import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentInftAddress, getAgentMarketplaceAddress } from "../../../lib/contract-addresses";

const INFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function getAgentData(uint256) view returns (tuple(bytes32,string,string,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256))",
  "function ownerOf(uint256) view returns (address)",
];

export async function GET(req: NextRequest) {
  try {
    const chainId = Number(req.nextUrl.searchParams.get("chainId") || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);
    const contractAddr = getAgentInftAddress(chainId);
    if (!contractAddr) {
      return NextResponse.json({ listings: [] });
    }

    const rpcUrl =
      chainId === 16661
        ? process.env.NEXT_PUBLIC_OG_MAINNET_RPC_URL || "https://evmrpc.0g.ai"
        : process.env.NEXT_PUBLIC_OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddr, INFT_ABI, provider);
    const marketplaceAddress = getAgentMarketplaceAddress(chainId)?.toLowerCase();

    const totalSupply = await contract.totalSupply();
    const listings = [];

    for (let i = 1; i <= Number(totalSupply); i++) {
      const data = await contract.getAgentData(i);
      if (data[10]) {
        // isListedForSale
        const owner = await contract.ownerOf(i);
        listings.push({
          tokenId: i,
          name: data[2],
          personality: data[3],
          modelType: data[4],
          taskCount: Number(data[6]),
          memorySize: Number(data[7]),
          owner,
          marketplaceAddress,
          price: ethers.formatEther(data[11]),
          capabilities: [],
        });
      }
    }

    return NextResponse.json({ listings });
  } catch (err: any) {
    return NextResponse.json({ listings: [], error: err.message });
  }
}
