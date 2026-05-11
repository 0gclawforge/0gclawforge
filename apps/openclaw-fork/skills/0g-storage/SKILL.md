# 0G Storage Skill

Upload and download files to 0G decentralized storage. Returns permanent root hashes.

## Triggers
- "upload * to 0G"
- "store * on 0G"
- "save * permanently"
- "download from 0G *"
- "retrieve from storage *"

## SDK
npm install @0gfoundation/0g-ts-sdk ethers

## Upload Example
```typescript
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const indexer = new Indexer("https://indexer-storage-testnet-turbo.0g.ai");

const data = new TextEncoder().encode("Hello, 0G!");
const memData = new MemData(data);
const [tx, err] = await indexer.upload(memData, "https://evmrpc-testnet.0g.ai", signer);
if (err) throw new Error(err);

const [tree] = await memData.merkleTree();
const rootHash = tree.rootHash(); // 0x-prefixed 66-char string
```

## Download Example
```typescript
const err = await indexer.download(rootHash, "./output.json", true);
if (err) throw new Error(err);
```

## Notes
- Root hash is the permanent address. Store it anywhere (on-chain, in config).
- Turbo network (recommended): faster but higher fees.
- Use MemData for in-memory data, ZgFile for files on disk.
- Browser: use ZgBlob instead of ZgFile. indexer.download() is Node-only.
