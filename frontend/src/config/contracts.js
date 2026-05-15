import {
  ARC_TESTNET_ID,
  BASE_SEPOLIA_ID,
  DEFAULT_CHAIN_ID,
  ROBINHOOD_TESTNET_ID,
} from "./networks";

export const FACTORY_ADDRESSES = {
  [BASE_SEPOLIA_ID]: "0xAF9b63f245eF00044FbC5d50c6aB8DC918BD6827",
  [ARC_TESTNET_ID]: "0x9727b1E6A0a8c97Cf5AC42322160B1140467B60B",
  [ROBINHOOD_TESTNET_ID]: "0x625aF810614687e13b2F5b763c2A4374282078bE",
};

export const PLATFORM_WALLETS = {
  [BASE_SEPOLIA_ID]: "0x736824756b5cea6fc8bc6446f27052cf182feb4a",
  [ARC_TESTNET_ID]: "0x736824756b5cea6fc8bc6446f27052cf182feb4a",
  [ROBINHOOD_TESTNET_ID]: "0x736824756b5cea6fc8bc6446f27052cf182feb4a",
};

const FUNDING_TOKEN_CONFIG = {
  [BASE_SEPOLIA_ID]: {
    symbol: "USDC",
    decimals: 6,
    address: "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f",
  },
  [ARC_TESTNET_ID]: {
    symbol: "USDC",
    decimals: 6,
    address: "0x3600000000000000000000000000000000000000",
  },
  [ROBINHOOD_TESTNET_ID]: {
    symbol: "USDG",
    decimals: 6,
    address: "0x7E955252E15c84f5768B83c41a71F9eba181802F",
  },
};

const usdcAddressCache = new Map();

export const FACTORY_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "goal", type: "uint256" },
          { internalType: "uint256", name: "durationInDays", type: "uint256" },
          { internalType: "string", name: "metadataURI", type: "string" },
          { internalType: "bytes32", name: "metadataHash", type: "bytes32" },
        ],
        internalType: "struct CampaignFactory.CampaignInput",
        name: "input",
        type: "tuple",
      },
    ],
    name: "createCampaign",
    outputs: [{ internalType: "address", name: "campaignAddr", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "campaign", type: "address" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "uint256", name: "goal", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "deadline", type: "uint256" },
      { indexed: false, internalType: "string", name: "metadataURI", type: "string" },
      { indexed: false, internalType: "bytes32", name: "metadataHash", type: "bytes32" },
      { indexed: false, internalType: "bytes32", name: "metadataURIHash", type: "bytes32" },
    ],
    name: "CampaignCreated",
    type: "event",
  },
  {
    inputs: [],
    name: "campaignCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "campaignAt",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "start", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getCampaignsPaginated",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isCampaign",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usdc",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

export const CAMPAIGN_ABI = [
  {
    inputs: [],
    name: "MIN_CONTRIBUTION",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "creator",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usdc",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "goal",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "deadline",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "metadataURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "metadataHash",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "metadataURIHash",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRaised",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRefunded",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalClaimed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "storedState",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "syncState",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "contribute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getState",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "claimableAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "contributor", type: "address" }],
    name: "refundableAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "contributions",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

export const DEFAULT_FACTORY_ADDRESS = FACTORY_ADDRESSES[DEFAULT_CHAIN_ID];
export const DEFAULT_PLATFORM_WALLET = PLATFORM_WALLETS[DEFAULT_CHAIN_ID];
export const DEFAULT_USDC_ADDRESS = FUNDING_TOKEN_CONFIG[DEFAULT_CHAIN_ID]?.address || "";

export function getFundingTokenConfig(chainId) {
  return (
    FUNDING_TOKEN_CONFIG[Number(chainId || DEFAULT_CHAIN_ID)] ||
    FUNDING_TOKEN_CONFIG[DEFAULT_CHAIN_ID]
  );
}

export function getFundingTokenSymbol(chainId) {
  return getFundingTokenConfig(chainId)?.symbol || "USDC";
}

export function getFundingTokenDecimals(chainId) {
  return Number(getFundingTokenConfig(chainId)?.decimals || 6);
}

export function getFundingTokenAddress(chainId) {
  return String(getFundingTokenConfig(chainId)?.address || "").trim();
}

export function getFactoryAddress(chainId) {
  return FACTORY_ADDRESSES[chainId] || "";
}

export function getPlatformWallet(chainId) {
  return PLATFORM_WALLETS[chainId] || DEFAULT_PLATFORM_WALLET;
}

export async function getUsdcAddress(publicClient, chainId, campaignAddress = "") {
  const normalizedChainId = Number(chainId || 0);

  if (usdcAddressCache.has(normalizedChainId)) {
    return usdcAddressCache.get(normalizedChainId);
  }

  const fallbackAddress = getFundingTokenAddress(normalizedChainId);
  const factoryAddress = getFactoryAddress(normalizedChainId);

  if (!publicClient) {
    return fallbackAddress;
  }

  const normalizedCampaignAddress = String(campaignAddress || "").trim();

  if (normalizedCampaignAddress) {
    try {
      const campaignUsdcAddress = await publicClient.readContract({
        address: normalizedCampaignAddress,
        abi: CAMPAIGN_ABI,
        functionName: "usdc",
      });

      const resolvedAddress = String(campaignUsdcAddress || "").trim();

      if (resolvedAddress) {
        usdcAddressCache.set(normalizedChainId, resolvedAddress);
        return resolvedAddress;
      }
    } catch {
      // Continue to factory fallback.
    }
  }

  if (!factoryAddress) {
    return fallbackAddress;
  }

  try {
    const usdcAddress = await publicClient.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "usdc",
    });

    const resolvedAddress = String(usdcAddress || "").trim();

    if (resolvedAddress) {
      usdcAddressCache.set(normalizedChainId, resolvedAddress);
      return resolvedAddress;
    }
  } catch {
    // Fall back to any known static mapping.
  }

  return fallbackAddress;
}
