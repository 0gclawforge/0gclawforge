import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const testnetChainId = Number(process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);
const testnetRpc = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const testnetExplorer = process.env.VITE_EXPLORER_URL || process.env.NEXT_PUBLIC_OG_EXPLORER || "https://chainscan-galileo.0g.ai";
const mainnetRpc = process.env.MAINNET_RPC_URL || "https://evmrpc.0g.ai";
const mainnetExplorer = process.env.MAINNET_EXPLORER_URL || "https://chainscan.0g.ai";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    "0g-testnet": {
      url: testnetRpc,
      chainId: testnetChainId,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "0g-mainnet": {
      url: mainnetRpc,
      chainId: Number(process.env.MAINNET_CHAIN_ID || 16661),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      "0g-testnet": "no-api-key-needed",
    },
    customChains: [
      {
        network: "0g-testnet",
        chainId: testnetChainId,
        urls: {
          apiURL: `${testnetExplorer}/api`,
          browserURL: testnetExplorer,
        },
      },
      {
        network: "0g-mainnet",
        chainId: Number(process.env.MAINNET_CHAIN_ID || 16661),
        urls: {
          apiURL: `${mainnetExplorer}/api`,
          browserURL: mainnetExplorer,
        },
      },
    ],
  },
};

export default config;
