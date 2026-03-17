import {
  useReadContract,
  useWriteContract,
  usePublicClient,
  useAccount,
} from "wagmi";
import { CAMPAIGN_ABI } from "../config/contracts";

export function useCampaign(address) {
  const { address: user } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const goalQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "goal",
    watch: true,
  });

  const raisedQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "totalRaised",
    watch: true,
  });

  const deadlineQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "deadline",
    watch: true,
  });

  const creatorQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "creator",
    watch: true,
  });

  const finalizedQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "finalized",
    watch: true,
  });

  const successfulQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "successful",
    watch: true,
  });

  const contributionQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "contributions",
    args: user ? [user] : undefined,
    watch: true,
  });

  const refetchAll = async () => {
    await goalQuery.refetch();
    await raisedQuery.refetch();
    await deadlineQuery.refetch();
    await creatorQuery.refetch();
    await finalizedQuery.refetch();
    await successfulQuery.refetch();
    if (user) await contributionQuery.refetch();
  };

  const finalize = async () => {
    const hash = await writeContractAsync({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "finalize",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refetchAll();
  };

  const claimFunds = async () => {
    const hash = await writeContractAsync({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "claimFunds",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refetchAll();
  };

  const claimRefund = async () => {
    const hash = await writeContractAsync({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "claimRefund",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refetchAll();
  };

  return {
    goal: goalQuery.data,
    raised: raisedQuery.data,
    deadline: deadlineQuery.data,
    creator: creatorQuery.data,
    finalized: finalizedQuery.data,
    successful: successfulQuery.data,
    contribution: contributionQuery.data,
    finalize,
    claimFunds,
    claimRefund,
    refetchAll,
  };
}