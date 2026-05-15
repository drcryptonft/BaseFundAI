import { useReadContract, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { FACTORY_ADDRESSES, FACTORY_ABI } from "../config/contracts";
import { parseUnits } from "viem";

export function useFactory() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  // 🔥 Get correct contract based on chain
  const FACTORY_ADDRESS = FACTORY_ADDRESSES[chainId];

  if (!FACTORY_ADDRESS) {
    console.error("❌ Unsupported network:", chainId);
  }

  const { data: campaigns, refetch } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getCampaignsPaginated",
    args: [0n, 200n],
    query: {
      enabled: !!FACTORY_ADDRESS, // prevents crash on wrong network
    },
  });

  const createCampaign = async ({
    goal,
    duration,
    metadataURI,
    metadataHash,
  }) => {
    if (!FACTORY_ADDRESS) {
      throw new Error("Unsupported network");
    }

    const hash = await writeContractAsync({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createCampaign",
      args: [
        {
          goal: parseUnits(goal, 6),
          durationInDays: Number(duration),
          metadataURI,
          metadataHash,
        },
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    await refetch();
  };

  return { campaigns, createCampaign };
}
