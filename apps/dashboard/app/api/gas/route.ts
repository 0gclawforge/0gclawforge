import { NextRequest, NextResponse } from "next/server";
import { claimMainnetGas, getMainnetGasStatus } from "../../../lib/mainnet-gas-station";

function ipAddress(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Mainnet Gas Station error";
  const status = /not enabled|not configured|temporarily unavailable/i.test(message) ? 503 : 400;
  console.error("Mainnet Gas Station request failed", message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getMainnetGasStatus(request.nextUrl.searchParams.get("address") || undefined));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(
      await claimMainnetGas({
        address: String(body.address || ""),
        issuedAt: Number(body.issuedAt),
        signature: String(body.signature || ""),
        ipAddress: ipAddress(request),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
