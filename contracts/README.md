# Contracts

The production Solidity source lives in `packages/contracts` to preserve the existing monorepo structure.

Key contracts:

- `AgentINFT.sol`: ERC-7857 clan iNFT with memory, realm, vote, and evolution roots.
- `AgentMarketplace.sol`: trade flow for full iNFT ownership transfer.
- `AgentRegistry.sol`: agent registry.
- `MockOracle.sol`: local/test oracle placeholder for TEE proof verification.
