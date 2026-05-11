// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IAgentINFTMarket {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function secureTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newMetadataHash,
        string calldata newStorageURI,
        bytes calldata sealedKey,
        bytes calldata transferProof
    ) external;
}

/**
 * @title AgentMarketplace
 * @notice Marketplace for trading iNFT agents with 2.5% platform fee
 */
contract AgentMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    IAgentINFTMarket public agentINFT;
    address public feeRecipient;
    uint256 public feeBasisPoints; // 250 = 2.5%

    Counters.Counter private _listingIdCounter;

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 createdAt;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public tokenToListing; // tokenId => listingId
    uint256[] private _activeListingIds;

    event ListingCreated(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingSold(uint256 indexed listingId, uint256 indexed tokenId, address buyer, uint256 price);
    event ListingCancelled(uint256 indexed listingId, uint256 indexed tokenId);

    constructor(address _agentINFT, address _feeRecipient, uint256 _feeBasisPoints) {
        agentINFT = IAgentINFTMarket(_agentINFT);
        feeRecipient = _feeRecipient;
        feeBasisPoints = _feeBasisPoints;
    }

    function createListing(uint256 tokenId, uint256 price) external returns (uint256 listingId) {
        require(agentINFT.ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        require(
            agentINFT.getApproved(tokenId) == address(this) ||
            agentINFT.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        _listingIdCounter.increment();
        listingId = _listingIdCounter.current();

        listings[listingId] = Listing({
            listingId: listingId,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            createdAt: block.timestamp,
            active: true
        });
        tokenToListing[tokenId] = listingId;
        _activeListingIds.push(listingId);

        emit ListingCreated(listingId, tokenId, msg.sender, price);
    }

    function buyAgent(
        uint256 listingId,
        bytes32 newMetadataHash,
        string calldata newStorageURI,
        bytes calldata sealedKey,
        bytes calldata transferProof
    ) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(msg.value >= listing.price, "Insufficient payment");

        listing.active = false;

        uint256 fee = (listing.price * feeBasisPoints) / 10000;
        uint256 sellerAmount = listing.price - fee;

        payable(listing.seller).transfer(sellerAmount);
        if (fee > 0) {
            payable(feeRecipient).transfer(fee);
        }

        agentINFT.secureTransfer(
            listing.seller,
            msg.sender,
            listing.tokenId,
            newMetadataHash,
            newStorageURI,
            sealedKey,
            transferProof
        );

        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit ListingSold(listingId, listing.tokenId, msg.sender, listing.price);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(listing.seller == msg.sender, "Not seller");
        listing.active = false;
        emit ListingCancelled(listingId, listing.tokenId);
    }

    function getActiveListings(uint256 offset, uint256 limit)
        external view returns (Listing[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < _activeListingIds.length; i++) {
            if (listings[_activeListingIds[i]].active) count++;
        }

        if (offset >= count) return new Listing[](0);
        uint256 end = offset + limit > count ? count : offset + limit;
        Listing[] memory result = new Listing[](end - offset);

        uint256 idx = 0;
        uint256 found = 0;
        for (uint256 i = 0; i < _activeListingIds.length && idx < end; i++) {
            if (listings[_activeListingIds[i]].active) {
                if (found >= offset) {
                    result[idx] = listings[_activeListingIds[i]];
                    idx++;
                }
                found++;
            }
        }
        return result;
    }
}
