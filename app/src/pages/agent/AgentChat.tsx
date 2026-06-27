import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentWallet, type IntentResult } from "@/hooks/useAgentWallet";

/**
 * Agent Chat — Strict Blue/White/Black aesthetic.
 * Blue/white suggestion cards, glowing chat bubbles, morphing avatar,
 * gradient send button, animated thinking indicator.
 */

const SUGGESTIONS = [
  {
    icon: "waterfall_chart",
    title: "Auto-DCA into Bitcoin",
    text: "DCA 5 STX into sBTC every hour",
    desc: "Recurring cost-average strategy",
    iconBg: "sp-icon-blue",
    borderColor: "rgba(59,130,246,0.35)",
    bgColor: "rgba(59,130,246,0.06)",
    accentColor: "#3b82f6",
  },
  {
    icon: "swap_horiz",
    title: "Instant swap",
    text: "Swap 10 STX to sBTC",
    desc: "Execute at current market price",
    iconBg: "sp-icon-white",
    borderColor: "rgba(255,255,255,0.35)",
    bgColor: "rgba(255,255,255,0.06)",
    accentColor: "#ffffff",
  },
  {
    icon: "percent",
    title: "Percentage allocation",
    text: "Swap 30% of my STX to sBTC",
    desc: "Balance-relative swap amount",
    iconBg: "sp-icon-blue",
    borderColor: "rgba(59,130,246,0.35)",
    bgColor: "rgba(59,130,246,0.06)",
    accentColor: "#3b82f6",
  },
  {
    icon: "gpp_bad",
    title: "Revoke agent",
    text: "Revoke the agent",
    desc: "Immediately stop all operations",
    iconBg: "sp-icon-error",
    borderColor: "rgba(148,163,184,0.35)",
    bgColor: "rgba(148,163,184,0.06)",
    accentColor: "#e5e7eb",
  },
];

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text?: string;
  result?: IntentResult;
}

export default function AgentChat() {
  const navigate = useNavigate();
  const { account, status, busy, error, initWallet, sendIntent } = useAgentWallet();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const thinking = busy === "thinking";
  const bound = status?.bound ?? false;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || !status?.agentAddress || !bound) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, sender: "user", text }]);
    setInput("");
    try {
      const result = await sendIntent(text);
      setMessages((m) => [...m, { id: `a${Date.now()}`, sender: "agent", result }]);
    } catch {
      /* error surfaced via hook banner */
    }
  };

  // ── Disconnected state ───────────────────────────────────────────────
  if (!account?.address) {
    return (
      <GatedState
        icon="account_balance_wallet"
        iconBg="rgba(59,130,246,0.15)"
        iconColor="#60a5fa"
        title="Connect your wallet"
        subtitle="Connect your wallet from the header to start instructing the agent."
      />
    );
  }

  // ── No policy state ──────────────────────────────────────────────────
  if (!status || !bound) {
    return (
      <GatedState
        icon="shield_lock"
        iconBg="rgba(255,255,255,0.15)"
        iconColor="#ffffff"
        title={!status ? "Initialize agent wallet" : "Create a policy first"}
        subtitle={
          !status
            ? "Initialize your agent wallet to begin. This creates your isolated trading key."
            : "Create a Clarity policy to delegate trading within limits, then instruct the agent."
        }
      >
        <div className="mt-7 flex gap-3 flex-wrap justify-center">
          {!status ? (
            <button
              onClick={() => initWallet()}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white disabled:opacity-50 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {busy === "init" ? "sync" : "rocket_launch"}
              </span>
              {busy === "init" ? "Initializing…" : "Initialize agent"}
            </button>
          ) : (
            <button
              onClick={() => navigate("/agent/policy")}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #333333, #000000)", boxShadow: "0 4px 20px rgba(255,255,255,0.15)" }}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
              Create policy
            </button>
          )}
        </div>
        {error && (
          <p className="mt-4 text-[13px] text-[#cbd5e1] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </p>
        )}
      </GatedState>
    );
  }

  // ── Chat surface ─────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden relative" style={{ background: "#000000" }}>

      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-20 left-0 w-48 h-48 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)", filter: "blur(50px)" }} />
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto pt-6 pb-36 px-4 md:px-8 scroll-smooth relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 min-h-full">

          {messages.length === 0 ? (
            /* ── Empty state ─────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8 mt-8 md:mt-16">
              {/* Animated avatar */}
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center sp-blob"
                  style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(255,255,255,0.1))", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="absolute inset-0 rounded-3xl sp-blob opacity-40" style={{ background: "linear-gradient(135deg, #3b82f6, #ffffff)", filter: "blur(10px)" }} />
                  <span className="material-symbols-outlined text-[40px] text-on-surface relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                </div>
                {/* Pulse ring */}
                <div
                  className="absolute inset-0 rounded-3xl sp-pulse-ring"
                  style={{ border: "1px solid rgba(59,130,246,0.3)" }}
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-[26px] md:text-[32px] font-bold text-on-surface tracking-tight">
                  How can Stackpilot help<br />
                  <span className="sp-shimmer">you on-chain today?</span>
                </h2>
                <p className="text-[14px] text-on-surface-variant">
                  Instruct in plain language — your Clarity policy enforces the limits.
                </p>
              </div>

              {/* Suggestion cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    disabled={thinking}
                    className="group flex items-start gap-4 p-5 rounded-2xl text-left transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{
                      background: s.bgColor,
                      border: `1px solid ${s.borderColor}`,
                      transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${s.accentColor}25`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {s.icon}
                      </span>
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-[14px] font-semibold text-on-surface mb-0.5">{s.title}</div>
                      <div className="text-[12px] text-on-surface-variant mb-2">{s.desc}</div>
                      <div className="text-[12px] font-mono px-2 py-1 rounded-lg inline-block" style={{ background: "rgba(255,255,255,0.06)", color: s.accentColor }}>
                        "{s.text}"
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Chat messages ───────────────────────────────────── */
            <div className="w-full space-y-6 flex-1 pt-2">
              {messages.map((m) =>
                m.sender === "user" ? (
                  /* User bubble */
                  <div key={m.id} className="flex justify-end">
                    <div
                      className="px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-[80%] text-[15px] leading-relaxed"
                      style={{
                        background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(255,255,255,0.05))",
                        border: "1px solid rgba(59,130,246,0.25)",
                        color: "#e2e8f4",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ) : (
                  /* Agent response */
                  <div key={m.id} className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-1"
                      style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(255,255,255,0.1))", border: "1px solid rgba(59,130,246,0.25)" }}
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#93c5fd]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        smart_toy
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 max-w-3xl">
                      {m.result && <ResultCard result={m.result} />}
                    </div>
                  </div>
                ),
              )}

              {/* Thinking indicator */}
              {thinking && (
                <div className="flex items-center gap-3 ml-13">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(255,255,255,0.1))", border: "1px solid rgba(59,130,246,0.25)" }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#93c5fd]" style={{ fontVariationSettings: "'FILL' 1", animationName: "spin", animationDuration: "2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }}>
                      autorenew
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
                  >
                    <span className="font-mono text-[12px] text-[#93c5fd] uppercase tracking-wider">Parsing intent</span>
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Floating input ───────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 w-full p-4 pb-6 z-20"
        style={{ background: "linear-gradient(to top, #000000 60%, rgba(0,0,0,0) 100%)" }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all"
          style={{
            background: "rgba(20,20,20,0.7)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.45)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <span className="material-symbols-outlined text-outline text-[20px] shrink-0">
            chat_bubble
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Instruct the agent… e.g. "Swap 10 STX to sBTC"'
            disabled={thinking}
            className="bg-transparent border-0 outline-none flex-1 text-on-surface placeholder-outline text-[15px]"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1e3a8a)", boxShadow: input.trim() ? "0 0 12px rgba(59,130,246,0.4)" : "none" }}
          >
            <span className="material-symbols-outlined text-white text-[18px]">arrow_upward</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Gated State ─────────────────────────────────────────────────── */
function GatedState({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center flex-col px-6 text-center font-inter"
      style={{ background: "#000000" }}
    >
      <div className="relative mb-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center sp-blob"
          style={{ background: iconBg, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span
            className="material-symbols-outlined text-[40px] relative z-10"
            style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div
          className="absolute inset-0 rounded-3xl opacity-30 sp-blob"
          style={{ background: `radial-gradient(circle, ${iconColor}, transparent 70%)`, filter: "blur(12px)" }}
        />
      </div>
      <h2 className="text-[22px] font-bold text-on-surface mb-2 tracking-tight">{title}</h2>
      <p className="text-[14px] text-outline max-w-[360px] leading-relaxed">{subtitle}</p>
      {children}
    </div>
  );
}

/* ── Token Pair ──────────────────────────────────────────────────── */
function TokenPair({ a, b }: { a: string; b: string }) {
  const isBTC = (s: string) => s.toUpperCase().includes("SBTC") || s.toUpperCase().includes("BTC");
  return (
    <div className="flex -space-x-2 mr-1">
      {[a, b].map((sym, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-full flex items-center justify-center border-2 text-[9px] font-black text-white"
          style={{
            background: isBTC(sym) ? "linear-gradient(135deg, #ffffff, #d4d4d4)" : "linear-gradient(135deg, #3b82f6, #1e3a8a)",
            borderColor: "#000000",
            zIndex: i === 0 ? 1 : 0,
          }}
        >
          {isBTC(sym) ? "₿" : "S"}
        </div>
      ))}
    </div>
  );
}

/* ── Result Card ─────────────────────────────────────────────────── */
function ResultCard({ result }: { result: IntentResult }) {
  const { intent, ok, armed, message, outcome } = result;
  const armedLabel = armed === "dca" ? "Auto-DCA Armed" : armed === "scheduled" ? "Scheduled" : null;
  const ready = ok;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-on-surface-variant leading-relaxed">
        {ready
          ? "Understood — I've parsed your request into an actionable on-chain strategy."
          : "I parsed your request, but it can't run under your current policy."}
      </p>

      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "rgba(20,20,20,0.6)",
          border: ready ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(148,163,184,0.25)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Top accent line */}
        <div
          className="h-0.5 w-full"
          style={{ background: ready ? "linear-gradient(90deg, #3b82f6, #60a5fa)" : "linear-gradient(90deg, #e5e7eb, #cbd5e1)" }}
        />

        {/* Header */}
        <div
          className="px-5 py-3 flex justify-between items-center"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: ready ? "#3b82f6" : "#cbd5e1", fontVariationSettings: "'FILL' 1" }}
            >
              {ready ? "memory" : "error"}
            </span>
            <span className="text-[11px] font-bold tracking-widest text-outline uppercase">Strategy Parsed</span>
          </div>
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
            style={{
              background: ready ? "rgba(59,130,246,0.12)" : "rgba(148,163,184,0.12)",
              border: `1px solid ${ready ? "rgba(59,130,246,0.25)" : "rgba(148,163,184,0.25)"}`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: ready ? "#3b82f6" : "#e5e7eb" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: ready ? "#60a5fa" : "#cbd5e1" }}
            >
              {armedLabel ? "Armed" : ready ? "Executed" : "Rejected"}
            </span>
          </div>
        </div>

        {/* Parameter table */}
        <div className="p-5">
          <table className="w-full text-left border-collapse">
            <tbody>
              <ParamRow label="Action">
                <span
                  className="font-mono text-[12px] px-2.5 py-1 rounded-lg uppercase"
                  style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {intent.action.replace(/_/g, " ")}
                </span>
              </ParamRow>
              {intent.tokenIn && intent.tokenOut && (
                <ParamRow label="Pair">
                  <div className="flex items-center justify-end gap-2">
                    <TokenPair a={intent.tokenIn} b={intent.tokenOut} />
                    <span className="font-mono text-[12px] text-[#3b82f6]">{intent.tokenIn}</span>
                    <span className="material-symbols-outlined text-outline text-[16px]">arrow_right_alt</span>
                    <span className="font-mono text-[12px] text-[#ffffff]">{intent.tokenOut}</span>
                  </div>
                </ParamRow>
              )}
              {intent.amount != null && (
                <ParamRow label="Amount">
                  <span className="font-mono text-[12px] text-on-surface">
                    {intent.amount.toFixed?.(2) ?? intent.amount}{" "}
                    <span className="text-outline">{intent.tokenIn ?? "STX"}</span>
                  </span>
                </ParamRow>
              )}
              {intent.percentage != null && (
                <ParamRow label="Percentage">
                  <span className="font-mono text-[12px] text-[#ffffff]">{intent.percentage}%</span>
                </ParamRow>
              )}
              {intent.interval && (
                <ParamRow label="Interval">
                  <span className="font-mono text-[12px] text-[#60a5fa]">{intent.interval}</span>
                </ParamRow>
              )}
              {intent.schedule && (
                <ParamRow label="Schedule">
                  <span className="font-mono text-[12px] text-[#60a5fa]">{intent.schedule}</span>
                </ParamRow>
              )}
              {intent.price != null && (
                <ParamRow label="Price" last>
                  <span className="font-mono text-[12px] text-on-surface">{intent.price}</span>
                </ParamRow>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}
        >
          {outcome?.txid ? (
            <a
              href={`https://explorer.hiro.so/txid/${outcome.txid}?chain=testnet`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] flex items-center gap-1.5 transition-colors hover:text-[#60a5fa]"
              style={{ color: "#64748b" }}
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              View on Hiro Explorer
            </a>
          ) : (
            <span className="text-[13px] font-medium" style={{ color: ready ? "#60a5fa" : "#cbd5e1" }}>
              {message}
            </span>
          )}
          <span
            className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-lg"
            style={{
              background: ready ? "rgba(59,130,246,0.12)" : "rgba(148,163,184,0.12)",
              color: ready ? "#3b82f6" : "#cbd5e1",
            }}
          >
            {armedLabel ?? (ready ? "Done" : "Blocked")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Param Row ───────────────────────────────────────────────────── */
function ParamRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <tr style={last ? {} : { borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <td className="py-3 text-[13px] text-outline">{label}</td>
      <td className="py-3 text-right">{children}</td>
    </tr>
  );
}
