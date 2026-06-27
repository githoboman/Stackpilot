import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiExternalLink } from "react-icons/fi";
import { useAgentWallet, type AgentAlert } from "@/hooks/useAgentWallet";

/**
 * Agent History — Strict Blue/White/Black aesthetic.
 * Blue/white timeline dots with glow,
 * hover-lift transaction cards, day-group headers with subtle blue underlines.
 */

interface TxRecord {
  id: string;
  title: string;
  message: string;
  level: AgentAlert["level"];
  timestamp: number;
  digest?: string;
  orderId?: string;
}

const LEVEL_DOT: Record<AgentAlert["level"], { color: string; glow: string }> = {
  success: { color: "#3b82f6", glow: "0 0 8px rgba(59,130,246,0.7)" },
  warning: { color: "#ffffff", glow: "0 0 8px rgba(255,255,255,0.7)" },
  error:   { color: "#ef4444", glow: "0 0 8px rgba(239,68,68,0.7)" },
  info:    { color: "#60a5fa", glow: "0 0 8px rgba(96,165,250,0.7)" },
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function History() {
  const navigate = useNavigate();
  const { account, alerts } = useAgentWallet();

  const records: TxRecord[] = useMemo(
    () =>
      alerts
        .map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          level: a.level,
          timestamp: a.timestamp,
          digest: a.meta?.txid as string | undefined,
          orderId: a.meta?.run != null ? `run ${a.meta.run}` : undefined,
        }))
        .filter((r) => r.digest)
        .sort((x, y) => y.timestamp - x.timestamp),
    [alerts],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TxRecord[]>();
    for (const r of records) {
      const k = dayKey(r.timestamp);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    return Array.from(map.entries());
  }, [records]);

  if (!account?.address) {
    return (
      <Empty
        title="Connect your wallet"
        body="Connect from the header to view your agent's on-chain transaction history."
        icon="account_balance_wallet"
        iconBg="rgba(59,130,246,0.15)"
        iconColor="#60a5fa"
      />
    );
  }

  if (records.length === 0) {
    return (
      <Empty
        title="No transactions yet"
        body="Once the agent executes a trade, it appears here with an explorer link."
        icon="receipt_long"
        iconBg="rgba(255,255,255,0.15)"
        iconColor="#ffffff"
        action={
          <button
            onClick={() => navigate("/agent")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            Instruct the agent
          </button>
        }
      />
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-6 md:px-8 py-8 font-inter" style={{ background: "#000000" }}>
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold text-on-surface leading-tight tracking-tight">History</h1>
            <p className="text-[14px] text-on-surface-variant mt-1">Settled on-chain executions by your agent</p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[13px] font-bold text-on-surface-variant"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            {records.length} tx
          </div>
        </div>

        <div className="space-y-10">
          {grouped.map(([day, items]) => (
            <div key={day}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[14px] text-outline">calendar_today</span>
                <span className="text-[12px] font-bold text-outline uppercase tracking-widest">{day}</span>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
              </div>

              {/* Timeline */}
              <div
                className="relative pl-6"
                style={{ borderLeft: "2px solid transparent", background: "linear-gradient(#000000, #000000) padding-box, linear-gradient(180deg, #3b82f633, #ffffff33, #3b82f633) border-box" }}
              >
                <div className="space-y-4">
                  {items.map((r) => {
                    const dot = LEVEL_DOT[r.level];
                    return (
                      <div
                        key={r.id}
                        className="relative rounded-2xl p-5 sp-card-hover transition-all"
                        style={{ background: "rgba(20,20,20,0.5)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = dot.color + "45";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                        }}
                      >
                        {/* Timeline dot */}
                        <span
                          className="absolute -left-[30px] top-5 w-3 h-3 rounded-full ring-4"
                          style={{ background: dot.color, boxShadow: dot.glow, ["--tw-ring-color" as any]: "#000000" }}
                        />
                        {/* Colored left accent */}
                        <div
                          className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
                          style={{ background: dot.color, opacity: 0.6 }}
                        />

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: dot.color }}
                              />
                              <div className="text-[15px] font-semibold text-on-surface truncate">{r.title}</div>
                            </div>
                            <div className="text-[13px] text-on-surface-variant leading-relaxed break-words pl-3.5">
                              {r.message}
                            </div>
                          </div>
                          <span className="text-[12px] font-mono font-bold text-outline whitespace-nowrap shrink-0 mt-0.5">
                            {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Footer */}
                        <div
                          className="flex items-center gap-3 mt-4 pt-3"
                          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <a
                            href={`https://explorer.hiro.so/txid/${r.digest}?chain=testnet`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-bold transition-colors"
                            style={{ color: "#60a5fa" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#93c5fd"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#60a5fa"; }}
                          >
                            <FiExternalLink className="w-3 h-3" />
                            View transaction
                          </a>
                          {r.orderId && (
                            <span className="text-[11px] font-mono text-outline">
                              {r.orderId}
                            </span>
                          )}
                          <span className="ml-auto font-mono text-[11px] text-outline">
                            {r.digest!.slice(0, 8)}…{r.digest!.slice(-6)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer link */}
        <button
          onClick={() => navigate("/agent/activity")}
          className="mt-10 inline-flex items-center gap-2 text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">bar_chart</span>
          See full activity log
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */
function Empty({
  title,
  body,
  icon,
  iconBg,
  iconColor,
  action,
}: {
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center px-6 text-center font-inter"
      style={{ background: "#000000" }}
    >
      <div className="relative mb-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center sp-blob"
          style={{ background: iconBg, border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span
            className="material-symbols-outlined text-[32px] relative z-10"
            style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div
          className="absolute inset-0 rounded-2xl opacity-30"
          style={{ background: `radial-gradient(circle, ${iconColor}, transparent 70%)`, filter: "blur(12px)" }}
        />
      </div>
      <h1 className="text-[20px] font-bold text-on-surface mb-2 tracking-tight">{title}</h1>
      <p className="text-[14px] text-on-surface-variant max-w-[360px] leading-relaxed">{body}</p>
      {action}
    </div>
  );
}
