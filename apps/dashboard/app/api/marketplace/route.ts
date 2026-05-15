import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentInftAddress } from "../../../lib/contract-addresses";

const INFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function getAgentData(uint256) view returns (tuple(bytes32,string,string,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256))",
  "function ownerOf(uint256) view returns (address)",
];

export async function GET() {
  try {
    const contractAddr = getAgentInftAddress();
    if (!contractAddr) {
      return NextResponse.json({ listings: [] });
    }

    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_OG_RPC_URL);
    const contract = new ethers.Contract(contractAddr, INFT_ABI, provider);

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
