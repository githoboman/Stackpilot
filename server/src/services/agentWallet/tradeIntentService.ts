import { getTradeIntentParser, type TradeIntent } from "./tradeIntentParser.js";
import { getSwapAgent } from "./swapAgent.js";
import { executePercentageSwap, scheduleSwap, estimateBurnHeightAt } from "./strategies.js";
import { startAutoDca } from "./autoDca.js";
import { getAgentWalletStore } from "./store.js";
import type { AgentWalletRecord } from "./types.js";
import type { SwapOutcome } from "./swapAgent.js";
import { toMicro, canonicalAsset } from "./stacksConfig.js";

/**
 * The agentic entrypoint: take a natural-language instruction, parse it into a
 * structured intent, validate it has what it needs, and route it to the right
 * policy-guarded executor. This is what turns the system from "a DeFi tool with
 * limits" into "an autonomous agent you instruct in plain language."
 *
 * Headline path: action="dca" -> startAutoDca (recurring STX -> sBTC).
 */
export interface IntentResult {
  ok: boolean;
  intent: TradeIntent;
  /** Human-readable outcome line for the UI. */
  message: string;
  /** Present when an action actually executed. */
  outcome?: SwapOutcome;
  /** Present for background actions (scheduled / dca) that are now armed. */
  armed?: "scheduled" | "dca";
}

export class TradeIntentService {
  /** Parse + route a natural-language instruction for an owner. */
  async handle(ownerAddress: string, message: string): Promise<IntentResult> {
    const intent = await getTradeIntentParser().parse(message);

    const wallet = await getAgentWalletStore().getByOwner(ownerAddress);
    if (!wallet) {
      return { ok: false, intent, message: "No agent wallet yet — initialize one first." };
    }
    if (!wallet.policyId) {
      return { ok: false, intent, message: "Agent isn't bound to a policy yet. Create a policy first." };
    }

    switch (intent.action) {
      case "market_swap":
        return this.marketSwap(wallet, intent);
      case "percentage_swap":
        return this.percentageSwap(wallet, intent);
      case "scheduled_swap":
        return this.scheduledSwap(wallet, intent);
      case "dca":
        return this.dca(wallet, intent);
      case "limit_order":
        return { ok: false, intent, message: "Limit orders aren't wired for the Bitflow demo — use a market swap or Auto-DCA." };
      case "conditional_swap":
        return { ok: false, intent, message: "Conditional orders need a price oracle; the demo focuses on Auto-DCA into sBTC." };
      case "cancel":
        return { ok: false, intent, message: "To stop the agent, revoke the policy or stop Auto-DCA from the DCA card." };
      default:
        return { ok: false, intent, message: `I couldn't read that as a trade. ${intent.summary}` };
    }
  }

  private resolvePair(intent: TradeIntent): { tokenIn: string; tokenOut: string } {
    return {
      tokenIn: canonicalAsset(intent.tokenIn || "STX"),
      tokenOut: canonicalAsset(intent.tokenOut || "sBTC"),
    };
  }

  private async marketSwap(wallet: AgentWalletRecord, intent: TradeIntent): Promise<IntentResult> {
    const { tokenIn, tokenOut } = this.resolvePair(intent);
    if (intent.amount == null) return { ok: false, intent, message: "How much should I swap? No amount given." };
    const outcome = await getSwapAgent().execute({
      wallet, tokenIn, tokenOut, amount: toMicro(intent.amount, tokenIn),
    });
    return {
      ok: outcome.ok, intent, outcome,
      message: outcome.ok ? `Swapped ${intent.amount} ${tokenIn} → ${tokenOut}.` : (outcome.reason || "Swap rejected."),
    };
  }

  private async percentageSwap(wallet: AgentWalletRecord, intent: TradeIntent): Promise<IntentResult> {
    const { tokenIn, tokenOut } = this.resolvePair(intent);
    if (intent.percentage == null) return { ok: false, intent, message: "What percentage should I swap?" };
    const outcome = await executePercentageSwap({ wallet, tokenIn, tokenOut, percent: intent.percentage });
    return {
      ok: outcome.ok, intent, outcome,
      message: outcome.ok ? `Swapped ${intent.percentage}% of ${tokenIn} → ${tokenOut}.` : (outcome.reason || "Percentage swap rejected."),
    };
  }

  private async scheduledSwap(wallet: AgentWalletRecord, intent: TradeIntent): Promise<IntentResult> {
    const { tokenIn, tokenOut } = this.resolvePair(intent);
    if (intent.amount == null) return { ok: false, intent, message: "A scheduled swap needs an amount." };
    const atEpochMs = parseScheduleToEpoch(intent.schedule);
    if (!atEpochMs) return { ok: false, intent, message: `I couldn't read the time "${intent.schedule}".` };
    const executeAfterBurnHeight = await estimateBurnHeightAt(atEpochMs).catch(() => undefined);
    scheduleSwap({
      request: { wallet, tokenIn, tokenOut, amount: toMicro(intent.amount, tokenIn) },
      atEpochMs,
      executeAfterBurnHeight,
    });
    return {
      ok: true, intent, armed: "scheduled",
      message: `Scheduled: swap ${intent.amount} ${tokenIn} → ${tokenOut} at ${new Date(atEpochMs).toUTCString()}.`,
    };
  }

  private async dca(wallet: AgentWalletRecord, intent: TradeIntent): Promise<IntentResult> {
    const { tokenIn, tokenOut } = this.resolvePair(intent);
    if (intent.amount == null) return { ok: false, intent, message: "Auto-DCA needs a per-run amount (e.g. 'DCA 5 STX into sBTC every hour')." };
    const intervalMs = parseIntervalToMs(intent.interval);
    if (!intervalMs) return { ok: false, intent, message: `I couldn't read the interval "${intent.interval}".` };

    const state = startAutoDca(wallet.ownerAddress, {
      ownerAddress: wallet.ownerAddress,
      request: { wallet, tokenIn, tokenOut, amount: toMicro(intent.amount, tokenIn) },
      intervalMs,
      maxRuns: Number(process.env.DCA_MAX_RUNS || 24),
    });
    return {
      ok: true, intent, armed: "dca",
      message: `Auto-DCA armed: ${intent.amount} ${tokenIn} → ${tokenOut} ${intent.interval}. First run firing now (${state.maxRuns} max runs).`,
    };
  }
}

/** Parse a schedule phrase into an absolute epoch ms. */
function parseScheduleToEpoch(schedule?: string): number | null {
  if (!schedule) return null;
  const s = schedule.trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return iso;
  const rel = s.match(/in\s+(\d+)\s*(min|minute|minutes|hour|hours)/i);
  if (rel) {
    const n = Number(rel[1]);
    return Date.now() + n * (/hour/i.test(rel[2]) ? 3_600_000 : 60_000);
  }
  const hm = s.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(hm[1]), Number(hm[2]), 0));
    if (target.getTime() <= Date.now()) target.setUTCDate(target.getUTCDate() + 1);
    return target.getTime();
  }
  return null;
}

/** Parse an interval phrase ("every hour", "daily", "every 30 minutes") into ms. */
export function parseIntervalToMs(interval?: string): number | null {
  if (!interval) return null;
  const s = interval.trim().toLowerCase();
  if (/hourly/.test(s)) return 3_600_000;
  if (/daily/.test(s)) return 86_400_000;
  if (/weekly/.test(s)) return 604_800_000;
  const m = s.match(/every\s+(\d+)?\s*(min|minute|minutes|hour|hours|day|days|week|weeks)/);
  if (m) {
    const n = m[1] ? Number(m[1]) : 1;
    const unit = m[2];
    const base = /week/.test(unit) ? 604_800_000 : /day/.test(unit) ? 86_400_000 : /hour/.test(unit) ? 3_600_000 : 60_000;
    return n * base;
  }
  return null;
}

let instance: TradeIntentService | null = null;
export function getTradeIntentService(): TradeIntentService {
  if (!instance) instance = new TradeIntentService();
  return instance;
}
