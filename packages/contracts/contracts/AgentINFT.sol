// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
    function verifyTransferProof(
        uint256 tokenId,
        address from,
        address to,
        bytes32 oldMetadataHash,
        bytes32 newMetadataHash,
        bytes calldata proof
    ) external view returns (bool);
}

/**
 * @title AgentINFT
 * @notice ERC-7857 Intelligent NFT for sovereign AI agents on 0GClawForge
 */
contract AgentINFT is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    IOracle public oracle;

    struct AgentMetadata {
        bytes32 metadataHash;
        string encryptedStorageURI;
        string agentName;
        string agentPersonality;
        string modelType;
        uint256 skillCount;
        uint256 taskCount;
        uint256 memorySize;
        uint256 createdAt;
        uint256 lastActiveAt;
        bool isListedForSale;
        uint256 salePrice;
    }

    mapping(uint256 => AgentMetadata) public agentData;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    mapping(uint256 => bytes) private _sealedKeys;

    event AgentMinted(uint256 indexed tokenId, address indexed owner, string agentName, string encryptedStorageURI);
    event AgentMetadataUpdated(uint256 indexed tokenId, bytes32 newHash, string newStorageURI);
    event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newMetadataHash);
    event AgentListedForSale(uint256 indexed tokenId, uint256 price);
    event AgentDelisted(uint256 indexed tokenId);
    event AgentTaskCompleted(uint256 indexed tokenId, uint256 totalTasks);
    event MemoryUpdated(uint256 indexed tokenId, uint256 newMemorySize);

    constructor(address _oracle) ERC721("0GClawForge Agent", "FORGE") {
        oracle = IOracle(_oracle);
    }

    function mint(
        address to,
        string calldata agentName,
        string calldata personality,
        string calldata modelType,
        bytes32 metadataHash,
        string calldata storageURI
    ) external returns (uint256 tokenId) {
        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);

        agentData[tokenId] = AgentMetadata({
            metadataHash: metadataHash,
            encryptedStorageURI: storageURI,
            agentName: agentName,
            agentPersonality: personality,
            modelType: modelType,
            skillCount: 0,
            taskCount: 0,
            memorySize: 0,
            createdAt: block.timestamp,
            lastActiveAt: block.timestamp,
            isListedForSale: false,
            salePrice: 0
        });

        emit AgentMinted(tokenId, to, agentName, storageURI);
    }

    function updateMetadata(
        uint256 tokenId,
        bytes32 newMetadataHash,
        string calldata newStorageURI,
        uint256 newMemorySize,
        bytes calldata proof
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(oracle.verifyProof(proof), "Invalid proof");

        agentData[tokenId].metadataHash = newMetadataHash;
        agentData[tokenId].encryptedStorageURI = newStorageURI;
        agentData[tokenId].memorySize = newMemorySize;
        agentData[tokenId].lastActiveAt = block.timestamp;

        emit AgentMetadataUpdated(tokenId, newMetadataHash, newStorageURI);
        emit MemoryUpdated(tokenId, newMemorySize);
    }

    function secureTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newMetadataHash,
        string calldata newStorageURI,
        bytes calldata sealedKey,
        bytes calldata transferProof
    ) external nonReentrant {
        require(ownerOf(tokenId) == from, "Not owner");
        require(
            msg.sender == from ||
            getApproved(tokenId) == msg.sender ||
            isApprovedForAll(from, msg.sender),
            "Not authorized"
        );
        require(
            oracle.verifyTransferProof(
                tokenId, from, to,
                agentData[tokenId].metadataHash,
                newMetadataHash,
                transferProof
            ),
            "Invalid transfer proof"
        );

        agentData[tokenId].metadataHash = newMetadataHash;
        agentData[tokenId].encryptedStorageURI = newStorageURI;
        agentData[tokenId].lastActiveAt = block.timestamp;
        _sealedKeys[tokenId] = sealedKey;

        if (agentData[tokenId].isListedForSale) {
            agentData[tokenId].isListedForSale = false;
            agentData[tokenId].salePrice = 0;
        }

        _transfer(from, to, tokenId);
        emit AgentTransferred(tokenId, from, to, newMetadataHash);
    }

    function recordTaskCompletion(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        agentData[tokenId].taskCount++;
        agentData[tokenId].lastActiveAt = block.timestamp;
        emit AgentTaskCompleted(tokenId, agentData[tokenId].taskCount);
    }

    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        agentData[tokenId].isListedForSale = true;
        agentData[tokenId].salePrice = price;
        emit AgentListedForSale(tokenId, price);
    }

    function delist(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        agentData[tokenId].isListedForSale = false;
        agentData[tokenId].salePrice = 0;
        emit AgentDelisted(tokenId);
    }

    function getAgentData(uint256 tokenId) external view returns (AgentMetadata memory) {
        return agentData[tokenId];
    }

    function getSealedKey(uint256 tokenId) external view returns (bytes memory) {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        return _sealedKeys[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return agentData[tokenId].encryptedStorageURI;
    }

    function _beforeTokenTransfer(
        address from, address to, uint256 tokenId, uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
