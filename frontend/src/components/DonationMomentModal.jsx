import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Copy, ExternalLink, ReceiptText, Share2, ShieldCheck, X } from "lucide-react";
import { FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import toast from "react-hot-toast";
import {
  buildDonationMomentShareUrl,
  trackDonationMomentEvent,
} from "../utils/donationMoment";

export default function DonationMomentModal({ isOpen, moment, onClose }) {
  const reduceMotion = useReducedMotion();
  const hasTrackedViewRef = useRef("");

  const shareUrl = useMemo(() => buildDonationMomentShareUrl(moment), [moment]);
  const txHashShort = useMemo(() => {
    const txHash = String(moment?.txHash || "").trim();

    if (txHash.length < 14) {
      return txHash;
    }

    return `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
  }, [moment]);
  const confirmationLabel = useMemo(() => {
    const chainLabel = String(moment?.chainLabel || "BaseFundAI").trim();
    return `Confirmed on ${chainLabel}`;
  }, [moment]);
  const nativeShareText = useMemo(() => {
    const message = String(moment?.shareText || moment?.message || "").trim();
    const headline = String(moment?.campaignHeadline || "").trim();
    return [headline, message].filter(Boolean).join("\n\n");
  }, [moment]);
  const shareLinks = useMemo(
    () => [
      {
        key: "x",
        label: "X",
        icon: FaXTwitter,
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          nativeShareText
        )}&url=${encodeURIComponent(shareUrl)}`,
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: FaWhatsapp,
        href: `https://api.whatsapp.com/send?text=${encodeURIComponent(
          `${nativeShareText}\n${shareUrl}`
        )}`,
      },
      {
        key: "telegram",
        label: "Telegram",
        icon: FaTelegram,
        href: `https://t.me/share/url?url=${encodeURIComponent(
          shareUrl
        )}&text=${encodeURIComponent(nativeShareText)}`,
      },
    ],
    [nativeShareText, shareUrl]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !moment?.txHash) {
      return;
    }

    if (hasTrackedViewRef.current === moment.txHash) {
      return;
    }

    hasTrackedViewRef.current = moment.txHash;
    void trackDonationMomentEvent({
      chainId: moment.chainId,
      txHash: moment.txHash,
      eventType: "viewed",
      metadata: {
        experienceVersion: moment.experienceVersion,
        rarity: moment.rarity,
        momentType: moment.momentType,
        source: moment.source,
      },
    });
  }, [isOpen, moment]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined" || !moment) {
    return null;
  }

  async function handleNativeShare() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: moment.title,
          text: nativeShareText,
          url: shareUrl,
        });

        void trackDonationMomentEvent({
          chainId: moment.chainId,
          txHash: moment.txHash,
          eventType: "share_native",
          metadata: {
            experienceVersion: moment.experienceVersion,
          },
        });
        return;
      }

      await handleCopyLink();
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Could not open the share sheet");
      }
    }
  }

  async function handleCopyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Copy is unavailable on this device");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Support link copied");
      void trackDonationMomentEvent({
        chainId: moment.chainId,
        txHash: moment.txHash,
        eventType: "share_copy",
        metadata: {
          experienceVersion: moment.experienceVersion,
        },
      });
    } catch {
      toast.error("Could not copy the link");
    }
  }

  function handleShareLinkClick(key) {
    void trackDonationMomentEvent({
      chainId: moment.chainId,
      txHash: moment.txHash,
      eventType: `share_${key}`,
      metadata: {
        experienceVersion: moment.experienceVersion,
      },
    });
  }

  function handleClose() {
    void trackDonationMomentEvent({
      chainId: moment.chainId,
      txHash: moment.txHash,
      eventType: "dismissed",
      metadata: {
        experienceVersion: moment.experienceVersion,
      },
    });
    onClose?.();
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/32 backdrop-blur-md dark:bg-slate-950/78"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <div className="flex min-h-[100dvh] items-center justify-center p-3 sm:p-4 md:p-6">
            <motion.div
              className="theme-card relative w-full max-w-[1080px] overflow-y-auto rounded-[32px] border border-slate-200/85 bg-white text-slate-950 shadow-[0_30px_110px_rgba(15,23,42,0.18)] dark:border-white/12 dark:bg-slate-950 dark:text-white dark:shadow-[0_30px_110px_rgba(2,6,23,0.55)] max-h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-3rem)]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0.2 : 0.42, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_44%,#ecfdf5_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.18),transparent_26%),linear-gradient(180deg,#020617_0%,#061425_100%)]" />
              {moment.campaignImage ? (
                <>
                  <img
                    src={moment.campaignImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.08] blur-3xl dark:opacity-[0.12]"
                  />
                  <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/74" />
                </>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-slate-700 transition hover:border-slate-400 hover:bg-white dark:border-white/12 dark:bg-slate-950/78 dark:text-slate-100 dark:hover:border-white/25 dark:hover:bg-slate-900"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="relative grid gap-0 lg:grid-cols-[minmax(420px,0.96fr)_minmax(0,1.04fr)]">
              <div className="relative overflow-hidden border-b border-slate-200/80 p-6 dark:border-white/12 lg:border-b-0 lg:border-r lg:p-8">
                <div className="mx-auto flex h-full w-full max-w-[430px] items-center">
                  <div className="w-full rounded-[30px] border border-slate-200/80 bg-white/72 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-white/[0.05] dark:shadow-none md:p-5">
                    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/96 shadow-[0_26px_80px_rgba(15,23,42,0.12)] dark:border-white/12 dark:bg-slate-950/72 dark:shadow-[0_26px_80px_rgba(2,6,23,0.36)]">
                      {moment.campaignImage ? (
                        <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-200/80 dark:border-white/12">
                          <img
                            src={moment.campaignImage}
                            alt={moment.campaignHeadline}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/15 to-transparent dark:from-slate-950/70 dark:via-slate-950/10 dark:to-transparent" />
                          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-emerald-700 backdrop-blur dark:border-white/15 dark:bg-slate-950/70 dark:text-emerald-100">
                            <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-200" />
                            {confirmationLabel}
                          </div>
                        </div>
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_58%,#e0f2fe_100%)] px-8 text-center text-sm font-semibold uppercase tracking-[0.26em] text-slate-500 dark:border-white/12 dark:bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.18),transparent_26%),linear-gradient(180deg,#020617_0%,#061425_100%)] dark:text-white/78">
                          BaseFundAI
                        </div>
                      )}

                      <div className="space-y-5 p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-white/72">
                              Support Receipt
                            </div>
                            <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                              {moment.amountDisplay}
                            </div>
                          </div>
                          <div className="rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-700 dark:border-emerald-200/20 dark:bg-emerald-300/12 dark:text-emerald-100">
                            {moment.rarityLabel}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                            Campaign
                          </div>
                          <div className="mt-2 text-lg font-semibold leading-7 text-slate-950 dark:text-white">
                            {moment.campaignHeadline}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3.5 dark:border-white/12 dark:bg-white/[0.04]">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                              Raised now
                            </div>
                            <div className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                              {moment.totalRaisedDisplay}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3.5 dark:border-white/12 dark:bg-white/[0.04]">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                              Goal
                            </div>
                            <div className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                              {moment.goalDisplay}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/72">
                            <span>Funding progress</span>
                            <span>{moment.progressPercentage}% confirmed</span>
                          </div>
                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300"
                              initial={{ width: 0 }}
                              animate={{ width: `${moment.progressPercentage}%` }}
                              transition={{ duration: reduceMotion ? 0.2 : 0.9, delay: 0.18 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex min-w-0 flex-col justify-center p-6 pb-8 lg:p-8 lg:pb-9">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/60 bg-white/88 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-emerald-700 shadow-sm dark:border-white/12 dark:bg-white/[0.06] dark:text-emerald-100 dark:shadow-none">
                  <ReceiptText size={14} />
                  Verified support moment
                </div>

                <h2 className="mt-5 max-w-[12ch] pr-12 text-3xl font-black leading-[1.02] text-slate-950 md:pr-14 dark:text-white md:text-[2.9rem]">
                  {moment.title}
                </h2>

                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-200 md:text-lg">
                  {moment.message}
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-emerald-300/60 bg-emerald-50 p-4 md:p-5 dark:border-emerald-300/15 dark:bg-emerald-300/[0.08]">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-emerald-700/80 dark:text-emerald-100/80">
                      <ShieldCheck size={13} />
                      Receipt status
                    </div>
                    <div className="mt-3 text-base font-semibold text-emerald-900 dark:text-white">
                      {confirmationLabel}
                    </div>
                    <div className="mt-2 text-xs text-emerald-700/75 dark:text-emerald-50/75">
                      {txHashShort}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/78 p-4 shadow-sm dark:border-white/12 dark:bg-white/[0.05] dark:shadow-none md:p-5">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                      Moment type
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                      {moment.rarityAccent}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                      Built from confirmed contribution data
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/78 p-4 shadow-sm dark:border-white/12 dark:bg-white/[0.05] dark:shadow-none md:p-5">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                      Share destination
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                      Live campaign page
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                      Opens a crawler-readable support page
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white/78 p-4 shadow-sm dark:border-white/12 dark:bg-white/[0.05] dark:shadow-none md:p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                    Campaign snapshot
                  </p>
                  <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                    {moment.campaignHeadline}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                        Your support
                      </div>
                      <div className="mt-2 text-base font-semibold text-emerald-700 dark:text-emerald-200">
                        {moment.amountDisplay}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                        Raised now
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                        {moment.totalRaisedDisplay}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                        Goal
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                        {moment.goalDisplay}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_rgba(52,211,153,0.22)] transition hover:brightness-[1.03]"
                    >
                      <Share2 size={16} />
                      Share verified support
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-emerald-300 hover:bg-white dark:border-white/12 dark:bg-white/[0.05] dark:text-white dark:hover:border-white/25 dark:hover:bg-white/[0.09]"
                    >
                      <Copy size={16} />
                      Copy verified link
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {shareLinks.map(({ key, label, icon: Icon, href }) => (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleShareLinkClick(key)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-white dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:border-white/25 dark:hover:bg-white/[0.09]"
                      >
                        <Icon size={15} />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <a
                      href={moment.campaignPath}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-emerald-700 dark:text-white dark:hover:text-emerald-200"
                    >
                      View campaign impact
                      <ExternalLink size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-slate-950 dark:text-emerald-200 dark:hover:text-white"
                    >
                      Stay with the campaign
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
