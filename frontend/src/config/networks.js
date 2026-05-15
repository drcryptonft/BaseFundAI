import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";
import baseLogo from "../assets/chains/base.png";
import arcLogo from "../assets/chains/arc.png";
import robinhoodLogo from "../assets/chains/robinhood.jpg";

const arcRpcUrl = String(import.meta.env.VITE_ARC_RPC_URL || "").trim();
const robinhoodRpcUrl = String(import.meta.env.VITE_ROBINHOOD_RPC_URL || "").trim();

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [arcRpcUrl || "https://rpc.testnet.arc.network"],
    },
    public: {
      http: [arcRpcUrl || "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [robinhoodRpcUrl || "https://rpc.testnet.chain.robinhood.com"],
    },
    public: {
      http: [robinhoodRpcUrl || "https://rpc.testnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const supportedChains = [baseSepolia, arcTestnet, robinhoodTestnet];
export const BASE_SEPOLIA_ID = baseSepolia.id;
export const ARC_TESTNET_ID = arcTestnet.id;
export const ROBINHOOD_TESTNET_ID = robinhoodTestnet.id;
export const DEFAULT_CHAIN_ID = BASE_SEPOLIA_ID;

export const CHAIN_UI = {
  [BASE_SEPOLIA_ID]: {
    id: BASE_SEPOLIA_ID,
    name: "Base Sepolia",
    short: "Base",
    logo: baseLogo,
    hex: `0x${BASE_SEPOLIA_ID.toString(16)}`,
    nativeCurrency: baseSepolia.nativeCurrency,
    rpcUrls: baseSepolia.rpcUrls,
    blockExplorers: baseSepolia.blockExplorers,
  },
  [ARC_TESTNET_ID]: {
    id: ARC_TESTNET_ID,
    name: "Arc Testnet",
    short: "Arc",
    logo: arcLogo,
    hex: `0x${ARC_TESTNET_ID.toString(16)}`,
    nativeCurrency: arcTestnet.nativeCurrency,
    rpcUrls: arcTestnet.rpcUrls,
    blockExplorers: arcTestnet.blockExplorers,
  },
  [ROBINHOOD_TESTNET_ID]: {
    id: ROBINHOOD_TESTNET_ID,
    name: "Robinhood Testnet",
    short: "Robinhood",
    logo: robinhoodLogo,
    hex: `0x${ROBINHOOD_TESTNET_ID.toString(16)}`,
    nativeCurrency: robinhoodTestnet.nativeCurrency,
    rpcUrls: robinhoodTestnet.rpcUrls,
    blockExplorers: robinhoodTestnet.blockExplorers,
  },
};

export const SUPPORTED_CHAIN_IDS = supportedChains.map((chain) => chain.id);

export function getChainUi(chainId) {
  return CHAIN_UI[chainId] || null;
}

export function getChainLabel(chainId) {
  return getChainUi(chainId)?.name || "Unsupported Network";
}

export function isSupportedChain(chainId) {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function getDefaultChainUi() {
  return getChainUi(DEFAULT_CHAIN_ID);
}

export function getSupportedChainNames() {
  return Object.values(CHAIN_UI).map((chain) => chain.name);
}

export function getAddEthereumChainParams(chainId) {
  const chain = getChainUi(chainId);

  if (!chain) {
    return null;
  }

  return {
    chainId: chain.hex,
    chainName: chain.name,
    rpcUrls: chain.rpcUrls?.default?.http || [],
    nativeCurrency: chain.nativeCurrency,
    blockExplorerUrls: chain.blockExplorers?.default?.url
      ? [chain.blockExplorers.default.url]
      : [],
  };
}
