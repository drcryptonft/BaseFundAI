import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "../config/contracts";
import { parseUnits } from "viem";

export function useFactory() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: campaigns, refetch } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getCampaigns",
  });

  const createCampaign = async (goal, duration) => {
    const hash = await writeContractAsync({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createCampaign",
      args: [parseUnits(goal, 6), Number(duration)],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    await refetch();
  };

  return { campaigns, createCampaign };
}