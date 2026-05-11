import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentMarketplace", function () {
  let inft: any, marketplace: any, oracle: any;
  let owner: any, buyer: any;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = await MockOracle.deploy();
    const AgentINFT = await ethers.getContractFactory("AgentINFT");
    inft = await AgentINFT.deploy(await oracle.getAddress());
    const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
    marketplace = await AgentMarketplace.deploy(await inft.getAddress(), owner.address, 250);

    // Mint an agent
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    await inft.mint(owner.address, "Agent", "Nice", "claude", hash, "0xabc");
    // Approve marketplace
    await inft.approve(await marketplace.getAddress(), 1);
  });

  it("should create and cancel listing", async function () {
    await marketplace.createListing(1, ethers.parseEther("1.0"));
    const listing = await marketplace.listings(1);
    expect(listing.active).to.be.true;
    expect(listing.seller).to.equal(owner.address);

    await marketplace.cancelListing(1);
    const cancelled = await marketplace.listings(1);
    expect(cancelled.active).to.be.false;
  });

  it("should buy agent with fee", async function () {
    const price = ethers.parseEther("1.0");
    await marketplace.createListing(1, price);
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("v2"));

    await marketplace.connect(buyer).buyAgent(1, hash2, "0xdef", "0x00", "0x00", {
      value: price,
    });
    expect(await inft.ownerOf(1)).to.equal(buyer.address);
  });
});
