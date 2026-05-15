import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useChainId, 
  useSwitchChain 
} from "wagmi";
import {
  getDefaultChainUi,
  isSupportedChain,
} from "../config/networks";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const defaultChain = getDefaultChainUi();

  const isCorrectNetwork = isSupportedChain(chainId);

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
        onClick={() => switchChain({ chainId: defaultChain.id })}
        className="bg-yellow-500 text-white px-4 py-2 rounded-xl shadow hover:bg-yellow-600 transition"
      >
        Switch to {defaultChain.name}
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
