import { NextRequest, NextResponse } from "next/server";
import { ZGComputeClient } from "@0gclawforge/sdk";

let computeClient: ZGComputeClient | null = null;

function getComputeClient(): ZGComputeClient {
  if (!computeClient) {
    const rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDR;

    if (!rpcUrl || !privateKey || !providerAddress) {
      throw new Error("0G Compute not configured: need RPC URL, PRIVATE_KEY, and OG_COMPUTE_PROVIDER_ADDR");
    }

    computeClient = new ZGComputeClient({ rpcUrl, privateKey, providerAddress });
  }
  return computeClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task, workerCount = 3, action } = body;

    if (!task) {
      return NextResponse.json({ error: "task required" }, { status: 400 });
    }

    const client = getComputeClient();

    if (action === "swarm") {
      const result = await client.runSwarmTask(task, workerCount);
      return NextResponse.json(result);
    }

    const result = await client.query(task);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
