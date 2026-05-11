import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentINFT, MockOracle } from "../typechain-types";

describe("AgentINFT", function () {
  let inft: AgentINFT;
  let oracle: MockOracle;
  let owner: any;
  let buyer: any;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = await MockOracle.deploy();
    const AgentINFT = await ethers.getContractFactory("AgentINFT");
    inft = await AgentINFT.deploy(await oracle.getAddress());
  });

  it("should mint an agent iNFT", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    const tx = await inft.mint(
      owner.address, "TestAgent", "Helpful", "gemma-3-27b", hash, "0x" + "a".repeat(64)
    );
    const receipt = await tx.wait();
    expect(await inft.ownerOf(1)).to.equal(owner.address);
    const data = await inft.getAgentData(1);
    expect(data.agentName).to.equal("TestAgent");
  });

  it("should list and delist for sale", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    await inft.mint(owner.address, "Agent", "Nice", "claude", hash, "0xabc");
    await inft.listForSale(1, ethers.parseEther("1.0"));
    let data = await inft.getAgentData(1);
    expect(data.isListedForSale).to.be.true;
    await inft.delist(1);
    data = await inft.getAgentData(1);
    expect(data.isListedForSale).to.be.false;
  });

  it("should record task completion", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    await inft.mint(owner.address, "Agent", "Nice", "claude", hash, "0xabc");
    await inft.recordTaskCompletion(1);
    await inft.recordTaskCompletion(1);
    const data = await inft.getAgentData(1);
    expect(data.taskCount).to.equal(2);
  });

  it("should perform secure transfer with oracle proof", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("v1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("v2"));
    await inft.mint(owner.address, "Agent", "Nice", "claude", hash1, "0xabc");
    await inft.secureTransfer(
      owner.address, buyer.address, 1, hash2, "0xdef", "0x00", "0x00"
    );
    expect(await inft.ownerOf(1)).to.equal(buyer.address);
  });
});
