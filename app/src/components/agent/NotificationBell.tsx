import { useState, useRef, useEffect } from "react";
import { useAgentWallet, type AgentAlert } from "@/hooks/useAgentWallet";

/**
 * Header notification bell — a real dropdown of the agent's alert feed
 * (useAgentWallet().alerts) with an unread badge. Styled to the dark cockpit
 * (blue/black/white). Unread = alerts newer than the last time the panel opened.
 */
const SEEN_KEY = "stackpilot_alerts_seen_ts";

const ICON: Record<AgentAlert["level"], { name: string; color: string }> = {
  info: { name: "info", color: "#60a5fa" },
  warning: { name: "warning", color: "#ffffff" },
  error: { name: "error", color: "#cbd5e1" },
  success: { name: "check_circle", color: "#60a5fa" },
};

export function NotificationBell() {
  const { alerts } = useAgentWallet();
  const [open, setOpen] = useState(false);
  const [seenTs, setSeenTs] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) || 0));
  const ref = useRef<HTMLDivElement>(null);

  const unread = alerts.filter((a) => a.timestamp > seenTs).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && alerts.length) {
      const ts = Date.now();
      localStorage.setItem(SEEN_KEY, String(ts));
      setSeenTs(ts);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 active:scale-[0.97] transition-all cursor-pointer"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: unread > 0 ? "'FILL' 1" : undefined }}>
          notifications
        </span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-[0_0_8px_rgba(59,130,246,0.6)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-h-[440px] overflow-hidden rounded-2xl z-[120] flex flex-col"
          style={{
            background: "rgba(13,17,23,0.97)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[14px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#60a5fa]">notifications</span>
              Notifications
            </span>
            <span className="text-[11px] text-outline font-mono">{alerts.length} total</span>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-outline">
              No notifications yet.
              <br />
              Agent activity will appear here.
            </div>
          ) : (
            <ul className="overflow-y-auto custom-scrollbar divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {alerts.map((a) => {
                const ic = ICON[a.level];
                return (
                  <li key={a.id} className="flex gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                    <span
                      className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: ic.color + "22" }}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ color: ic.color, fontVariationSettings: "'FILL' 1" }}>
                        {ic.name}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface">{a.title}</p>
                      <p className="text-[12px] text-on-surface-variant break-words">{a.message}</p>
                      <p className="text-[10px] text-outline mt-0.5 font-mono">{new Date(a.timestamp).toLocaleString()}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
