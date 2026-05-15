import { useAccount, useBalance, useChainId } from "wagmi";
import { getChainUi } from "../config/networks";

export default function ChainStatus() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data } = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(address && chainId),
    },
  });
  const chain = getChainUi(chainId);

  if (!chain || !address) return null;

  const formattedBalance = data
    ? Number(data.formatted).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: data.symbol === "USDC" ? 2 : 4,
      })
    : null;

  return (
    <div className="hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-950/80 lg:flex">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <img src={chain.logo} alt={chain.name} className="h-4 w-4 rounded-full" />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Network
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span className="truncate">{chain.name}</span>
          {formattedBalance && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
              {formattedBalance} {data.symbol || chain.nativeCurrency.symbol}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
