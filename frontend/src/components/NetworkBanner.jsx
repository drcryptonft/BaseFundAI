import { useChainId, useSwitchChain } from "wagmi";
import {
  getChainLabel,
  getDefaultChainUi,
  getSupportedChainNames,
  isSupportedChain,
} from "../config/networks";

export default function NetworkBanner() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const defaultChain = getDefaultChainUi();
  const isWrongNetwork = !isSupportedChain(chainId);
  const supportedNetworkNames = getSupportedChainNames().join(", ");

  if (!chainId || !isWrongNetwork) return null;

  return (
    <div className="sticky top-[72px] z-40 flex w-full flex-col items-center justify-center gap-2 bg-rose-600 px-4 py-3 text-center text-sm font-medium text-white md:flex-row">
      <span>
        Unsupported network detected: {getChainLabel(chainId)}. Switch to one of
        the supported networks: {supportedNetworkNames}.
      </span>
      <button
        onClick={() => switchChain?.({ chainId: defaultChain.id })}
        className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
      >
        Switch to {defaultChain.name}
      </button>
    </div>
  );
}
