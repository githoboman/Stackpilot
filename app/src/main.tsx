import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App.tsx";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { initTheme } from "@/hooks/useTheme";
import "./global.css";

// Apply persisted theme (default dark) before first paint to avoid a flash.
initTheme();

import "highlight.js/styles/github-dark.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StacksWalletProvider } from "@/lib/stacksWallet";

const queryClient = new QueryClient();

// Capture referral code before any routing redirects happen
const searchParams = new URLSearchParams(window.location.search);
const refCode = searchParams.get("ref");
if (refCode) {
  localStorage.setItem("stackpilot_referral", refCode);
  searchParams.delete("ref");
  const newUrl = window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  window.history.replaceState({}, document.title, newUrl);
  console.log("[REFERRAL] Captured at app boot:", refCode);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <StacksWalletProvider>
        <Provider store={store}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </Provider>
      </StacksWalletProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
