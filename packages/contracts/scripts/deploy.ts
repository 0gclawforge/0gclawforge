import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const explorer =
    process.env.VITE_EXPLORER_URL ||
    process.env.NEXT_PUBLIC_OG_EXPLORER ||
    (network.chainId === 16661n ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai");

  console.log("Deploying to 0G Chain with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
    "0G"
  );

  // 1. Deploy MockOracle
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("MockOracle:", await oracle.getAddress());

  // 2. Deploy AgentINFT
  const AgentINFT = await ethers.getContractFactory("AgentINFT");
  const inft = await AgentINFT.deploy(await oracle.getAddress());
  await inft.waitForDeployment();
  console.log("AgentINFT:", await inft.getAddress());

  // 3. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy(await inft.getAddress());
  await registry.waitForDeployment();
  console.log("AgentRegistry:", await registry.getAddress());

  // 4. Deploy AgentMarketplace
  const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(
    await inft.getAddress(),
    deployer.address,
    250
  );
  await marketplace.waitForDeployment();
  console.log("AgentMarketplace:", await marketplace.getAddress());

  // 5. Write addresses
  const addresses = {
    NEXT_PUBLIC_MOCK_ORACLE_ADDRESS: await oracle.getAddress(),
    NEXT_PUBLIC_AGENT_INFT_ADDRESS: await inft.getAddress(),
    NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: await registry.getAddress(),
    NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS: await marketplace.getAddress(),
    DEPLOYED_AT: new Date().toISOString(),
    CHAIN_ID: network.chainId.toString(),
  };

  fs.writeFileSync(
    ".env.deployed",
    Object.entries(addresses)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")
  );

  console.log("\n✅ Deployment complete! Addresses written to .env.deployed");
  console.log(
    "🔗 Explorer:",
    `${explorer}/address/${await inft.getAddress()}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
