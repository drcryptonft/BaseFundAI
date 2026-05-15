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
    watch: false,
  });

  const raisedQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "totalRaised",
    watch: false,
  });

  const deadlineQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "deadline",
    watch: false,
  });

  const creatorQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "creator",
    watch: false,
  });

  const stateQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "getState",
    watch: false,
  });

  const contributionQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "contributions",
    args: user ? [user] : undefined,
    watch: false,
  });

  const claimableAmountQuery = useReadContract({
    address,
    abi: CAMPAIGN_ABI,
    functionName: "claimableAmount",
    watch: false,
  });

  const refetchAll = async () => {
    await goalQuery.refetch();
    await raisedQuery.refetch();
    await deadlineQuery.refetch();
    await creatorQuery.refetch();
    await stateQuery.refetch();
    await claimableAmountQuery.refetch();
    if (user) await contributionQuery.refetch();
  };

  const syncState = async () => {
    const hash = await writeContractAsync({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "syncState",
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

  const refund = async () => {
    const hash = await writeContractAsync({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "refund",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refetchAll();
  };

  const stateCode = Number(stateQuery.data ?? 0);
  const finalized = stateCode === 1 || stateCode === 2 || stateCode === 3;
  const successful = stateCode === 1 || stateCode === 3;

  return {
    goal: goalQuery.data,
    raised: raisedQuery.data,
    deadline: deadlineQuery.data,
    creator: creatorQuery.data,
    stateCode,
    finalized,
    successful,
    contribution: contributionQuery.data,
    claimableAmount: claimableAmountQuery.data,
    syncState,
    claimFunds,
    refund,
    refetchAll,
  };
}
