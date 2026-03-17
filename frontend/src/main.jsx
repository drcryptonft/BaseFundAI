import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  RainbowKitProvider,
  getDefaultConfig
} from "@rainbow-me/rainbowkit";

import "@rainbow-me/rainbowkit/styles.css";

import { baseSepolia } from "wagmi/chains";

const config = getDefaultConfig({
  appName: "BaseFundAI",
  projectId: "db51bcefbc41d7cbc82087c8f3382d2c",
  chains: [baseSepolia],
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);