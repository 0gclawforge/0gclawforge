// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAgentINFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title AgentRegistry
 * @notice On-chain registry for agent capabilities and swarm membership
 */
contract AgentRegistry is Ownable {
    IAgentINFT public agentINFT;

    mapping(uint256 => string[]) private _capabilities;
    mapping(bytes32 => uint256[]) private _swarmMembers;
    mapping(uint256 => bytes32) public agentSwarm;

    event AgentRegistered(uint256 indexed tokenId, bytes32 indexed swarmId, string[] capabilities);
    event CapabilitiesUpdated(uint256 indexed tokenId, string[] capabilities);

    constructor(address _agentINFT) {
        agentINFT = IAgentINFT(_agentINFT);
    }

    function registerAgent(uint256 tokenId, bytes32 swarmId, string[] memory capabilities) external {
        require(agentINFT.ownerOf(tokenId) == msg.sender, "Not owner");
        _capabilities[tokenId] = capabilities;
        agentSwarm[tokenId] = swarmId;
        _swarmMembers[swarmId].push(tokenId);
        emit AgentRegistered(tokenId, swarmId, capabilities);
    }

    function updateCapabilities(uint256 tokenId, string[] memory capabilities) external {
        require(agentINFT.ownerOf(tokenId) == msg.sender, "Not owner");
        _capabilities[tokenId] = capabilities;
        emit CapabilitiesUpdated(tokenId, capabilities);
    }

    function getSwarmMembers(bytes32 swarmId) external view returns (uint256[] memory) {
        return _swarmMembers[swarmId];
    }

    function getAgentCapabilities(uint256 tokenId) external view returns (string[] memory) {
        return _capabilities[tokenId];
    }
}
