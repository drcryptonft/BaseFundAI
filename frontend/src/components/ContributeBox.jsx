import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { campaignABI, USDC_ADDRESS, PLATFORM_WALLET } from "../contracts";

export default function ContributeBox({ address }) {

  const { address: user } = useAccount();

  const [amount, setAmount] = useState("");
  const [support, setSupport] = useState(true);
  const [supportAmount, setSupportAmount] = useState(1);

  const { writeContractAsync } = useWriteContract();

  async function contribute() {

    if (!amount) return alert("Enter contribution");

    try {

      const value = parseUnits(amount, 6);

      const tx = await writeContractAsync({
        address,
        abi: campaignABI,
        functionName: "contribute",
        args: [value],
      });

      console.log("Contribution tx:", tx);

      if (support) {

        const donation = parseUnits(String(supportAmount), 6);

        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: [
            {
              name: "transfer",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "to", type: "address" },
                { name: "value", type: "uint256" }
              ],
              outputs: [{ type: "bool" }]
            }
          ],
          functionName: "transfer",
          args: [PLATFORM_WALLET, donation],
        });

      }

      alert("Contribution successful. Thank you for supporting!");

      setAmount("");

    } catch (err) {

      console.error(err);
      alert("Transaction failed or rejected.");

    }

  }

  return (
    <div className="mt-4 border rounded-lg p-4">

      <input
        className="border p-2 rounded w-full"
        placeholder="Amount (USDC)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div className="flex items-center mt-3 gap-2">

        <input
          type="checkbox"
          checked={support}
          onChange={() => setSupport(!support)}
        />

        <span>Support BaseFundAI</span>

        {support && (
          <input
            type="number"
            value={supportAmount}
            onChange={(e) => setSupportAmount(e.target.value)}
            className="border p-1 w-20 rounded"
          />
        )}

      </div>

      <button
        onClick={contribute}
        className="bg-blue-600 text-white px-4 py-2 rounded mt-3 w-full"
      >
        Contribute
      </button>

    </div>
  );
}