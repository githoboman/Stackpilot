import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { ConnectButton, useCurrentAccount } from "@/lib/stacksWallet";
import { useTheme } from "@/hooks/useTheme";
import { useAgentWallet } from "@/hooks/useAgentWallet";
import { WalletDrawer } from "@/components/agent/WalletDrawer";
import { NotificationBell } from "@/components/agent/NotificationBell";
import { HelpModal } from "@/components/agent/HelpModal";

/**
 * Stackpilot Cockpit Shell — Strict Blue/White/Black aesthetic.
 * Blue/white nav, gradient status bar, morphing
 * logo icon, gradient header border, mobile-responsive slide-in drawer.
 */

interface TabItem {
  name: string;
  href: string;
  icon: string;
  activeColor: string; // tailwind text class for active state
  activeBg: string;    // inline style color string
  accentColor: string; // hex for glow
}

const NAV_TABS: TabItem[] = [
  {
    name: "Chat",
    href: "/agent",
    icon: "chat_bubble",
    activeColor: "text-[#3b82f6]",
    activeBg: "rgba(59,130,246,0.14)",
    accentColor: "#3b82f6",
  },
  {
    name: "Policy",
    href: "/agent/policy",
    icon: "shield_lock",
    activeColor: "text-[#3b82f6]",
    activeBg: "rgba(59,130,246,0.14)",
    accentColor: "#3b82f6",
  },
  {
    name: "Activity",
    href: "/agent/activity",
    icon: "bar_chart",
    activeColor: "text-[#3b82f6]",
    activeBg: "rgba(59,130,246,0.14)",
    accentColor: "#3b82f6",
  },
  {
    name: "History",
    href: "/agent/history",
    icon: "history",
    activeColor: "text-[#3b82f6]",
    activeBg: "rgba(59,130,246,0.14)",
    accentColor: "#3b82f6",
  },
  {
    name: "Settings",
    href: "/agent/settings",
    icon: "settings",
    activeColor: "text-on-surface-variant",
    activeBg: "rgba(255,255,255,0.08)",
    accentColor: "#64748b",
  },
];

function formatExpiry(expiryMs: number): string {
  const diff = expiryMs - Date.now();
  if (diff <= 0) return "Expired";
  const s = Math.floor(diff / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function CockpitLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [walletOpen, setWalletOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const account = useCurrentAccount();
  const { status, policy } = useAgentWallet();

  const isTabActive = (href: string) =>
    location.pathname === href ||
    (href !== "/agent" && location.pathname.startsWith(href + "/"));

  const usedPct = policy ? Math.min(100, Math.round(policy.usedPercent)) : 0;
  const active = status?.bound && policy?.isActive;

  const agentState = !account
    ? "Disconnected"
    : !status
    ? "Not initialized"
    : !status.bound
    ? "No policy"
    : policy?.isActive
    ? "Active"
    : "Paused";

  const agentStateDot = active
    ? "#3b82f6"
    : agentState === "Paused"
    ? "#60a5fa"
    : "#64748b";

  const expiryStr = policy
    ? formatExpiry(
        Date.now() +
          (Number(policy.expiryBurnHeight) -
            Number(policy.currentBurnHeight ?? policy.expiryBurnHeight)) *
            10 * 60 * 1000,
      )
    : "--:--:--";

  const isExpiringSoon = expiryStr !== "--:--:--" && !expiryStr.startsWith("00:") ? false : expiryStr.startsWith("00:");

  return (
    <div className="flex h-screen w-screen overflow-hidden text-on-background font-inter" style={{ background: "#000000" }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <nav
        className={`
          w-64 shrink-0 flex flex-col py-5 px-3
          fixed md:relative inset-y-0 left-0 z-40
          transition-transform duration-300 ease-out
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ background: "linear-gradient(180deg, #050505 0%, #000000 100%)", borderRight: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Ambient orb in sidebar */}
        <div className="absolute top-0 left-0 w-40 h-40 pointer-events-none opacity-20" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.5), transparent 70%)", filter: "blur(40px)" }} />

        {/* Brand */}
        <div className="relative px-3 pb-5 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 sp-blob"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)", boxShadow: "0 0 16px rgba(59,130,246,0.4)" }}
            >
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                rocket_launch
              </span>
            </div>
            <div>
              <h1 className="text-[20px] font-bold tracking-tight leading-none">
                Stack<span className="sp-gradient-text-blue">pilot</span>
              </h1>
              <p className="text-[10px] font-semibold tracking-widest text-outline uppercase mt-0.5">
                Trading Cockpit
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <ul className="flex flex-col gap-1 flex-1 relative">
          {NAV_TABS.map((tab) => {
            const on = isTabActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  to={tab.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all relative overflow-hidden group ${
                    on ? tab.activeColor : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  style={
                    on
                      ? {
                          background: tab.activeBg,
                          borderLeft: `2px solid ${tab.accentColor}`,
                          boxShadow: `inset 0 0 20px ${tab.accentColor}08`,
                        }
                      : { borderLeft: "2px solid transparent" }
                  }
                >
                  {/* Hover glow */}
                  {!on && (
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                      style={{ background: `${tab.activeBg}`, borderLeft: `2px solid ${tab.accentColor}40` }}
                    />
                  )}
                  <span
                    className="material-symbols-outlined text-[20px] relative z-10"
                    style={on ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {tab.icon}
                  </span>
                  <span className="relative z-10">{tab.name}</span>
                  {on && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full relative z-10"
                      style={{ background: tab.accentColor, boxShadow: `0 0 6px ${tab.accentColor}` }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Connected-wallet pill */}
        <div className="relative px-1 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {account ? (
            <button
              onClick={() => setWalletOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all group"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
                  <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
                </div>
                <span className="font-mono text-[12px] text-on-surface">
                  {account.address.slice(0, 6)}…{account.address.slice(-4)}
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[18px] group-hover:text-[#60a5fa] transition-colors">
                expand_more
              </span>
            </button>
          ) : (
            <div className="[&_button]:!w-full [&_button]:!rounded-xl [&_button]:!py-2.5 [&_button]:!font-bold [&_button]:!text-[13px]"
              style={{ "--btn-bg": "linear-gradient(135deg, #3b82f6, #60a5fa)" } as React.CSSProperties}
            >
              <ConnectButton connectText="Connect Wallet" />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Main area ────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0" style={{ background: "#000000" }}>

        {/* Top header */}
        <header
          className="flex h-16 items-center justify-between px-4 md:px-6 backdrop-blur-xl shrink-0 sp-header-border"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-on-surface-variant hover:text-on-surface mr-2"
            onClick={() => setMobileNavOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          {/* Agent status cluster */}
          <div className="flex items-center gap-2 md:gap-4 text-[12px] text-on-surface-variant overflow-x-auto">
            {/* Status pill */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
              style={{ background: active ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)"}` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: agentStateDot, boxShadow: active ? `0 0 6px ${agentStateDot}` : "none" }}
              />
              {status && !status.bound ? (
                <button onClick={() => navigate("/agent/policy")} className="text-[#60a5fa] font-semibold hover:underline text-[12px]">
                  Set up →
                </button>
              ) : (
                <span className="font-semibold text-on-surface">{agentState}</span>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-outline-variant/30 shrink-0 hidden sm:block" />

            {/* Budget bar */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-on-surface-variant">Budget</span>
              <div className="relative w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all progress-gradient"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <span className="font-mono font-bold text-on-surface">{usedPct}%</span>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-outline-variant/30 shrink-0 hidden md:block" />

            {/* Expiry */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
              <span className="font-mono font-bold" style={{ color: isExpiringSoon ? "#60a5fa" : "" }}>
                {expiryStr}
              </span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 ml-2">
            <HeaderBtn onClick={() => setHelpOpen(true)} icon="help_outline" title="Help" />
            <HeaderBtn onClick={toggleTheme} icon={isDark ? "light_mode" : "dark_mode"} title="Toggle theme" />
            <NotificationBell />
            <HeaderBtn onClick={() => setWalletOpen(true)} icon="account_balance_wallet" title="Wallet" />
            {account ? (
              <button
                onClick={() => setWalletOpen(true)}
                className="hidden sm:flex h-8 items-center gap-2 px-3 rounded-lg text-[12px] font-mono transition-all ml-1"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.45)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.2)"; }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                {account.address.slice(0, 6)}…{account.address.slice(-4)}
              </button>
            ) : (
              <div className="[&_button]:!rounded-lg [&_button]:!h-8 [&_button]:!px-4 [&_button]:!text-[12px] [&_button]:!font-bold ml-1">
                <ConnectButton connectText="Connect" />
              </div>
            )}
          </div>
        </header>

        {/* Outlet */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {walletOpen && account && <WalletDrawer onClose={() => setWalletOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

/* ── Header icon button ───────────────────────────────────────────── */
function HeaderBtn({ onClick, icon, title }: { onClick: () => void; icon: string; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}
