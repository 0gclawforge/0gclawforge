import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentINFT", function () {
  let inft: any;
  let oracle: any;
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

  it("should mint an entire clan as one iNFT", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("clan"));
    await inft.mintClan(
      owner.address,
      "Iron Grove",
      "verifiable realm builders",
      "gemma-3-27b",
      hash,
      "0g://metadata-root",
      "0g://memory-root",
      "0g://realm-root"
    );

    expect(await inft.ownerOf(1)).to.equal(owner.address);
    const data = await inft.getAgentData(1);
    const clan = await inft.getClanState(1);
    expect(data.agentName).to.equal("Iron Grove");
    expect(clan.memoryRootURI).to.equal("0g://memory-root");
    expect(clan.realmRootURI).to.equal("0g://realm-root");
    expect(clan.realmCount).to.equal(1);
  });

  it("should store community vote roots permanently", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("vote"));
    await inft.mintClan(
      owner.address,
      "Vote Clan",
      "community governed",
      "gemma-3-27b",
      hash,
      "0g://metadata-root",
      "0g://memory-root",
      ""
    );

    await inft.updateVoteRoot(1, "0g://vote-root", 1, "0x00");
    const clan = await inft.getClanState(1);
    expect(clan.voteRootURI).to.equal("0g://vote-root");
    expect(clan.proposalCount).to.equal(1);
  });

  it("should record TEE-driven clan evolution roots", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("clan-v1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("clan-v2"));
    await inft.mintClan(
      owner.address,
      "Evolving Clan",
      "adaptive world builders",
      "gemma-3-27b",
      hash1,
      "0g://metadata-v1",
      "0g://memory-v1",
      "0g://realm-v1"
    );

    await inft.recordClanEvolution(
      1,
      hash2,
      "0g://metadata-v2",
      "0g://memory-v2",
      "0g://realm-v2",
      2048,
      2,
      "0x00"
    );

    const data = await inft.getAgentData(1);
    const clan = await inft.getClanState(1);
    expect(data.taskCount).to.equal(1);
    expect(data.memorySize).to.equal(2048);
    expect(clan.memoryRootURI).to.equal("0g://memory-v2");
    expect(clan.realmRootURI).to.equal("0g://realm-v2");
    expect(clan.evolutionCount).to.equal(1);
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
