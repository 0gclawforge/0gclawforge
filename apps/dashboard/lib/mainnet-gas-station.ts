import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { agentInftAbi } from "@0gclawforge/sdk/inft";
import { buildMainnetGasClaimMessage, OG_MAINNET_CHAIN_ID } from "@0gclawforge/sdk/gas";
import { ethers } from "ethers";
import { getAgentInftAddress, getOgRpcUrl } from "./contract-addresses";

interface GasGrant {
  address: string;
  ipHash: string;
  amountWei: string;
  txHash: string;
  claimedAt: number;
}

interface GasGrantLedger {
  version: 1;
  updatedAt: number;
  grants: GasGrant[];
}

export interface MainnetGasClaimInput {
  address: string;
  issuedAt: number;
  signature: string;
  ipAddress: string;
}

const globalGasState = globalThis as typeof globalThis & {
  mainnetGasMutationQueue?: Promise<unknown>;
};

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
}

function amountEnv(name: string, fallback: string) {
  const value = process.env[name] || fallback;
  try {
    return ethers.parseEther(value);
  } catch {
    throw new Error(`${name} must be a valid OG amount`);
  }
}

function config() {
  return {
    enabled: process.env.MAINNET_GAS_STATION_ENABLED === "true",
    grantWei: amountEnv("MAINNET_FAUCET_GRANT_OG", "0.002"),
    dailyCapWei: amountEnv("MAINNET_FAUCET_DAILY_CAP_OG", "0.05"),
    minTreasuryWei: amountEnv("MAINNET_FAUCET_MIN_BALANCE_OG", "0.02"),
    maxRecipientWei: amountEnv("MAINNET_FAUCET_MAX_CLAN_BALANCE_OG", "0.01"),
    addressCooldownMs: numberEnv("MAINNET_FAUCET_COOLDOWN_HOURS", 168) * 60 * 60 * 1000,
    ipCooldownMs: numberEnv("MAINNET_FAUCET_IP_COOLDOWN_HOURS", 24) * 60 * 60 * 1000,
  };
}

function treasuryPrivateKey() {
  const privateKey = process.env.MAINNET_FAUCET_PRIVATE_KEY?.trim().split(/\s+/)[0];
  const appPrivateKey = process.env.PRIVATE_KEY?.trim().split(/\s+/)[0];
  if (privateKey && appPrivateKey && privateKey.toLowerCase() === appPrivateKey.toLowerCase()) {
    throw new Error("MAINNET_FAUCET_PRIVATE_KEY must use a dedicated wallet");
  }
  return privateKey;
}

function ledgerPath() {
  return process.env.MAINNET_FAUCET_LEDGER_FILE || join(process.cwd(), ".data", "mainnet-gas-grants.json");
}

async function readLedger(): Promise<GasGrantLedger> {
  try {
    const value = JSON.parse(await readFile(ledgerPath(), "utf8")) as GasGrantLedger;
    return {
      version: 1,
      updatedAt: Number(value.updatedAt || Date.now()),
      grants: Array.isArray(value.grants) ? value.grants : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { version: 1, updatedAt: Date.now(), grants: [] };
  }
}

async function writeLedger(ledger: GasGrantLedger) {
  const filePath = ledgerPath();
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(ledger, null, 2), "utf8");
  await rename(tmpPath, filePath);
}

function hashIp(ipAddress: string) {
  return createHash("sha256").update(ipAddress || "unknown").digest("hex");
}

function requireAddress(address: string) {
  if (!ethers.isAddress(address)) throw new Error("A valid recipient wallet address is required");
  return ethers.getAddress(address);
}

function requireFreshSignature(address: string, issuedAt: number, signature: string) {
  if (!Number.isInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) {
    throw new Error("Claim signature expired. Sign a new request.");
  }
  const recovered = ethers.verifyMessage(buildMainnetGasClaimMessage({ address, issuedAt }), signature);
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Wallet signature does not match the recipient");
  }
}

function lastGrant(grants: GasGrant[], predicate: (grant: GasGrant) => boolean) {
  return grants.filter(predicate).sort((a, b) => b.claimedAt - a.claimedAt)[0];
}

function retryAt(grant: GasGrant | undefined, cooldownMs: number) {
  return grant ? grant.claimedAt + cooldownMs : 0;
}

function publicConfig() {
  const value = config();
  return {
    enabled: value.enabled,
    chainId: OG_MAINNET_CHAIN_ID,
    grantOg: ethers.formatEther(value.grantWei),
    cooldownHours: value.addressCooldownMs / 60 / 60 / 1000,
  };
}

async function getChainContext() {
  const provider = new ethers.JsonRpcProvider(getOgRpcUrl(OG_MAINNET_CHAIN_ID));
  const contract = new ethers.Contract(getAgentInftAddress(OG_MAINNET_CHAIN_ID), agentInftAbi, provider);
  return { provider, contract };
}

export async function getMainnetGasStatus(address?: string) {
  const station = config();
  const ledger = await readLedger();
  const publicStatus: Record<string, unknown> = { ...publicConfig(), treasuryReady: false };
  const privateKey = treasuryPrivateKey();

  if (station.enabled && privateKey) {
    const { provider } = await getChainContext();
    const treasury = new ethers.Wallet(privateKey, provider);
    const treasuryBalance = await provider.getBalance(treasury.address);
    publicStatus.treasuryReady = treasuryBalance >= station.grantWei + station.minTreasuryWei;
  }

  if (!address || !ethers.isAddress(address)) return publicStatus;

  const recipient = ethers.getAddress(address);
  const { provider, contract } = await getChainContext();
  const [balance, clanBalance] = await Promise.all([
    provider.getBalance(recipient),
    contract.balanceOf(recipient) as Promise<bigint>,
  ]);
  const priorGrant = lastGrant(ledger.grants, (grant) => grant.address.toLowerCase() === recipient.toLowerCase());

  return {
    ...publicStatus,
    address: recipient,
    ownsClan: clanBalance > BigInt(0),
    recipientBalanceOg: ethers.formatEther(balance),
    retryAt: retryAt(priorGrant, station.addressCooldownMs),
    eligible:
      station.enabled &&
      Boolean(privateKey) &&
      clanBalance > BigInt(0) &&
      balance <= station.maxRecipientWei &&
      retryAt(priorGrant, station.addressCooldownMs) <= Date.now(),
  };
}

async function claimInsideQueue(input: MainnetGasClaimInput) {
  const station = config();
  if (!station.enabled) throw new Error("The Mainnet Gas Station is not enabled");

  const privateKey = treasuryPrivateKey();
  if (!privateKey) throw new Error("The Mainnet Gas Station treasury is not configured");

  const address = requireAddress(input.address);
  requireFreshSignature(address, Number(input.issuedAt), String(input.signature || ""));

  const ledger = await readLedger();
  const ipHash = hashIp(input.ipAddress);
  const addressGrant = lastGrant(ledger.grants, (grant) => grant.address.toLowerCase() === address.toLowerCase());
  const ipGrant = lastGrant(ledger.grants, (grant) => grant.ipHash === ipHash);
  const now = Date.now();
  if (retryAt(addressGrant, station.addressCooldownMs) > now) {
    throw new Error("This wallet already received a recent Mainnet gas grant");
  }
  if (retryAt(ipGrant, station.ipCooldownMs) > now) {
    throw new Error("A recent Mainnet gas grant was already issued from this network");
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const grantedToday = ledger.grants
    .filter((grant) => new Date(grant.claimedAt).toISOString().slice(0, 10) === today)
    .reduce((sum, grant) => sum + BigInt(grant.amountWei), BigInt(0));
  if (grantedToday + station.grantWei > station.dailyCapWei) {
    throw new Error("The Mainnet Gas Station daily cap has been reached");
  }

  const { provider, contract } = await getChainContext();
  const [recipientBalance, clanBalance] = await Promise.all([
    provider.getBalance(address),
    contract.balanceOf(address) as Promise<bigint>,
  ]);
  if (clanBalance <= BigInt(0)) throw new Error("Only wallets that own a 0GClawForge clan can claim Mainnet gas");
  if (recipientBalance > station.maxRecipientWei) throw new Error("This wallet already has enough Mainnet OG");

  const treasury = new ethers.Wallet(privateKey, provider);
  const treasuryBalance = await provider.getBalance(treasury.address);
  if (treasuryBalance < station.grantWei + station.minTreasuryWei) {
    throw new Error("The Mainnet Gas Station treasury is temporarily unavailable");
  }

  const transaction = await treasury.sendTransaction({ to: address, value: station.grantWei });
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Mainnet gas transfer was not confirmed");

  ledger.grants.push({
    address,
    ipHash,
    amountWei: station.grantWei.toString(),
    txHash: transaction.hash,
    claimedAt: now,
  });
  ledger.updatedAt = now;
  await writeLedger(ledger);

  return {
    ok: true,
    chainId: OG_MAINNET_CHAIN_ID,
    amountOg: ethers.formatEther(station.grantWei),
    txHash: transaction.hash,
    retryAt: now + station.addressCooldownMs,
  };
}

export async function claimMainnetGas(input: MainnetGasClaimInput) {
  const previous = globalGasState.mainnetGasMutationQueue || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalGasState.mainnetGasMutationQueue = previous.then(() => current);

  await previous;
  try {
    return await claimInsideQueue(input);
  } finally {
    release();
  }
}
