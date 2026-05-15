import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import DashboardLayout from "./layout/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Home = lazy(() => import("./pages/Home"));
const Explore = lazy(() => import("./pages/Explore"));
const About = lazy(() => import("./pages/About"));
const Help = lazy(() => import("./pages/Help"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Whitepaper = lazy(() => import("./pages/Whitepaper"));
const CreateCampaign = lazy(() => import("./components/CreateCampaign"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Why = lazy(() => import("./pages/Why"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="theme-card-soft rounded-3xl px-6 py-5 text-center">
        <p className="theme-heading text-lg font-semibold">Loading BaseFundAI</p>
        <p className="theme-muted mt-2 text-sm">
          Preparing the next view and syncing the latest campaign data.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/dashboard/monitoring" element={<DashboardLayout />}>
          <Route index element={<MonitoringDashboard />} />
        </Route>

        {/* PUBLIC */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/campaign/:address" element={<CampaignDetail />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/about" element={<About />} />
          <Route path="/help" element={<Help />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/whitepaper" element={<Whitepaper />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/why" element={<Why />} />
        </Route>

        {/* PROTECTED DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
