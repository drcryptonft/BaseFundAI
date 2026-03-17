import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useChainId, 
  useSwitchChain 
} from "wagmi";
import { baseSepolia } from "wagmi/chains";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectNetwork = chainId === baseSepolia.id;

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow hover:bg-blue-700 transition"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        className="bg-yellow-500 text-white px-4 py-2 rounded-xl shadow hover:bg-yellow-600 transition"
      >
        Switch to Base Sepolia
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="bg-red-500 text-white px-4 py-2 rounded-xl shadow hover:bg-red-600 transition"
      >
        Disconnect
      </button>
    </div>
  );
}