import { useState, useEffect } from "react";
import { useConnectWallet, useCurrentAccount } from "@/lib/stacksWallet";
import { sileo } from "sileo";
import { useNavigate } from "react-router-dom";
import { POLICY_FIELDS, AGENT_TASKS } from "@/components/agent/StackpilotGuide";

/**
 * Stackpilot landing + connect — Strict Blue/White/Black aesthetic.
 * Vibrant morphing gradient orbs, shimmer headline, staggered reveals,
 * glassmorphism connect card, simple blue and white palette.
 */

const STATS = [
  { value: "100%", label: "On-chain enforcement", color: "text-[#3b82f6]" },
  { value: "0ms", label: "Human approval needed", color: "text-[#ffffff]" },
  { value: "∞", label: "Strategies possible", color: "text-[#60a5fa]" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: "security",
    title: "Set a policy",
    desc: "Define your budget, token whitelist, and expiry. Sign once — this is the only approval you ever give.",
    accent: "blue",
    iconBg: "sp-icon-blue",
    border: "hover:border-[#3b82f6]/40",
    glow: "hover:sp-glow-blue",
  },
  {
    n: "02",
    icon: "record_voice_over",
    title: "Instruct in plain language",
    desc: '"DCA 5 STX into sBTC every hour." The agent parses your intent and validates against your Clarity policy first.',
    accent: "white",
    iconBg: "sp-icon-white",
    border: "hover:border-[#ffffff]/40",
    glow: "hover:sp-glow-white",
  },
  {
    n: "03",
    icon: "verified",
    title: "It trades — you stay in control",
    desc: "Real Bitflow swaps execute autonomously. Revoke any time and the agent's next action aborts on-chain.",
    accent: "blue",
    iconBg: "sp-icon-blue",
    border: "hover:border-[#3b82f6]/40",
    glow: "",
  },
];

const POLICY_COLORS = ["blue", "white", "blue", "white"];
const POLICY_ICON = ["savings", "token", "hub", "schedule"];
const POLICY_ICON_BG = ["sp-icon-blue", "sp-icon-white", "sp-icon-blue", "sp-icon-white"];

const TASK_COLORS = [
  { icon: "waterfall_chart", bg: "sp-icon-blue", border: "hover:border-[#3b82f6]/40" },
  { icon: "swap_horiz",      bg: "sp-icon-white", border: "hover:border-[#ffffff]/40" },
  { icon: "percent",         bg: "sp-icon-blue", border: "hover:border-[#3b82f6]/40" },
  { icon: "schedule",        bg: "sp-icon-white",  border: "hover:border-[#ffffff]/40" },
  { icon: "gpp_bad",         bg: "sp-icon-error", border: "hover:border-red-500/40" },
];

export default function Signin() {
  const { mutateAsync: connect } = useConnectWallet();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (
      import.meta.env.VITE_MAINTENANCE_MODE === "true" ||
      (import.meta.env.VITE_MAINTENANCE_MODE as unknown) === true
    ) {
      navigate("/maintenance");
      return;
    }
    if (currentAccount) navigate("/");
  }, [currentAccount, navigate]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
      navigate("/");
    } catch (error: any) {
      sileo.error({
        title: "Connection Failed",
        description: error?.message || "Failed to connect wallet",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const scrollToConnect = () =>
    document.getElementById("connect")?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="relative min-h-screen w-full bg-cockpit text-on-background font-inter overflow-x-hidden">

      {/* ── Whisk morphing orbs (always visible, Whisk-style) ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Blue orb 1 */}
        <div
          className="sp-orb-1 absolute -top-24 -left-24 w-[520px] h-[520px] opacity-40"
          style={{ background: "radial-gradient(circle at 40% 40%, #3b82f6 0%, #1e3a8a 40%, transparent 70%)", filter: "blur(60px)" }}
        />
        {/* White/Blue orb 2 */}
        <div
          className="sp-orb-2 absolute -top-16 right-0 w-[480px] h-[480px] opacity-25"
          style={{ background: "radial-gradient(circle at 60% 40%, #ffffff 0%, #3b82f6 40%, transparent 70%)", filter: "blur(70px)" }}
        />
        {/* Blue orb 3 */}
        <div
          className="sp-orb-3 absolute top-[50vh] -left-32 w-[400px] h-[400px] opacity-25"
          style={{ background: "radial-gradient(circle at 50% 50%, #60a5fa 0%, #1e3a8a 50%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* White orb 4 */}
        <div
          className="sp-orb-4 absolute bottom-0 right-0 w-[500px] h-[500px] opacity-15"
          style={{ background: "radial-gradient(circle at 50% 60%, #ffffff 0%, #60a5fa 50%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Mesh overlay */}
        <div className="sp-mesh-bg absolute inset-0 opacity-60" />
      </div>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl sp-header-border h-18 flex items-center px-6 md:px-8" style={{ height: "72px", background: "rgba(0,0,0,0.8)" }}>
        <div className="w-full max-w-[1280px] mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center sp-glow-blue-sm" style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)" }}>
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                rocket_launch
              </span>
            </div>
            <span className="text-[22px] font-bold tracking-tight text-on-surface">
              Stack<span className="sp-gradient-text-blue">pilot</span>
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}>
              <div className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
              <span className="font-mono text-[12px] text-[#60a5fa] font-semibold">Stacks Testnet</span>
            </div>
            <a href="#how" className="text-[14px] text-on-surface-variant hover:text-on-surface transition-colors">How it works</a>
            <a href="#policy" className="text-[14px] text-on-surface-variant hover:text-on-surface transition-colors">Policy</a>
            <button
              onClick={scrollToConnect}
              className="btn-primary btn text-[13px] sp-pulse-ring"
              style={{ padding: "10px 24px" }}
            >
              Launch App
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg text-on-surface-variant hover:text-on-surface" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 glass-panel border-b border-outline-variant/30 p-6 flex flex-col gap-4 md:hidden">
            <a href="#how" className="text-[15px] text-on-surface" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#policy" className="text-[15px] text-on-surface" onClick={() => setMenuOpen(false)}>Policy</a>
            <button onClick={() => { scrollToConnect(); setMenuOpen(false); }} className="btn btn-primary w-full">
              Launch App
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <main className="relative z-10 pt-[72px]">
        <section className="relative min-h-[92vh] flex items-center py-20 px-6 md:px-8">
          <div className="max-w-[1280px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Copy */}
            <div className="lg:col-span-7 flex flex-col gap-7">
              {/* Badge */}
              <div className="sp-fade-up sp-d1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full w-max" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                <span className="material-symbols-outlined text-[#60a5fa] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-[12px] font-bold tracking-widest text-[#60a5fa] uppercase">Agentic Web · Bitcoin L2 · Stacks</span>
              </div>

              {/* Headline */}
              <h1 className="sp-fade-up sp-d2 text-[44px] sm:text-[58px] md:text-[68px] font-bold tracking-[-0.03em] leading-[1.0]">
                The AI agent that<br />
                <span className="sp-shimmer">trades for you.</span>
              </h1>

              {/* Subtitle */}
              <p className="sp-fade-up sp-d3 text-[17px] leading-[1.7] text-on-surface-variant max-w-xl">
                Stackpilot executes Bitflow swaps autonomously — governed by a{" "}
                <span className="text-[#93c5fd] font-semibold">Clarity smart-contract policy</span>{" "}
                you control. Even a compromised key cannot overspend, trade off-whitelist, or act past expiry.
              </p>

              {/* CTAs */}
              <div className="sp-fade-up sp-d4 flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={scrollToConnect}
                  className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-[14px] font-bold text-white sp-pulse-ring transition-all"
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)", boxShadow: "0 8px 32px rgba(59,130,246,0.4)" }}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                  Connect & Delegate
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[14px] font-semibold text-on-surface-variant border border-outline-variant/40 hover:border-[#3b82f6]/50 hover:text-on-surface hover:bg-surface-container/30 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  See how it works
                </a>
              </div>

              {/* Stats bar */}
              <div className="sp-fade-up sp-d5 grid grid-cols-3 gap-4 pt-6 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {STATS.map((s) => (
                  <div key={s.label}>
                    <div className={`text-[28px] font-bold font-mono ${s.color} sp-counter`}>{s.value}</div>
                    <div className="text-[13px] text-on-surface-variant mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connect card */}
            <div id="connect" className="lg:col-span-5 flex items-center justify-center scroll-mt-28 sp-fade-up sp-d3">
              <div className="w-full max-w-md relative">
                {/* Card glow */}
                <div className="absolute inset-0 rounded-3xl opacity-60 blur-2xl" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(255,255,255,0.1))" }} />
                <div
                  className="relative glass-panel rounded-3xl p-8 overflow-hidden"
                  style={{ border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  {/* Blue/White top bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl" style={{ background: "linear-gradient(90deg, #3b82f6, #ffffff, #1e3a8a, #3b82f6)" }} />

                  <div className="text-center mb-8">
                    <div
                      className="w-18 h-18 mx-auto rounded-2xl flex items-center justify-center mb-5 relative sp-blob"
                      style={{ width: "72px", height: "72px", background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(255,255,255,0.1))", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <div className="absolute inset-0 rounded-2xl sp-blob" style={{ background: "linear-gradient(135deg, #3b82f6, #ffffff)", opacity: 0.15, filter: "blur(8px)" }} />
                      <span className="material-symbols-outlined text-[36px] text-on-surface relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                        account_balance_wallet
                      </span>
                    </div>
                    <h2 className="text-[24px] font-bold text-on-surface mb-1.5">Connect to Stackpilot</h2>
                    <p className="text-[14px] text-on-surface-variant">Authorize the autonomous trading agent</p>
                  </div>

                  <div className="space-y-3">
                    <WalletButton
                      label="Leather Wallet"
                      sublabel="Bitcoin-native"
                      disabled={isConnecting}
                      onClick={handleConnect}
                      accentColor="#3b82f6"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-[13px]" style={{ background: "linear-gradient(135deg, #1a1a1a, #000000)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <div className="w-5 h-5 border-2 border-white rounded-sm" />
                      </div>
                    </WalletButton>
                    <WalletButton
                      label="Xverse Wallet"
                      sublabel="Multi-chain"
                      disabled={isConnecting}
                      onClick={handleConnect}
                      accentColor="#ffffff"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[15px]" style={{ background: "linear-gradient(135deg, #ffffff, #d4d4d4)" }}>
                        <span className="text-black font-black text-[18px]">X</span>
                      </div>
                    </WalletButton>
                  </div>

                  <div className="mt-6 flex items-center gap-2 justify-center">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">lock</span>
                    <p className="text-center font-mono text-[12px] text-on-surface-variant">
                      {isConnecting ? (
                        <span className="text-[#93c5fd]">Opening wallet…</span>
                      ) : (
                        "Set wallet to Testnet before connecting"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section id="how" className="relative max-w-[1280px] mx-auto px-6 md:px-8 py-20 scroll-mt-20">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
          <SectionHeader
            eyebrow="How it works"
            title="Three steps, one delegation"
            eyebrowColor="text-[#60a5fa]"
          />
          <div className="grid md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((s, i) => (
              <div
                key={s.n}
                className={`sp-fade-up glass-panel rounded-2xl p-7 border border-outline-variant/20 ${s.border} sp-card-hover transition-all group cursor-default`}
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[48px] font-black text-on-surface/[0.06] leading-none font-mono group-hover:text-on-surface/10 transition-colors">
                    {s.n}
                  </span>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.iconBg}`}>
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {s.icon}
                    </span>
                  </div>
                </div>
                <h3 className="text-[18px] font-bold mb-2 text-on-surface">{s.title}</h3>
                <p className="text-[14px] leading-relaxed text-on-surface-variant">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Policy fields ──────────────────────────────────────── */}
        <section id="policy" className="max-w-[1280px] mx-auto px-6 md:px-8 py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="relative">
            <div className="absolute -top-32 right-0 w-80 h-80 opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)", filter: "blur(60px)" }} />
          </div>
          <SectionHeader
            eyebrow="The policy"
            title="Rules enforced by Clarity — not trust"
            subtitle="You set these once at delegation. Every agent action is validated on-chain; anything outside the rules is aborted by the contract itself."
            eyebrowColor="text-[#ffffff]"
          />
          <div className="grid md:grid-cols-2 gap-4">
            {POLICY_FIELDS.map((f, i) => (
              <div
                key={f.name}
                className="sp-fade-up glass-panel border border-outline-variant/20 rounded-2xl p-6 sp-card-hover group transition-all"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${POLICY_ICON_BG[i]}`}>
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {POLICY_ICON[i]}
                      </span>
                    </div>
                    <h3 className="text-[17px] font-bold text-on-surface">{f.name}</h3>
                  </div>
                  <span
                    className="text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0"
                    style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    {f.example}
                  </span>
                </div>
                <div className="text-[14px] font-semibold text-on-surface mb-1.5">{f.what}</div>
                <p className="text-[13px] leading-relaxed text-on-surface-variant">{f.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Capabilities ───────────────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-6 md:px-8 py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <SectionHeader
            eyebrow="Capabilities"
            title="What you can ask the agent to do"
            subtitle="Every request is parsed from natural language, validated against your policy on-chain, then executed — or aborted."
            eyebrowColor="text-[#60a5fa]"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENT_TASKS.map((t, i) => {
              const tc = TASK_COLORS[i] ?? TASK_COLORS[0];
              return (
                <div
                  key={t.name}
                  className={`sp-fade-up glass-panel border border-outline-variant/20 rounded-2xl p-6 ${tc.border} sp-card-hover group transition-all`}
                  style={{ animationDelay: `${0.08 * i}s` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.bg}`}>
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {tc.icon}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-bold text-on-surface">{t.name}</h3>
                  </div>
                  <div
                    className="rounded-xl px-3 py-2.5 text-[12px] font-mono mb-3 leading-relaxed"
                    style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(59,130,246,0.15)", color: "#93c5fd" }}
                  >
                    {t.prompt}
                  </div>
                  <p className="text-[13px] leading-relaxed text-on-surface-variant">{t.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Trust section ──────────────────────────────────────── */}
        <section className="max-w-[1280px] mx-auto px-6 md:px-8 py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="glass-panel rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 relative sp-blob"
              style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(255,255,255,0.1))", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="material-symbols-outlined text-[32px] text-[#60a5fa] relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                shield_lock
              </span>
            </div>
            <h2 className="text-[32px] md:text-[42px] font-bold tracking-tight mb-4">
              Trust the{" "}
              <span className="sp-shimmer">code, not the key.</span>
            </h2>
            <p className="text-[16px] leading-relaxed text-on-surface-variant max-w-2xl mx-auto mb-8">
              The agent's key is isolated in a secure server wallet. Your Clarity policy contract is the real authority — it checks every action on-chain. A breached server key still cannot move more than your budget cap or touch any off-whitelist token.
            </p>
            <button
              onClick={scrollToConnect}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-[14px] font-bold text-white sp-pulse-ring-white"
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #000000 100%)", boxShadow: "0 8px 32px rgba(59,130,246,0.35)" }}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              Start delegating
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ background: "rgba(0,0,0,0.8)", borderTop: "1px solid rgba(255,255,255,0.05)" }} className="py-10 px-6 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)" }}>
                <span className="material-symbols-outlined text-white text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              </div>
              <span className="text-[18px] font-bold text-on-surface">
                Stack<span className="sp-gradient-text-blue">pilot</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                Stacks · Bitcoin L2
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />
                Powered by Bitflow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />
                Clarity Smart Contracts
              </span>
            </div>
            <p className="text-[12px] text-outline">© 2025 Stackpilot · Testnet</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Wallet Button ────────────────────────────────────────────────── */
function WalletButton({
  label,
  sublabel,
  disabled,
  onClick,
  children,
  accentColor,
}: {
  label: string;
  sublabel: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accentColor: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full p-4 rounded-xl flex items-center justify-between group disabled:opacity-50 transition-all"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid rgba(255,255,255,0.08)`,
        transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = accentColor + "55";
        (e.currentTarget as HTMLElement).style.background = accentColor + "10";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
    >
      <div className="flex items-center gap-3.5">
        {children}
        <div className="text-left">
          <div className="text-[15px] font-semibold text-on-surface">{label}</div>
          <div className="text-[12px] text-on-surface-variant">{sublabel}</div>
        </div>
      </div>
      <span className="material-symbols-outlined text-outline group-hover:text-on-surface transition-colors">
        chevron_right
      </span>
    </button>
  );
}

/* ── Section Header ───────────────────────────────────────────────── */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  eyebrowColor = "text-secondary",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  eyebrowColor?: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <div className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-3 ${eyebrowColor}`}>{eyebrow}</div>
      <h2 className="text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight text-on-surface">{title}</h2>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">{subtitle}</p>}
    </div>
  );
}
