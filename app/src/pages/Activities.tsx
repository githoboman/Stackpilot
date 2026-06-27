import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RiShareBoxLine } from "react-icons/ri";
import { MdLockOutline } from "react-icons/md";
import { IoMdStopwatch } from "react-icons/io";
import { useAgentWallet, type AgentAlert, type PolicyState } from "@/hooks/useAgentWallet";

type LevelFilter = "all" | "success" | "error" | "warning" | "info";

/**
 * Activities — Strict Blue/White/Black aesthetic.
 * Blue/white stat cards, colored filter pills, vibrant activity rows,
 * gradient policy sidebar with blue budget bar.
 */

const LEVEL_STYLE: Record<
  AgentAlert["level"],
  { iconBg: string; iconColor: string; icon: string; label: string }
> = {
  success: { iconBg: "rgba(59,130,246,0.15)",  iconColor: "#60a5fa",  icon: "check_circle",   label: "Success" },
  warning: { iconBg: "rgba(255,255,255,0.15)",  iconColor: "#ffffff",  icon: "warning",        label: "Warning" },
  error:   { iconBg: "rgba(148,163,184,0.15)",   iconColor: "#cbd5e1",  icon: "error",          label: "Failed"  },
  info:    { iconBg: "rgba(59,130,246,0.15)",  iconColor: "#60a5fa",  icon: "info",           label: "Info"    },
};

const FILTER_CHIPS: { key: LevelFilter; label: string; activeColor: string; activeBg: string }[] = [
  { key: "all",     label: "All",     activeColor: "#ffffff",  activeBg: "rgba(255,255,255,0.12)" },
  { key: "success", label: "Success", activeColor: "#60a5fa",  activeBg: "rgba(59,130,246,0.15)"  },
  { key: "error",   label: "Failed",  activeColor: "#cbd5e1",  activeBg: "rgba(148,163,184,0.15)"   },
  { key: "warning", label: "Warning", activeColor: "#ffffff",  activeBg: "rgba(255,255,255,0.15)"  },
  { key: "info",    label: "Info",    activeColor: "#60a5fa",  activeBg: "rgba(59,130,246,0.15)"  },
];

const STAT_CARDS = [
  { icon: "bar_chart",    iconBg: "rgba(59,130,246,0.15)", iconColor: "#60a5fa",  label: "Total actions",  key: "total" },
  { icon: "check_circle", iconBg: "rgba(255,255,255,0.15)", iconColor: "#ffffff",  label: "Successful",     key: "success" },
  { icon: "cancel",       iconBg: "rgba(148,163,184,0.15)",  iconColor: "#cbd5e1",  label: "Failed",         key: "failed" },
  { icon: "schedule",     iconBg: "rgba(59,130,246,0.15)", iconColor: "#60a5fa",  label: "Last activity",  key: "last" },
];

function formatRemaining(expiryMs: number): string {
  const diff = expiryMs - Date.now();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000) % 24;
  const d = Math.floor(diff / 86400000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export default function Activities() {
  const navigate = useNavigate();
  const { account, status, policy, alerts } = useAgentWallet();
  const [filter, setFilter] = useState<LevelFilter>("all");

  const stats = {
    total:   String(alerts.length),
    success: String(alerts.filter((a) => a.level === "success").length),
    failed:  String(alerts.filter((a) => a.level === "error").length),
    last:    alerts[0]?.timestamp
      ? new Date(alerts[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—",
  };
  const visible = filter === "all" ? alerts : alerts.filter((a) => a.level === filter);

  if (!account?.address) {
    return (
      <div
        className="h-full w-full flex items-center justify-center text-on-surface-variant font-inter text-[14px]"
        style={{ background: "#000000" }}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 sp-icon-blue">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
          </div>
          <p className="text-on-surface-variant">Connect your wallet to view agent activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden font-inter" style={{ background: "#000000" }}>

      {/* ── Left: Activity Log ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8">

        {/* Page header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-on-surface leading-tight">Activity Log</h1>
            <p className="text-[14px] text-on-surface-variant mt-1">On-chain executions and agent operations</p>
          </div>
          <button
            onClick={() => navigate("/agent")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
            Manage agent
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {STAT_CARDS.map((c) => (
            <div
              key={c.key}
              className="rounded-2xl p-4 sp-card-hover"
              style={{ background: "rgba(20,20,20,0.6)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.iconBg }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: c.iconColor, fontVariationSettings: "'FILL' 1" }}>
                    {c.icon}
                  </span>
                </div>
                <span className="text-[12px] text-on-surface-variant font-medium">{c.label}</span>
              </div>
              <div className="text-[24px] font-bold text-on-surface font-mono leading-none sp-counter">
                {stats[c.key as keyof typeof stats]}
              </div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {FILTER_CHIPS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border"
              style={
                filter === f.key
                  ? { background: f.activeBg, color: f.activeColor, borderColor: f.activeColor + "50" }
                  : { background: "rgba(255,255,255,0.04)", color: "#64748b", borderColor: "rgba(255,255,255,0.08)" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Activity table */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col flex-1"
          style={{ background: "rgba(10,10,10,0.6)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-12 px-5 py-3.5 text-[11px] font-bold text-outline uppercase tracking-widest"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
          >
            <div className="col-span-1" />
            <div className="col-span-5">Action</div>
            <div className="col-span-4">Details</div>
            <div className="col-span-2 text-right">Time</div>
          </div>

          {visible.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 sp-icon-blue">
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
              </div>
              <p className="text-[14px] text-on-surface-variant">
                {alerts.length === 0 ? (
                  <>No agent activity yet.{" "}
                    <button onClick={() => navigate("/agent")} className="underline hover:text-[#93c5fd] transition-colors">
                      Instruct the agent
                    </button>
                    {" "}to see executions here.
                  </>
                ) : (
                  <>No {filter === "error" ? "failed" : filter} activity to show.</>
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {visible.map((item) => {
                const digest = (item.meta?.txid as string | undefined) ?? undefined;
                const style = LEVEL_STYLE[item.level];
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 px-5 py-4 items-center group transition-all"
                    style={{ borderLeft: "2px solid transparent" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                      (e.currentTarget as HTMLElement).style.borderLeftColor = style.iconColor + "60";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent";
                    }}
                  >
                    {/* Icon */}
                    <div className="col-span-1 flex items-center">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: style.iconBg }}>
                        <span className="material-symbols-outlined text-[16px]" style={{ color: style.iconColor, fontVariationSettings: "'FILL' 1" }}>
                          {style.icon}
                        </span>
                      </div>
                    </div>
                    {/* Action */}
                    <div className="col-span-5 min-w-0 pr-4">
                      <div className="text-[14px] font-semibold text-on-surface truncate">{item.title}</div>
                      <div
                        className="text-[11px] font-bold uppercase tracking-wider mt-0.5"
                        style={{ color: style.iconColor }}
                      >
                        {style.label}
                      </div>
                    </div>
                    {/* Details */}
                    <div className="col-span-4 text-[13px] text-on-surface-variant break-words pr-3 leading-snug">
                      {item.message}
                    </div>
                    {/* Time + link */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-[12px] font-mono text-outline">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {digest ? (
                        <a
                          href={`https://explorer.hiro.so/txid/${digest}?chain=testnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-outline hover:text-[#60a5fa] transition-colors"
                          title="View on explorer"
                        >
                          <RiShareBoxLine className="text-[16px]" />
                        </a>
                      ) : (
                        <MdLockOutline className="text-[16px] text-outline/40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px shrink-0 my-8" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* ── Right: Policy Sidebar ────────────────────────────────── */}
      <PolicySidebar
        status={status?.bound ?? false}
        policy={policy}
        onEdit={() => navigate("/agent/policy")}
      />
    </div>
  );
}

/* ── Policy Sidebar ──────────────────────────────────────────────── */
function PolicySidebar({
  status,
  policy,
  onEdit,
}: {
  status: boolean;
  policy: PolicyState | null;
  onEdit: () => void;
}) {
  const cap     = policy ? Number(policy.budgetCap)   : 0;
  const spent   = policy ? Number(policy.budgetSpent) : 0;
  const usedPct = policy ? Math.min(100, Math.round(policy.usedPercent)) : 0;
  const assets  = policy?.allowedAssets ?? [];

  const expiryMs = policy
    ? Date.now() +
      (Number(policy.expiryBurnHeight) - Number(policy.currentBurnHeight ?? policy.expiryBurnHeight)) * 10 * 60 * 1000
    : 0;
  const isExpiringSoon = policy && expiryMs - Date.now() < 3600000;

  return (
    <div
      className="w-[340px] shrink-0 flex flex-col h-full overflow-y-auto p-6 space-y-5 hidden lg:flex"
      style={{ background: "rgba(10,10,10,0.8)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Header */}
      <div className="flex justify-between items-start pt-2">
        <div>
          <h2 className="text-[18px] font-bold text-on-surface">Clarity Policy</h2>
          <p className="text-[13px] text-on-surface-variant mt-0.5">Active constraints on agent</p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface-variant hover:text-on-surface transition-all"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[14px]">edit</span>
          Edit
        </button>
      </div>

      {!status || !policy ? (
        <div
          className="rounded-2xl p-5 text-[13px] text-on-surface-variant"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          No active policy. <button onClick={onEdit} className="underline hover:text-[#93c5fd] transition-colors">Create one</button> from the Agent page.
        </div>
      ) : (
        <>
          {/* Budget */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center sp-icon-blue">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
              </div>
              <h3 className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wider">Budget Allocation</h3>
            </div>
            {/* Gradient bar */}
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full transition-all progress-gradient"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[20px] font-bold text-on-surface font-mono">
                  {spent.toLocaleString()} <span className="text-[14px] text-outline font-normal">/ {cap.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-outline mt-1 font-semibold uppercase tracking-wider">Spent / Cap (µSTX)</div>
              </div>
              <div
                className="text-[20px] font-bold font-mono"
                style={{ color: usedPct > 80 ? "#60a5fa" : "#3b82f6" }}
              >
                {usedPct}%
              </div>
            </div>
          </div>

          {/* Allowed scope */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center sp-icon-blue">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>token</span>
              </div>
              <h3 className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wider">Allowed Scope</h3>
            </div>

            <div>
              <div className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Assets</div>
              <div className="flex flex-wrap gap-2">
                {assets.map((a) => (
                  <span
                    key={a}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                    style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>toll</span>
                    {a.length > 8 ? `${a.slice(0, 6)}…` : a}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Protocol</div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold"
                style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                Bitflow AMM
              </span>
            </div>
          </div>

          {/* Expiry timer */}
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: isExpiringSoon ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isExpiringSoon ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: isExpiringSoon ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)" }}
            >
              <IoMdStopwatch className="text-[24px]" style={{ color: isExpiringSoon ? "#60a5fa" : "#64748b" }} />
            </div>
            <div>
              <div
                className="text-[18px] font-bold font-mono"
                style={{ color: isExpiringSoon ? "#60a5fa" : "#e2e8f4" }}
              >
                {formatRemaining(expiryMs)}
              </div>
              <div className="text-[12px] text-on-surface-variant font-semibold">Until policy expiry</div>
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: policy.isActive ? "#3b82f6" : "#ffffff", boxShadow: `0 0 6px ${policy.isActive ? "#3b82f6" : "#ffffff"}` }}
            />
            <span className="text-[12px] font-semibold text-on-surface-variant">
              {policy.isActive ? "Policy Active" : "Policy Paused"}
            </span>
          </div>
        </>
      )}

      {/* Footer */}
      <div
        className="-mx-6 -mb-6 mt-auto flex items-center justify-center gap-2 py-4 text-[11px] font-bold text-outline uppercase tracking-wider"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span className="material-symbols-outlined text-[14px]">shield</span>
        Enforced On-Chain · Clarity
      </div>
    </div>
  );
}
