import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentInftAddress, getAgentMarketplaceAddress, getOgRpcUrl } from "../../../lib/contract-addresses";

const INFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function getAgentData(uint256) view returns (tuple(bytes32,string,string,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256))",
  "function ownerOf(uint256) view returns (address)",
];

const MARKETPLACE_ABI = [
  "function getActiveListings(uint256 offset, uint256 limit) view returns (tuple(uint256 listingId,uint256 tokenId,address seller,uint256 price,uint256 createdAt,bool active)[])",
  "function tokenToListing(uint256 tokenId) view returns (uint256)",
  "function listings(uint256 listingId) view returns (uint256 listingId,uint256 tokenId,address seller,uint256 price,uint256 createdAt,bool active)",
];

export async function GET(req: NextRequest) {
  try {
    const chainId = Number(req.nextUrl.searchParams.get("chainId") || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);
    const contractAddr = getAgentInftAddress(chainId);
    const marketplaceAddress = getAgentMarketplaceAddress(chainId);
    if (!contractAddr || !marketplaceAddress) {
      return NextResponse.json({ listings: [] });
    }

    const provider = new ethers.JsonRpcProvider(getOgRpcUrl(chainId));
    const contract = new ethers.Contract(contractAddr, INFT_ABI, provider);
    const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, provider);
    const activeListings = await marketplace.getActiveListings(0, 100);

    const listings = [];

    for (const listing of activeListings) {
      if (!listing.active) continue;
      const tokenId = Number(listing.tokenId);
      const data = await contract.getAgentData(tokenId);
      listings.push({
        listingId: Number(listing.listingId),
        tokenId,
        name: data[2],
        personality: data[3],
        modelType: data[4],
        taskCount: Number(data[6]),
        memorySize: Number(data[7]),
        owner: listing.seller,
        marketplaceAddress: marketplaceAddress.toLowerCase(),
        price: ethers.formatEther(listing.price),
        capabilities: [],
        source: "marketplace",
      });
    }

    const totalSupply = await contract.totalSupply();
    for (let i = 1; i <= Number(totalSupply); i++) {
      const data = await contract.getAgentData(i);
      if (data[10]) {
        const existingListingId = await marketplace.tokenToListing(i).catch(() => BigInt(0));
        if (existingListingId && existingListingId !== BigInt(0)) {
          const marketplaceListing = await marketplace.listings(existingListingId).catch(() => null);
          if (marketplaceListing?.active) continue;
        }
        const owner = await contract.ownerOf(i);
        listings.push({
          tokenId: i,
          name: data[2],
          personality: data[3],
          modelType: data[4],
          taskCount: Number(data[6]),
          memorySize: Number(data[7]),
          owner,
          marketplaceAddress: marketplaceAddress.toLowerCase(),
          price: ethers.formatEther(data[11]),
          capabilities: [],
          source: "inft-legacy",
        });
      }
    }

    return NextResponse.json({ listings });
  } catch (err: any) {
    return NextResponse.json({ listings: [], error: err.message });
  }
}
