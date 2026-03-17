import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { createConfig } from "wagmi"

export const wagmiConfig = createConfig({
chains: [baseSepolia],
transports: {
[baseSepolia.id]: http("https://base-sepolia.g.alchemy.com/v2/cc38onMXi1dcfAzvjsQuf")
}
})

export const publicClient = createPublicClient({
chain: baseSepolia,
transport: http("https://base-sepolia.g.alchemy.com/v2/cc38onMXi1dcfAzvjsQuf")
})