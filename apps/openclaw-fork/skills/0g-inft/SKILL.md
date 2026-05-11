# 0G iNFT / ERC-7857 Skill

Mint, transfer, and manage Intelligent NFT agents on 0G Chain.

## Triggers
- "mint agent"
- "create iNFT"
- "transfer agent"
- "list agent for sale"

## What is ERC-7857?
Extension of ERC-721 for AI agents with encrypted metadata, secure re-encryption during transfer, and dynamic metadata updates as agents learn.

## Mint Agent
```typescript
const tx = await inftContract.mint(
  ownerAddress, "AgentName", "Helpful assistant", "gemma-3-27b",
  metadataHash, storageRootHash
);
```

## Update Metadata (after agent learns)
```typescript
await inftContract.updateMetadata(tokenId, newMetadataHash, newStorageRootHash, newMemorySizeBytes, "0x00");
```

## Secure Transfer (ERC-7857)
```typescript
await inftContract.secureTransfer(from, to, tokenId, newMetadataHash, newStorageURI, sealedKey, transferProof);
```

## Notes
- metadataHash = keccak256(encryptedIntelligenceBlob)
- storageURI = 0G Storage root hash (0x-prefixed 66 chars)
- On testnet: use MockOracle which accepts any proof bytes
