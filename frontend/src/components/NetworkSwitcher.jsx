import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAccount, useBalance, useChainId, useSwitchChain } from "wagmi";
import {
  CHAIN_UI,
  getAddEthereumChainParams,
} from "../config/networks";

export default function NetworkSwitcher({ compact = false }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const current = CHAIN_UI[chainId];
  const { data } = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(address && chainId),
    },
  });

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const formattedBalance = data
    ? Number(data.formatted).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: data.symbol === "USDC" ? 2 : 4,
      })
    : "";
  const availableNetworks = Object.values(CHAIN_UI).filter(
    (chain) => chain.id !== chainId
  );

  async function switchNetwork(chain) {
    if (chainId === chain.id) {
      setOpen(false);
      return;
    }

    try {
      await switchChainAsync({ chainId: chain.id });
      setOpen(false);
    } catch (error) {
      const addParams = getAddEthereumChainParams(chain.id);

      if (!window.ethereum || !addParams) {
        console.error("Network switch failed:", error);
        return;
      }

      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [addParams],
        });
        await switchChainAsync({ chainId: chain.id });
        setOpen(false);
      } catch (addError) {
        console.error("Network add failed:", addError);
      }
    }
  }

  return (
    <div ref={menuRef} className={compact ? "relative w-full" : "relative"}>
      <button
        onClick={() => setOpen((currentState) => !currentState)}
        type="button"
        aria-label={current ? `Switch network from ${current.name}` : "Switch network"}
        className={`flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-sm transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950/80 ${
          compact ? "min-h-[48px] w-full min-w-0" : "min-h-[52px] min-w-[220px]"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
        >
          {current && (
            <img
              src={current.logo}
              alt={current.name}
              className={`${compact ? "h-4 w-4" : "h-5 w-5"} rounded-full`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          {!compact && (
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Network
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {compact ? current?.short || current?.name || "Network" : current?.name || "Network"}
            </span>
            {formattedBalance && !compact && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                {formattedBalance} {data.symbol || current?.nativeCurrency?.symbol}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 ${
            compact ? "w-full min-w-[240px]" : "w-[280px]"
          }`}
        >
          {availableNetworks.map((chain) => (
            <button
              key={chain.id}
              onClick={() => switchNetwork(chain)}
              disabled={isSwitching}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
            >
              <img src={chain.logo} alt={chain.name} className="h-4 w-4 rounded-full" />
              <span className="truncate font-medium text-slate-900 dark:text-white">
                {chain.name}
              </span>
            </button>
          ))}

          {availableNetworks.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No other supported networks available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
