import { useNavigate } from "react-router-dom";
import { FiSun, FiMoon, FiExternalLink, FiCopy } from "react-icons/fi";
import { useCurrentAccount, useDisconnectWallet } from "@/lib/stacksWallet";
import { useTheme } from "@/hooks/useTheme";
import { useAgentWallet } from "@/hooks/useAgentWallet";

const NETWORK = (import.meta.env.VITE_STACKS_NETWORK as string) || "testnet";

/**
 * Settings — Strict Blue/White/Black aesthetic.
 * Blue/white section accents, animated theme toggle, gradient address rows.
 */

const SECTION_ACCENTS = [
  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.2)", icon: "palette" },    // Appearance
  { color: "#ffffff", bg: "rgba(255,255,255,0.12)",  border: "rgba(255,255,255,0.2)",  icon: "hub" },       // Network
  { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.2)",  icon: "manage_accounts" }, // Accounts
  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.2)",  icon: "shield_lock" }, // Policy
];

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { status } = useAgentWallet();

  return (
    <div className="min-h-full font-inter px-6 py-8" style={{ background: "#000000" }}>
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-on-surface mb-1 tracking-tight">Settings</h1>
          <p className="text-[13px] text-on-surface-variant">Preferences for your Stackpilot agent</p>
        </div>

        <div className="space-y-4">

          {/* Appearance */}
          <Section title="Appearance" accentIdx={0}>
            <Field label="Theme" icon="contrast">
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all active:scale-[0.97]"
                    style={
                      theme === t
                        ? {
                            background: "rgba(59,130,246,0.2)",
                            color: "#60a5fa",
                            borderColor: "rgba(59,130,246,0.45)",
                            boxShadow: "0 0 12px rgba(59,130,246,0.2)",
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            color: "#64748b",
                            borderColor: "rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    {t === "light" ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Network */}
          <Section title="Network" accentIdx={1}>
            <Field label="Active network" icon="cell_tower">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-bold capitalize"
                style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#ffffff]" style={{ boxShadow: "0 0 6px #ffffff" }} />
                Stacks {NETWORK}
              </span>
            </Field>
          </Section>

          {/* Accounts */}
          <Section title="Accounts" accentIdx={2}>
            <Field label="Connected wallet" icon="account_balance_wallet">
              {account ? (
                <AddressRow address={account.address} />
              ) : (
                <span className="text-[13px] text-on-surface-variant">Not connected</span>
              )}
            </Field>
            {status?.agentAddress && (
              <Field label="Agent wallet" icon="smart_toy">
                <AddressRow address={status.agentAddress} />
              </Field>
            )}
          </Section>

          {/* Agent policy */}
          <Section title="Agent Policy" accentIdx={3}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] text-on-surface font-semibold">Clarity Policy</div>
                <div className="text-[12px] text-on-surface-variant mt-0.5">
                  View and manage your on-chain trading constraints
                </div>
              </div>
              <button
                onClick={() => navigate("/agent/policy")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
                Manage
              </button>
            </div>
          </Section>

          {/* Disconnect */}
          {account && (
            <div className="pt-2">
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-2 text-[13px] font-semibold text-[#f87171] hover:text-[#ef4444] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Disconnect wallet
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center sp-blob"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)" }}
            >
              <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            </div>
            <span className="text-[14px] font-bold text-on-surface">
              Stack<span className="sp-gradient-text-blue">pilot</span>
            </span>
          </div>
          <p className="text-[12px] text-outline">Autonomous Trading Cockpit · Stacks Testnet</p>
        </div>
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────── */
function Section({ title, children, accentIdx }: { title: string; children: React.ReactNode; accentIdx: number }) {
  const a = SECTION_ACCENTS[accentIdx];
  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{ background: "rgba(20,20,20,0.5)", border: `1px solid rgba(255,255,255,0.07)`, backdropFilter: "blur(16px)" }}
    >
      {/* Colored top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${a.color}, transparent)` }}
      />
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: a.bg }}
        >
          <span className="material-symbols-outlined text-[14px]" style={{ color: a.color, fontVariationSettings: "'FILL' 1" }}>
            {a.icon}
          </span>
        </div>
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-outline">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ── Field ───────────────────────────────────────────────────────── */
function Field({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="material-symbols-outlined text-[16px] text-outline">{icon}</span>
        )}
        <span className="text-[14px] text-on-surface-variant">{label}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Address Row ─────────────────────────────────────────────────── */
function AddressRow({ address }: { address: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono text-[12px] font-bold px-3 py-1.5 rounded-lg"
        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f4", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {address.slice(0, 8)}…{address.slice(-6)}
      </span>
      <button
        onClick={() => navigator.clipboard?.writeText(address)}
        className="text-outline hover:text-[#60a5fa] transition-colors"
        title="Copy address"
      >
        <FiCopy className="w-3.5 h-3.5" />
      </button>
      <a
        href={`https://explorer.hiro.so/address/${address}?chain=${NETWORK}`}
        target="_blank"
        rel="noreferrer"
        className="text-outline hover:text-[#3b82f6] transition-colors"
        title="View on Hiro Explorer"
      >
        <FiExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
