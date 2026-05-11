# 0G Chain Skill

Deploy contracts and send transactions on 0G Chain (EVM-compatible).

## Triggers
- "deploy contract to 0G"
- "send transaction on 0G"
- "check balance on 0G"

## Network Details
- Testnet (Galileo): chainId 16602, RPC https://evmrpc-testnet.0g.ai
- Mainnet: chainId 16661, RPC https://evmrpc.0g.ai
- Explorer: https://chainscan-galileo.0g.ai
- Faucet: https://faucet.0g.ai

## Deploy Contract
```typescript
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);
const contract = await factory.deploy(...args);
await contract.waitForDeployment();
console.log("Deployed to:", await contract.getAddress());
```
