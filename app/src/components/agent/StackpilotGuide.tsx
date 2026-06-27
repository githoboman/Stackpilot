import { FiShield, FiClock, FiList, FiDroplet, FiZap } from "react-icons/fi";

/**
 * Single source of truth for the "how Stackpilot works" explainer — the policy
 * settings (with real STX amounts/limits) and every agent task. Rendered in two
 * places: an expandable section on the landing page (variant="dark") and a help
 * popup inside the dashboard (variant="app"). Content matches the actual policy
 * fields (budget/assets/expiry/gas) and intent actions (TradeIntentSchema).
 */

export interface PolicyField {
  name: string;
  what: string;
  detail: string;
  example: string;
}

export const POLICY_FIELDS: PolicyField[] = [
  {
    name: "Budget Cap",
    what: "The most the agent can ever spend, total.",
    detail:
      "Denominated in micro-STX (STX has 6 decimals, so 1 STX = 1,000,000). The Clarity contract sums every swap's spend and aborts any action that would push past this cap — it cannot be exceeded, even by a compromised server key.",
    example: "50 STX → 50000000",
  },
  {
    name: "Allowed Tokens",
    what: "The only assets the agent may touch.",
    detail:
      "A whitelist (e.g. STX, sBTC). Any token not on this list is blocked on-chain — the agent literally cannot trade it, regardless of what it's instructed.",
    example: "STX, sBTC",
  },
  {
    name: "Allowed Protocol",
    what: "The only venue the agent may trade on.",
    detail:
      "Restricted to the Bitflow AMM. The Clarity policy checks the protocol id on every action; anything else aborts.",
    example: "bitflow-amm",
  },
  {
    name: "Expiry",
    what: "When the delegation automatically ends.",
    detail:
      "The policy is time-gated by the Stacks burn-block height (Bitcoin anchor). After the expiry block the agent can no longer act — no manual revoke needed. A countdown shows in the header while active.",
    example: "~144 blocks (24h)",
  },
];

export interface AgentTask {
  icon: React.ReactNode;
  name: string;
  prompt: string;
  detail: string;
}

export const AGENT_TASKS: AgentTask[] = [
  {
    icon: <FiDroplet />,
    name: "Auto-DCA into Bitcoin",
    prompt: "“DCA 5 STX into sBTC every hour.”",
    detail: "Recurringly swaps STX → sBTC on a schedule, re-validating the on-chain policy each run and hard-stopping on revoke.",
  },
  {
    icon: <FiZap />,
    name: "Market Swap",
    prompt: "“Swap 10 STX to sBTC.”",
    detail: "Swaps a fixed amount immediately at the current Bitflow market price.",
  },
  {
    icon: <FiList />,
    name: "Percentage Swap",
    prompt: "“Swap 30% of my STX to sBTC.”",
    detail: "Computes a percentage of the agent's live STX balance, then swaps that amount at market.",
  },
  {
    icon: <FiClock />,
    name: "Scheduled Swap",
    prompt: "“Swap 5 STX to sBTC at 15:00 UTC.”",
    detail: "Fires at a target time. An on-chain burn-height gate enforces ‘not before’, so it can't run early.",
  },
  {
    icon: <FiShield />,
    name: "Revoke",
    prompt: "“Revoke the agent.”",
    detail: "Flips the policy's revoked flag on-chain — the agent's next action aborts with ERR-REVOKED.",
  },
];

export function StackpilotGuide({ variant = "app" }: { variant?: "app" | "dark" }) {
  const dark = variant === "dark";
  const card = dark
    ? "bg-white/[0.03] border-white/10"
    : "bg-surface-3 border-line";
  const heading = dark ? "text-white" : "text-ink";
  const sub = dark ? "text-white/50" : "text-muted";
  const body = dark ? "text-white/70" : "text-ink/80";
  const mono = dark ? "text-[#FF9472]" : "text-brand";
  const sectionLabel = dark ? "text-white/40" : "text-faint";

  return (
    <div className="space-y-8 text-left">
      {/* Step overview */}
      <div>
        <p className={`text-[12px] font-bold uppercase tracking-wider mb-3 ${sectionLabel}`}>
          The flow
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { n: "1", t: "Set a policy", d: "Define budget, tokens, expiry. Sign once — this is your only approval." },
            { n: "2", t: "Instruct in words", d: "Tell the agent what to do in plain language. It parses and checks your policy." },
            { n: "3", t: "It acts on-chain", d: "Real Bitflow trades execute. Revoke any time and it stops instantly." },
          ].map((s) => (
            <div key={s.n} className={`rounded-2xl border p-4 ${card}`}>
              <div className={`w-6 h-6 rounded-full text-[12px] font-bold flex items-center justify-center mb-2 ${dark ? "bg-[#FF6A4D]/15 text-[#FF9472]" : "bg-brand/15 text-brand"}`}>
                {s.n}
              </div>
              <div className={`text-[13px] font-semibold mb-0.5 ${heading}`}>{s.t}</div>
              <div className={`text-[12px] leading-snug ${sub}`}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Policy settings */}
      <div>
        <p className={`text-[12px] font-bold uppercase tracking-wider mb-3 ${sectionLabel}`}>
          Your policy — the on-chain rules
        </p>
        <div className="space-y-2.5">
          {POLICY_FIELDS.map((f) => (
            <div key={f.name} className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className={`text-[14px] font-bold ${heading}`}>{f.name}</span>
                <span className={`text-[11px] font-mono font-bold ${mono}`}>{f.example}</span>
              </div>
              <div className={`text-[13px] font-medium mb-1 ${heading} opacity-90`}>{f.what}</div>
              <div className={`text-[12px] leading-relaxed ${sub}`}>{f.detail}</div>
            </div>
          ))}
        </div>
        <p className={`text-[12px] leading-relaxed mt-3 ${body}`}>
          <span className="font-semibold">How much STX do I need?</span> The agent is its own
          on-chain wallet, so fund it with a little STX for fees (a few STX is plenty for a demo).
          Your <span className="font-semibold">Budget Cap</span> is the spending limit; the demo
          defaults to 50 STX so swaps fit comfortably.
        </p>
      </div>

      {/* Agent tasks */}
      <div>
        <p className={`text-[12px] font-bold uppercase tracking-wider mb-3 ${sectionLabel}`}>
          What you can ask the agent to do
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {AGENT_TASKS.map((t) => (
            <div key={t.name} className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[15px] ${mono}`}>{t.icon}</span>
                <span className={`text-[14px] font-bold ${heading}`}>{t.name}</span>
              </div>
              <div className={`text-[12.5px] font-medium mb-1 ${heading} opacity-90`}>{t.prompt}</div>
              <div className={`text-[12px] leading-relaxed ${sub}`}>{t.detail}</div>
            </div>
          ))}
        </div>
        <p className={`text-[12px] leading-relaxed mt-3 ${body}`}>
          Every one of these is checked against your policy <span className="font-semibold">on-chain before it runs</span> —
          budget, token whitelist, and expiry. If a request violates the policy, the contract aborts it.
        </p>
      </div>
    </div>
  );
}
