# 0G Compute Skill

Run TEE-verified AI inference on the 0G Compute Network. Micropayment-settled.

## Triggers
- "run AI inference on 0G"
- "ask * via 0G Compute"
- "TEE-verified query *"
- "query 0G AI"

## SDK
npm install @0glabs/0g-serving-broker ethers openai

## Complete Flow
```typescript
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import OpenAI from "openai";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

await broker.ledger.addLedger(3);
const providerAddr = "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08";
await broker.inference.acknowledgeProviderSigner(providerAddr);
await broker.ledger.transferFund(providerAddr, "inference", ethers.parseEther("1.0"));

const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
const headers = await broker.inference.getRequestHeaders(providerAddr, "user message");

const openai = new OpenAI({ baseURL: endpoint, apiKey: "" });
const completion = await openai.chat.completions.create(
  { model, messages: [{ role: "user", content: "Hello, 0G!" }] },
  { headers: headers as Record<string, string> }
);

await broker.inference.processResponse(providerAddr, completion, completion.id);
```

## Notes
- processResponse() is required for payment settlement.
- All testnet providers have TeeML verifiability.
- Minimum ledger deposit: 3 OG tokens.
