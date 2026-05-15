import { GraphQLClient } from "graphql-request";
import {
  ARC_TESTNET_ID,
  BASE_SEPOLIA_ID,
  DEFAULT_CHAIN_ID,
  ROBINHOOD_TESTNET_ID,
} from "../config/networks";

const defaultGraphEndpoint =
  String(import.meta.env.VITE_GRAPH_API_URL || "").trim() ||
  "https://api.studio.thegraph.com/query/1744275/basefundai/version/latest";

const graphEndpoints = {
  [BASE_SEPOLIA_ID]:
    String(import.meta.env.VITE_GRAPH_API_URL_BASE_SEPOLIA || "").trim() ||
    defaultGraphEndpoint,
  [ARC_TESTNET_ID]:
    String(import.meta.env.VITE_GRAPH_API_URL_ARC_TESTNET || "").trim() ||
    defaultGraphEndpoint,
  [ROBINHOOD_TESTNET_ID]:
    String(import.meta.env.VITE_GRAPH_API_URL_ROBINHOOD_TESTNET || "").trim(),
};

const graphClientCache = new Map();

export function getGraphEndpoint(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = Number(chainId || DEFAULT_CHAIN_ID);
  const endpoint = String(graphEndpoints[normalizedChainId] || "").trim();

  if (endpoint) {
    return endpoint;
  }

  return normalizedChainId === DEFAULT_CHAIN_ID ? defaultGraphEndpoint : "";
}

export function getGraphClient(chainId = DEFAULT_CHAIN_ID) {
  const endpoint = getGraphEndpoint(chainId);

  if (!endpoint) {
    return null;
  }

  if (!graphClientCache.has(endpoint)) {
    graphClientCache.set(endpoint, new GraphQLClient(endpoint));
  }

  return graphClientCache.get(endpoint);
}

export const graphClient = getGraphClient(DEFAULT_CHAIN_ID);
