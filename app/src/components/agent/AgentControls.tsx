import { useState, useEffect } from "react";
import {
  useAgentWallet,
  type CreatePolicyForm,
  type AgentAlert,
  type IntentResult,
  type PolicyState,
  type DcaState,
} from "@/hooks/useAgentWallet";
import { useNavigate } from "react-router-dom";

/**
 * Agent Policy Controls — Whisk-aesthetic redesign.
 * Gradient blur orbs, glassmorphism cards, glowing status borders,
 * multi-stop progress bars, vivid call-to-actions, and animated reveals.
 */

const SUGGESTIONS = [
  { text: "DCA 5 STX into sBTC every hour" },
  { text: "Swap 10 STX to sBTC" },
  { text: "Swap 30% of my STX to sBTC" },
];

const ASSET_OPTIONS = ["STX", "sBTC"] as const;

const ALERT_ICON: Record<AgentAlert["level"], string> = {
  info: "info",
  warning: "warning",
  error: "error",
  success: "check_circle",
};
const ALERT_COLOR: Record<AgentAlert["level"], string> = {
  info: "text-[#a78bfa]",
  warning: "text-[#f59e0b]",
  error: "text-[#f87171]",
  success: "text-[#2dd4bf]",
};

export function AgentControls() {
  const navigate = useNavigate();
  const {
    account,
    status,
    policy,
    dca,
    alerts,
    busy,
    error,
    initWallet,
    createPolicy,
    pause,
    resume,
    revoke,
    sendIntent,
    startDca,
    stopDca,
  } = useAgentWallet();

  const [instruction, setInstruction] = useState("");
  const [lastResult, setLastResult] = useState<IntentResult | null>(null);

  // Auto-DCA inputs.
  const [dcaAmount, setDcaAmount] = useState("5");
  const [dcaIntervalMin, setDcaIntervalMin] = useState("60");
  const startDcaNow = () => {
    const amount = Number(dcaAmount);
    const intervalMs = Math.max(1, Number(dcaIntervalMin)) * 60_000;
    if (!Number.isFinite(amount) || amount <= 0) return;
    void startDca({ amount, intervalMs, tokenIn: "STX", tokenOut: "sBTC" });
  };

  // Create-policy form (human STX amounts → micro-STX at submit).
  const [budgetStx, setBudgetStx] = useState("50");
  const [expiryHours, setExpiryHours] = useState(24);
  const [form, setForm] = useState<CreatePolicyForm>({
    budgetCap: "50000000",
    allowedAssets: ["STX", "sBTC"],
    expiryBlocks: 144,
  });

  const stxToMicro = (stx: string): string => {
    const n = Number(stx);
    if (!Number.isFinite(n) || n < 0) return "0";
    return BigInt(Math.round(n * 1e6)).toString();
  };

  const submitPolicy = () =>
    createPolicy({
      ...form,
      budgetCap: stxToMicro(budgetStx),
      expiryBlocks: Math.max(1, Math.round(expiryHours * 6)),
    });

  const runInstruction = async (text: string) => {
    if (!text.trim() || !status?.agentAddress) return;
    try {
      setLastResult(await sendIntent(text));
      setInstruction("");
    } catch {
      /* surfaced via hook */
    }
  };

  const toggleAsset = (a: string) =>
    setForm((f) => ({
      ...f,
      allowedAssets: f.allowedAssets.includes(a) ? f.allowedAssets.filter((x) => x !== a) : [...f.allowedAssets, a],
    }));

  if (!account?.address) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center font-inter" style={{ background: "#0a0d12" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 sp-icon-violet">
          <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
        </div>
        <h2 className="text-[20px] font-bold text-on-surface mb-2 tracking-tight">Connect your wallet</h2>
        <p className="text-[14px] text-on-surface-variant max-w-sm">Connect from the header to initialize and manage your autonomous trading agent.</p>
      </div>
    );
  }

  const bound = status?.bound ?? false;
  const busyIdle = busy === "idle";

  return (
    <div className="relative min-h-full font-inter overflow-hidden" style={{ background: "#0a0d12" }}>
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #ff6a4d, transparent 70%)", filter: "blur(70px)" }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto p-6 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="xl:col-span-8 flex flex-col gap-8 min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] md:text-[38px] font-bold text-on-surface flex flex-wrap items-center gap-3 tracking-tight leading-tight">
              Agent Policy
              {bound && status?.policyId && (
                <span
                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-[12px] font-mono font-bold tracking-wider uppercase mt-1 md:mt-0"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
                >
                  <span className="material-symbols-outlined text-[14px] mr-1.5">tag</span>
                  POL-{status.policyId}
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                <span className="font-mono text-[13px] font-bold text-[#2dd4bf]">
                  {status?.agentAddress?.slice(0, 5)}…{status?.agentAddress?.slice(-4)}
                </span>
              </div>
              <span className="text-[14px] text-on-surface-variant font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-outline">shield</span>
                {bound ? (policy?.isActive ? "Active Execution Mode" : "Policy Paused") : "No policy set"}
              </span>
            </div>
          </div>

          {/* No wallet/policy gates */}
          {!status ? (
            <div
              className="rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
              style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(139,92,246,0.2)", backdropFilter: "blur(16px)" }}
            >
              <div>
                <h3 className="text-[18px] font-bold text-on-surface mb-1">Initialize Agent Wallet</h3>
                <p className="text-[14px] text-on-surface-variant">Create the isolated trading key on the server before delegating a policy.</p>
              </div>
              <button
                onClick={() => initWallet()}
                disabled={busy === "init"}
                className="shrink-0 inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 sp-pulse-ring-violet"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", boxShadow: "0 8px 24px rgba(139,92,246,0.3)" }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {busy === "init" ? "sync" : "rocket_launch"}
                </span>
                {busy === "init" ? "Initializing…" : "Initialize Agent"}
              </button>
            </div>
          ) : !bound ? (
            <CreatePolicyCard
              budgetStx={budgetStx}
              setBudgetStx={setBudgetStx}
              expiryHours={expiryHours}
              setExpiryHours={setExpiryHours}
              form={form}
              toggleAsset={toggleAsset}
              stxToMicro={stxToMicro}
              onSubmit={submitPolicy}
              busy={busy}
              busyIdle={busyIdle}
            />
          ) : (
            <div className="space-y-8">
              {/* Auto-DCA configurator */}
              <DcaCard
                dca={dca}
                amount={dcaAmount}
                setAmount={setDcaAmount}
                intervalMin={dcaIntervalMin}
                setIntervalMin={setDcaIntervalMin}
                onStart={startDcaNow}
                onStop={() => void stopDca()}
                busy={busy === "dca"}
              />

              {/* Command surface */}
              <div
                className="rounded-3xl p-6"
                style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold uppercase tracking-widest text-outline">Quick Command</h3>
                  <button
                    onClick={() => navigate("/agent")}
                    className="text-[12px] font-semibold text-[#8b5cf6] hover:text-[#a78bfa] flex items-center gap-1 transition-colors"
                  >
                    Go to chat <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runInstruction(instruction);
                  }}
                  className="flex items-center gap-3 rounded-2xl pl-5 pr-2 py-2 transition-all"
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocusCapture={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,106,77,0.45)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(255,106,77,0.12)";
                  }}
                  onBlurCapture={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <span className="material-symbols-outlined text-outline text-[20px]">chat</span>
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g. Swap 10 STX to sBTC"
                    className="bg-transparent outline-none w-full text-on-surface placeholder-outline text-[15px]"
                  />
                  <button
                    type="submit"
                    disabled={busy === "thinking" || !instruction.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40 text-white"
                    style={{ background: "linear-gradient(135deg, #ff6a4d, #f59e0b)", boxShadow: instruction.trim() ? "0 4px 12px rgba(255,106,77,0.3)" : "none" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                  </button>
                </form>
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => runInstruction(s.text)}
                      disabled={busy === "thinking"}
                      className="text-[12px] font-mono px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,106,77,0.4)";
                        (e.currentTarget as HTMLElement).style.color = "#ff8a70";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                        (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                      }}
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
                {lastResult && <StrategyResult result={lastResult} />}
                {error && <p className="mt-4 text-[13px] text-[#f87171] flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">error</span> {error}</p>}
              </div>

              {/* Two-pane: Execution log + Policy state control */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Execution log (DCA + alerts) */}
                <div
                  className="rounded-3xl p-6 flex flex-col h-[420px]"
                  style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
                >
                  <div className="flex items-center justify-between mb-5 border-b border-outline-variant/20 pb-4">
                    <h3 className="text-[14px] font-bold uppercase tracking-widest text-outline">DCA Executions</h3>
                    <span className="material-symbols-outlined text-outline text-[18px]">filter_list</span>
                  </div>
                  <div className="overflow-y-auto flex-1 pr-3 space-y-3 custom-scrollbar">
                    {dca?.history?.length ? (
                      dca.history.map((r) => (
                        <div
                          key={r.n}
                          className="p-4 rounded-2xl transition-all"
                          style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[11px] font-bold text-outline uppercase tracking-wider">Run #{r.n}</span>
                            <span className={`material-symbols-outlined text-[16px] ${r.ok ? "text-[#14b8a6]" : "text-[#f59e0b]"}`}>
                              {r.ok ? "check_circle" : "warning"}
                            </span>
                          </div>
                          {r.ok ? (
                            <div className="text-[14px] font-medium text-on-surface">
                              Swapped <span className="font-mono text-[#ff8a70]">{dca.amount && (Number(dca.amount) / 1e6).toLocaleString()} STX</span> → <span className="font-mono text-[#fbbf24]">sBTC</span>
                            </div>
                          ) : (
                            <div className="text-[13px] text-[#f59e0b] leading-snug">{r.reason ?? "Execution failed"}</div>
                          )}
                          {r.txid && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
                              <span className="font-mono text-[11px] text-outline truncate w-3/4">Tx: {r.txid.slice(0, 10)}…</span>
                              <a
                                href={`https://explorer.hiro.so/txid/${r.txid}?chain=testnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#a78bfa] hover:text-[#8b5cf6] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                              </a>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-[32px] text-outline/30 mb-3">receipt_long</span>
                        <p className="text-[13px] text-outline">No automated runs yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Policy state control + alerts */}
                <div className="flex flex-col gap-6">
                  {/* Status Toggle */}
                  <div
                    className="rounded-3xl p-6"
                    style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
                  >
                    <h3 className="text-[14px] font-bold uppercase tracking-widest text-outline mb-4">State Control</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => pause()}
                        disabled={!busyIdle || !policy?.isActive}
                        className="flex-1 rounded-xl py-3 text-[13px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                        style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}
                        onMouseEnter={(e) => { if (busyIdle && policy?.isActive) (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.12)"; }}
                      >
                        <span className="material-symbols-outlined text-[18px]">pause</span> Pause Agent
                      </button>
                      <button
                        onClick={() => resume()}
                        disabled={!busyIdle || policy?.isActive}
                        className="flex-1 rounded-xl py-3 text-[13px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                        style={{ background: "rgba(20,184,166,0.12)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.25)" }}
                        onMouseEnter={(e) => { if (busyIdle && !policy?.isActive) (e.currentTarget as HTMLElement).style.background = "rgba(20,184,166,0.2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(20,184,166,0.12)"; }}
                      >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span> Resume
                      </button>
                    </div>
                  </div>

                  {/* Alerts */}
                  <div
                    className="rounded-3xl p-6 flex-1 flex flex-col"
                    style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
                  >
                    <h3 className="text-[14px] font-bold uppercase tracking-widest text-outline mb-4">Live Alerts</h3>
                    <div className="space-y-4 overflow-y-auto max-h-[160px] custom-scrollbar pr-3 flex-1">
                      {alerts.length ? (
                        alerts.map((a) => (
                          <div key={a.id} className="flex gap-3 items-start">
                            <span className={`material-symbols-outlined text-[18px] mt-0.5 ${ALERT_COLOR[a.level]}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                              {ALERT_ICON[a.level]}
                            </span>
                            <div>
                              <span className="font-mono text-[10px] font-bold tracking-wider text-outline block mb-1">
                                {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <p className="text-[13px] text-on-surface-variant leading-snug">
                                <span className="font-bold text-on-surface">{a.title}</span> — {a.message}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[13px] text-outline text-center mt-6">No recent alerts.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Active Policy drawer ──────────────────────── */}
        {bound && (
          <div className="xl:col-span-4">
            <ActivePolicyDrawer form={form} policy={policy} onRevoke={() => void revoke()} busy={busy === "revoking"} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Auto-DCA configurator ─────────────────────────────────────────── */
function DcaCard({
  dca,
  amount,
  setAmount,
  intervalMin,
  setIntervalMin,
  onStart,
  onStop,
  busy,
}: {
  dca: DcaState | null;
  amount: string;
  setAmount: (v: string) => void;
  intervalMin: string;
  setIntervalMin: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
  busy: boolean;
}) {
  const active = dca?.active ?? false;
  const estPerRun = dca ? (Number(dca.amount) / 1e6).toLocaleString() : amount;

  return (
    <div
      className="rounded-3xl p-8 relative overflow-hidden group transition-all"
      style={{
        background: "linear-gradient(135deg, rgba(24,29,39,0.7), rgba(24,29,39,0.5))",
        border: active ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,106,77,0.25)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Top gradient border accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: active ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ff6a4d, #f59e0b)" }}
      />
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: active ? "#f59e0b" : "#ff6a4d" }}
      />

      <div className="flex items-start justify-between mb-8 relative z-10">
        <div>
          <h2 className="text-[26px] font-bold text-on-surface flex items-center gap-3 tracking-tight">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: active ? "rgba(245,158,11,0.15)" : "rgba(255,106,77,0.15)" }}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ color: active ? "#f59e0b" : "#ff6a4d" }}>autorenew</span>
            </div>
            Auto-DCA
          </h2>
          <p className="text-[14px] text-on-surface-variant mt-2 max-w-md">
            Automate recurring swaps from STX to sBTC via Bitflow.
          </p>
        </div>
        {active && (
          <div className="text-right px-4 py-2.5 rounded-xl bg-surface-dim border border-outline-variant/10">
            <div className="font-mono text-[11px] font-bold tracking-widest uppercase text-outline mb-1">Next Run</div>
            <div className="text-[22px] font-bold text-[#fbbf24] font-mono leading-none">
              <DcaCountdown nextRunAt={dca!.nextRunAt} />
            </div>
          </div>
        )}
      </div>

      {!active ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-outline block mb-2">Swap Amount (STX)</label>
              <div className="relative">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full bg-black/20 border border-outline-variant/20 rounded-xl py-3.5 px-4 font-mono text-[15px] text-on-surface focus:border-[#ff6a4d]/50 outline-none transition-colors"
                  inputMode="decimal"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-outline">currency_bitcoin</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-outline block mb-2">Interval (Minutes)</label>
              <div className="relative">
                <input
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-full bg-black/20 border border-outline-variant/20 rounded-xl py-3.5 px-4 font-mono text-[15px] text-on-surface focus:border-[#ff6a4d]/50 outline-none transition-colors"
                  inputMode="numeric"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-outline">timer</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-outline-variant/20 pt-6 relative z-10 gap-6">
            <div className="flex gap-8">
              <Stat label="Est. Per Run" value={`${amount} STX`} color="#ff8a70" />
              <Stat label="Pair" value="STX → sBTC" color="#fbbf24" />
            </div>
            <button
              onClick={onStart}
              disabled={busy || Number(amount) <= 0}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 sp-pulse-ring shrink-0"
              style={{ background: "linear-gradient(135deg, #ff6a4d, #f59e0b)", boxShadow: "0 8px 24px rgba(255,106,77,0.3)" }}
            >
              {busy ? "Starting…" : "Start Auto-DCA"}
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-outline-variant/20 pt-6 relative z-10 gap-6">
          <div className="flex gap-8">
            <Stat label="Amount" value={`${estPerRun} STX`} color="#ff8a70" />
            <Stat label="Executions" value={`${dca!.runs} / ${dca!.maxRuns} max`} color="#fbbf24" />
          </div>
          <button
            onClick={onStop}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-bold transition-all active:scale-[0.97] shrink-0"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            Stop Auto-DCA
            <span className="material-symbols-outlined text-[18px]">stop</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Create-policy card ────────────────────────────────────────────── */
function CreatePolicyCard({
  budgetStx,
  setBudgetStx,
  expiryHours,
  setExpiryHours,
  form,
  toggleAsset,
  stxToMicro,
  onSubmit,
  busy,
  busyIdle,
}: {
  budgetStx: string;
  setBudgetStx: (v: string) => void;
  expiryHours: number;
  setExpiryHours: (v: number) => void;
  form: CreatePolicyForm;
  toggleAsset: (a: string) => void;
  stxToMicro: (v: string) => string;
  onSubmit: () => void;
  busy: string;
  busyIdle: boolean;
}) {
  return (
    <div
      className="rounded-3xl p-8 space-y-8 relative overflow-hidden"
      style={{ background: "rgba(24,29,39,0.5)", border: "1px solid rgba(139,92,246,0.25)", backdropFilter: "blur(16px)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #8b5cf6, #2dd4bf)" }} />

      <div className="flex items-center justify-between">
        <h2 className="text-[26px] font-bold text-on-surface tracking-tight">Create policy</h2>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full uppercase"
          style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span> On-Chain Enforced
        </span>
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wider text-outline block mb-3">Maximum Budget Cap (STX)</label>
        <div className="relative">
          <input
            value={budgetStx}
            onChange={(e) => setBudgetStx(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full bg-black/20 border border-outline-variant/20 rounded-xl py-4 px-5 pr-16 font-mono text-[16px] text-on-surface focus:border-[#a78bfa]/50 outline-none transition-colors"
            inputMode="decimal"
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-outline">STX</span>
        </div>
        <p className="text-[12px] text-outline mt-2 font-mono flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
          {Number(stxToMicro(budgetStx)).toLocaleString()} micro-STX on-chain
        </p>
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wider text-outline block mb-3">Allowed Tokens</label>
        <div className="flex flex-wrap gap-3">
          {ASSET_OPTIONS.map((a) => {
            const on = form.allowedAssets.includes(a);
            return (
              <button
                key={a}
                onClick={() => toggleAsset(a)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold border transition-all ${
                  on
                    ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#fbbf24] shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "bg-transparent border-dashed border-outline-variant/40 text-outline hover:border-outline-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{on ? "lock" : "lock_open"}</span>
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wider text-outline block mb-3">Expiry (hours)</label>
        <input
          type="number"
          value={expiryHours}
          onChange={(e) => setExpiryHours(Number(e.target.value))}
          className="w-full bg-black/20 border border-outline-variant/20 rounded-xl py-4 px-5 font-mono text-[16px] text-on-surface focus:border-[#a78bfa]/50 outline-none transition-colors"
          min={1}
        />
        <p className="text-[12px] text-outline mt-2 font-mono flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
          ≈ {Math.max(1, Math.round(expiryHours * 6))} burn blocks
        </p>
      </div>

      <div
        className="rounded-2xl p-4 flex gap-3 items-start"
        style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}
      >
        <span className="material-symbols-outlined text-[#2dd4bf] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">
          Protocol is strictly limited to Bitflow. Assets and protocols not listed here are blocked on-chain by the Clarity policy.
        </p>
      </div>

      <button
        onClick={onSubmit}
        disabled={!busyIdle || form.allowedAssets.length === 0 || Number(budgetStx) <= 0}
        className="w-full rounded-xl py-4 text-[15px] font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-white sp-pulse-ring-violet"
        style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }}
      >
        {busy === "creating" || busy === "binding" ? (busy === "binding" ? "Confirming on-chain…" : "Awaiting signature…") : "Create policy"}
      </button>
    </div>
  );
}

/* ── Active Policy drawer (right column) ───────────────────────────── */
function ActivePolicyDrawer({
  form,
  policy,
  onRevoke,
  busy,
}: {
  form: CreatePolicyForm;
  policy: PolicyState | null;
  onRevoke: () => void;
  busy: boolean;
}) {
  const assets = policy?.allowedAssets?.length ? policy.allowedAssets : form.allowedAssets;
  const cap = policy ? Number(policy.budgetCap) : Number(form.budgetCap);
  const spent = policy ? Number(policy.budgetSpent) : 0;
  const usedPct = policy ? Math.min(100, Math.round(policy.usedPercent)) : 0;
  const blocksLeft = policy ? Number(policy.expiryBurnHeight) - Number(policy.currentBurnHeight ?? policy.expiryBurnHeight) : 0;
  const daysLeft = (blocksLeft * 10) / 60 / 24;

  return (
    <div
      className="rounded-3xl border border-outline-variant/20 p-6 md:p-8 flex flex-col sticky top-6 shadow-2xl"
      style={{ background: "rgba(13,17,23,0.8)", backdropFilter: "blur(24px)" }}
    >
      <div className="flex items-center justify-between mb-8 pb-5 border-b border-outline-variant/10">
        <h2 className="text-[22px] font-bold text-on-surface flex items-center gap-2.5 tracking-tight">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center sp-icon-teal">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </div>
          Active Policy
        </h2>
        <span
          className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold tracking-widest border"
          style={
            policy?.revoked
              ? { background: "rgba(239,68,68,0.12)", color: "#f87171", borderColor: "rgba(239,68,68,0.25)" }
              : policy?.isActive
              ? { background: "rgba(20,184,166,0.12)", color: "#2dd4bf", borderColor: "rgba(20,184,166,0.25)" }
              : { background: "rgba(245,158,11,0.12)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.25)" }
          }
        >
          {policy?.revoked ? "REVOKED" : policy?.isActive ? "LOCKED" : "PAUSED"}
        </span>
      </div>

      <div className="space-y-8 flex-1">
        {/* Budget */}
        <div>
          <div className="flex justify-between items-end mb-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-outline flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#ff8a70]">savings</span>
              Stipend Usage
            </h4>
            <div className="text-right">
              <span className="font-mono text-[18px] font-bold text-on-surface">{(spent / 1e6).toLocaleString()}</span>
              <span className="font-mono text-[13px] text-outline"> / {(cap / 1e6).toLocaleString()} STX</span>
            </div>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: "linear-gradient(90deg, #ff6a4d, #f59e0b, #14b8a6)" }} />
          </div>
          <p className="font-mono text-[11px] text-outline mt-2.5 text-right font-bold">{usedPct}% Utilized</p>
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline block mb-2">Expiry Frame</span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#fbbf24]">hourglass_empty</span>
              <span className="font-mono text-[15px] font-bold text-on-surface">{policy ? `~${daysLeft.toFixed(1)} Days` : "—"}</span>
            </div>
            {policy && <span className="font-mono text-[11px] text-outline block mt-2">Block {Number(policy.expiryBurnHeight).toLocaleString()}</span>}
          </div>
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-outline block mb-2">Target Protocol</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-black border border-outline-variant/30">
                <span className="material-symbols-outlined text-[12px] text-white">water_drop</span>
              </div>
              <span className="text-[14px] font-bold text-on-surface">Bitflow</span>
            </div>
          </div>
        </div>

        {/* Whitelist */}
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-outline mb-4">Enforced Whitelist</h4>
          <div className="flex flex-wrap gap-2.5">
            {assets.map((a) => (
              <div
                key={a}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-on-surface font-bold"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <span className="material-symbols-outlined text-[14px] text-[#a78bfa]">lock</span>
                <span className="font-mono text-[13px]">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revoke */}
      <div className="mt-10 pt-6 border-t border-outline-variant/10">
        <button
          onClick={onRevoke}
          disabled={busy}
          className="w-full py-4 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[14px] transition-all disabled:opacity-50 active:scale-[0.98]"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
          onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }}
        >
          <span className="material-symbols-outlined text-[20px]">gavel</span>
          {busy ? "Revoking…" : "Revoke Policy On-Chain"}
        </button>
        <p className="text-center font-mono text-[11px] text-outline mt-3 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[12px]">info</span>
          Requires wallet signature
        </p>
      </div>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────────── */
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-outline block mb-1">{label}</span>
      <span className="font-mono text-[14px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function StrategyResult({ result }: { result: IntentResult }) {
  const { intent, ok, armed, message, outcome } = result;
  const armedLabel = armed === "dca" ? "Auto-DCA armed" : armed === "scheduled" ? "Scheduled" : null;
  return (
    <div
      className="mt-5 rounded-2xl overflow-hidden transition-all"
      style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${ok ? "rgba(20,184,166,0.25)" : "rgba(239,68,68,0.25)"}` }}
    >
      <div className="px-5 py-3 border-b border-outline-variant/10 flex items-center justify-between bg-black/20">
        <span className="text-[11px] font-bold uppercase tracking-wider text-outline flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]" style={{ color: ok ? "#2dd4bf" : "#f87171", fontVariationSettings: "'FILL' 1" }}>
            {ok ? "memory" : "error"}
          </span>
          Strategy Parsed
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
          style={{ background: ok ? "rgba(20,184,166,0.12)" : "rgba(239,68,68,0.12)", color: ok ? "#2dd4bf" : "#f87171" }}
        >
          {armedLabel ?? (ok ? "Executed" : "Rejected")}
        </span>
      </div>
      <div className="p-5 text-[14px]">
        <p className="text-on-surface-variant mb-3 leading-relaxed">
          Understood: <span className="font-semibold text-on-surface">{intent.summary}</span>
        </p>
        <p className={`font-semibold ${ok ? "text-[#2dd4bf]" : "text-[#f87171]"}`}>{message}</p>
        {outcome?.txid && (
          <a
            href={`https://explorer.hiro.so/txid/${outcome.txid}?chain=testnet`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold transition-colors"
            style={{ color: "#a78bfa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#8b5cf6"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a78bfa"; }}
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span> View on Hiro Explorer
          </a>
        )}
      </div>
    </div>
  );
}

function DcaCountdown({ nextRunAt }: { nextRunAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!nextRunAt) return <>—</>;
  const sec = Math.max(0, Math.round((nextRunAt - now) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className="flex items-center gap-1">
      {m}
      <span className="text-[14px] text-outline/60 font-normal">m</span> {String(s).padStart(2, "0")}
      <span className="text-[14px] text-outline/60 font-normal">s</span>
    </span>
  );
}

export default AgentControls;
