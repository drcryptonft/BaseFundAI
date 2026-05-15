import { Link, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { FaTelegram, FaDiscord } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import logo from "../assets/logo.png";
import Footer from "../components/Footer";
import WalletMenu from "../components/WalletMenu";
import NetworkSwitcher from "../components/NetworkSwitcher";
import NetworkBanner from "../components/NetworkBanner";

const THEME_STORAGE_KEY = "basefundai-theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return true;
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light") {
    return false;
  }

  if (savedTheme === "dark") {
    return true;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function ThemeToggle() {
  const [dark, setDark] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleThemeChange = (event) => {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (!savedTheme) {
        setDark(event.matches);
      }
    };

    mediaQuery.addEventListener("change", handleThemeChange);

    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg border border-slate-300 bg-white/80 p-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-black dark:bg-slate-950 dark:text-white overflow-x-hidden">

      {/* HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 md:px-8">


        {/* LEFT */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <img src={logo} className="h-5 w-5 object-contain" />
          </div>

          <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            BaseFundAI
          </h1>
        </div>

        {/* NAV */}
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Link to="/" className="transition hover:text-slate-950 dark:hover:text-white">Home</Link>
          <Link to="/explore" className="transition hover:text-slate-950 dark:hover:text-white">Explore</Link>
          <Link to="/create" className="transition hover:text-slate-950 dark:hover:text-white">Fundraise</Link>
          <Link to="/faq" className="transition hover:text-slate-950 dark:hover:text-white">FAQ</Link>
          <Link to="/whitepaper" className="transition hover:text-slate-950 dark:hover:text-white">Whitepaper</Link>
          <Link to="/why" className="transition hover:text-slate-950 dark:hover:text-white">Why We Are Here</Link>
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-4">

          <div className="hidden items-center gap-3 text-slate-500 dark:text-slate-400 md:flex">
            <a
              href="https://x.com/basefundAI"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="BaseFundAI on X"
              className="hover:text-slate-950 dark:hover:text-white"
            >
              <FaXTwitter />
            </a>
            <a href="#" className="hover:text-slate-950 dark:hover:text-white"><FaTelegram /></a>
            <a href="#" className="hover:text-slate-950 dark:hover:text-white"><FaDiscord /></a>
          </div>

          <NetworkSwitcher />

          <ThemeToggle />
          

          <WalletMenu />
        </div>
      </header>
      <NetworkBanner />

      {/* MAIN CONTENT */}
      <main className="w-full max-w-6xl mx-auto px-6 py-10 flex-grow">
        <Outlet />
      </main>

      {/* FOOTER */}
      <Footer />

    </div>
  );
}
