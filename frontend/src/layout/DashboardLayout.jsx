import { Outlet, Link, NavLink } from "react-router-dom";
import Footer from "../components/Footer";
import WalletMenu from "../components/WalletMenu";

function navLinkClassName({ isActive }) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? "bg-emerald-500 text-white"
      : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
  }`;
}

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col text-slate-950 dark:text-white">
      {/* DASHBOARD HEADER */}
      <header className="flex flex-col gap-4 border-b border-slate-200/80 bg-white/70 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white">Dashboard</h1>

          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-950/80">
            <NavLink end to="/dashboard" className={navLinkClassName}>
              Overview
            </NavLink>
            <NavLink to="/dashboard/monitoring" className={navLinkClassName}>
              Monitoring
            </NavLink>
          </div>

          <Link
            to="/"
            className="text-sm text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <WalletMenu />
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="w-full max-w-6xl mx-auto px-6 py-10 flex-grow">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
