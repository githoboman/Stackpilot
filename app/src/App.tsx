import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { Signin, Maintenance, Agent, Activities } from "@/pages/";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { SileoToaster } from "@/components/SileoToaster";
import CockpitLayout from "@/pages/agent/CockpitLayout";
import AgentChat from "@/pages/agent/AgentChat";
import AgentHistory from "@/pages/agent/History";
import AgentSettings from "@/pages/agent/Settings";
import { AgentWalletProvider } from "@/hooks/useAgentWallet";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Brief branded flash, then always reveal the app. A single timer that can't
    // be stranded by StrictMode/HMR double-invokes.
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`app-container ${showSplash ? "splash-visible" : ""}`}>
      {showSplash && <SplashScreen />}
      <Routes>
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/signin" element={<Signin />} />
        {/* The Stackpilot agent app is the home. */}
        <Route path="/" element={<Navigate to="/agent" replace />} />

        {/* Agent area — cockpit shell, with ONE shared agent-wallet state. */}
        <Route
          element={
            <AgentWalletProvider>
              <CockpitLayout />
            </AgentWalletProvider>
          }
        >
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/agent/policy" element={<Agent />} />
          <Route path="/agent/activity" element={<Activities />} />
          <Route path="/agent/history" element={<AgentHistory />} />
          <Route path="/agent/settings" element={<AgentSettings />} />
        </Route>

        {/* Anything else → the agent app, instead of a blank screen. */}
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Routes>

      <SileoToaster />
    </div>
  );
}

export default App;
