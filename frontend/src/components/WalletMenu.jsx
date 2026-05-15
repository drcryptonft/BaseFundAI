import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDisconnect } from "wagmi";
import { isSupportedChain } from "../config/networks";

function shortenAddress(address = "") {
  if (!address) return "Wallet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletMenu() {
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

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

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Connect Wallet
            </button>
          );
        }

        if (!isSupportedChain(chain.id)) {
          return (
            <button
              onClick={openChainModal}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Switch Network
            </button>
          );
        }

        return (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setOpen((current) => !current)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white"
            >
              <span>{account.displayName || shortenAddress(account.address)}</span>
              <ChevronDown
                size={16}
                className={`transition ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate("/dashboard#contributions");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  My Contributions
                </button>

                <button
                  onClick={() => {
                    setOpen(false);
                    disconnect();
                  }}
                  className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm text-rose-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-slate-900"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
