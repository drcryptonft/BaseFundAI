import { createPublicClient, defineChain, http } from "viem";
import { baseSepolia } from "viem/chains";
import { computeMetadataHash, extractIpfsHash } from "../../src/utils/metadataIntegrity.js";
import { sanitizeCampaignMetadataForTransport } from "../../src/utils/campaignMetadata.js";
import { normalizeAddress } from "../utils/hash.js";

const BASE_SEPOLIA_ID = 84532;
const ARC_TESTNET_ID = 5042002;
const ROBINHOOD_TESTNET_ID = 46630;

const FACTORY_ADDRESSES = {
  [BASE_SEPOLIA_ID]: "0xAF9b63f245eF00044FbC5d50c6aB8DC918BD6827",
  [ARC_TESTNET_ID]: "0x9727b1E6A0a8c97Cf5AC42322160B1140467B60B",
  [ROBINHOOD_TESTNET_ID]: "0x625aF810614687e13b2F5b763c2A4374282078bE",
};

const FUNDING_TOKEN_DECIMALS = {
  [BASE_SEPOLIA_ID]: 6,
  [ARC_TESTNET_ID]: 6,
  [ROBINHOOD_TESTNET_ID]: 6,
};

const FACTORY_ABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isCampaign",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

const CAMPAIGN_ABI = [
  {
    inputs: [],
    name: "creator",
    outputs: [{ internalType: "address", name: "", type: "address" }],
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
    name: "metadataURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
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
];

const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        String(
          process.env.ARC_RPC_URL ||
            process.env.VITE_ARC_RPC_URL ||
            "https://rpc.testnet.arc.network"
        ).trim(),
      ],
    },
  },
});

const robinhoodTestnet = defineChain({
  id: ROBINHOOD_TESTNET_ID,
  name: "Robinhood Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        String(
          process.env.ROBINHOOD_RPC_URL ||
            process.env.VITE_ROBINHOOD_RPC_URL ||
            "https://rpc.testnet.chain.robinhood.com"
        ).trim(),
      ],
    },
  },
});

const supportedChains = {
  [BASE_SEPOLIA_ID]: baseSepolia,
  [ARC_TESTNET_ID]: arcTestnet,
  [ROBINHOOD_TESTNET_ID]: robinhoodTestnet,
};

const publicClientCache = new Map();

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getFundingTokenDecimals(chainId) {
  return Number(FUNDING_TOKEN_DECIMALS[Number(chainId)] || 6);
}

function normalizeTokenAmount(rawAmount, chainId) {
  const amount = Number(rawAmount || 0n);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return amount / 10 ** getFundingTokenDecimals(chainId);
}

function getPublicClient(chainId) {
  const normalizedChainId = Number(chainId);
  const chain = supportedChains[normalizedChainId];
  const rpcUrl =
    chain?.rpcUrls?.default?.http?.[0] || chain?.rpcUrls?.public?.http?.[0];

  if (!chain || !rpcUrl) {
    return null;
  }

  if (!publicClientCache.has(normalizedChainId)) {
    publicClientCache.set(
      normalizedChainId,
      createPublicClient({
        chain,
        transport: http(rpcUrl),
      })
    );
  }

  return publicClientCache.get(normalizedChainId);
}

async function readOnchainCampaignDetails(address, chainId) {
  const factoryAddress = FACTORY_ADDRESSES[Number(chainId)];
  const publicClient = getPublicClient(chainId);

  if (!factoryAddress || !publicClient) {
    throw createHttpError("Unsupported chain for campaign verification", 400);
  }

  const [isCampaign, creator, metadataHash, metadataURI, goal, deadline] =
    await Promise.all([
      publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: "isCampaign",
        args: [address],
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "creator",
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "metadataHash",
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "metadataURI",
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "goal",
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "deadline",
      }),
    ]);

  if (!isCampaign) {
    throw createHttpError("Campaign address is not registered in the factory", 403);
  }

  return {
    creator: normalizeAddress(creator),
    metadataHash: String(metadataHash || "").trim().toLowerCase(),
    metadataURI: String(metadataURI || "").trim(),
    goal,
    deadline,
  };
}

export async function verifyCampaignRecordInput(input = {}) {
  const normalizedChainId = Number(input.chainId || BASE_SEPOLIA_ID);
  const normalizedAddress = normalizeAddress(input.address);
  const providedCreator = normalizeAddress(input.creator);
  const metadata = sanitizeCampaignMetadataForTransport(
    input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  );

  if (!normalizedAddress) {
    throw createHttpError("Campaign address is required", 400);
  }

  if (!supportedChains[normalizedChainId]) {
    throw createHttpError("Unsupported chain for campaign registration", 400);
  }

  const computedMetadataHash = computeMetadataHash(metadata).toLowerCase();
  const onchainCampaign = await readOnchainCampaignDetails(
    normalizedAddress,
    normalizedChainId
  );

  if (providedCreator && providedCreator !== onchainCampaign.creator) {
    throw createHttpError("Campaign creator does not match the onchain record", 403);
  }

  if (!onchainCampaign.metadataHash || onchainCampaign.metadataHash !== computedMetadataHash) {
    throw createHttpError(
      "Campaign metadata does not match the onchain metadata hash",
      403
    );
  }

  const onchainIpfsHash = extractIpfsHash(onchainCampaign.metadataURI);
  const submittedIpfsHash = extractIpfsHash(input.ipfsHash);

  if (submittedIpfsHash && onchainIpfsHash && submittedIpfsHash !== onchainIpfsHash) {
    throw createHttpError(
      "Submitted metadata reference does not match the onchain metadata URI",
      403
    );
  }

  return {
    chainId: normalizedChainId,
    address: normalizedAddress,
    creator: onchainCampaign.creator,
    metadata,
    ipfsHash: onchainIpfsHash || submittedIpfsHash || onchainCampaign.metadataURI,
    goal: normalizeTokenAmount(onchainCampaign.goal, normalizedChainId),
    deadline: Number(onchainCampaign.deadline || 0n),
  };
}
