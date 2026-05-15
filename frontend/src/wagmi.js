import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createPublicClient, http } from "viem";
import { DEFAULT_CHAIN_ID, supportedChains } from "./config/networks";

const chainById = new Map(supportedChains.map((chain) => [chain.id, chain]));
const defaultChain = chainById.get(DEFAULT_CHAIN_ID) || supportedChains[0];

function getPrimaryRpcUrl(chain) {
  return chain?.rpcUrls?.default?.http?.[0] || chain?.rpcUrls?.public?.http?.[0];
}

export const transports = Object.fromEntries(
  supportedChains
    .map((chain) => [chain.id, getPrimaryRpcUrl(chain)])
    .filter(([, rpcUrl]) => Boolean(rpcUrl))
    .map(([chainId, rpcUrl]) => [chainId, http(rpcUrl)])
);

// Keep the initial chain fixed so wallet state and read clients start aligned.
export const wagmiConfig = getDefaultConfig({
  appName: "BaseFundAI",
  projectId: "db51bcefbc41d7cbc82087c8f3382d2c",
  chains: supportedChains,
  transports,
  initialChain: defaultChain,
});

// Create dynamic public clients on demand so reads follow the active chain.
export function getPublicClient(chainId) {
  const chain = chainById.get(chainId) || defaultChain;

  return createPublicClient({
    chain,
    transport: http(getPrimaryRpcUrl(chain)),
  });
}
