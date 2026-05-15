import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import App from "./App.jsx";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";
import { AppProvider } from "./providers/AppProvider.jsx";
import { installGlobalAppMonitoring } from "./utils/appMonitoring";
import { wagmiConfig } from "./wagmi";

const queryClient = new QueryClient();

installGlobalAppMonitoring();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <Toaster
              position="top-right"
              reverseOrder={false}
              toastOptions={{
                duration: 4000,
                style: {
                  background: "rgba(15, 23, 42, 0.96)",
                  color: "#e2e8f0",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  borderRadius: "18px",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
                },
              }}
            />

            <BrowserRouter>
              <AppProvider>
                <App />
              </AppProvider>
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HelmetProvider>
  </React.StrictMode>
);
