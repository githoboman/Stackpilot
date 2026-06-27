import { getSwapAgent, type SwapRequest, type SwapOutcome } from "./swapAgent.js";
import { getPolicyChecker } from "./policyChecker.js";
import { HIRO_API } from "./stacksConfig.js";
import type { AgentWalletRecord } from "./types.js";

/**
 * Higher-level strategy executors that resolve an intent into a concrete amount,
 * then delegate to the policy-guarded SwapAgent. Every strategy re-validates through
 * the agent at execution time, so a policy that expired or was revoked between
 * scheduling and firing is still enforced on-chain.
 *
 * Auto-DCA — the headline recurring strategy — lives in autoDca.ts. This module
 * covers percentage-of-balance and one-shot scheduled swaps.
 */

// --- Percentage-of-balance swaps -----------------------------------------

/** Fetch the agent's STX balance (micro-STX) from Hiro. */
async function agentStxBalance(agentAddress: string): Promise<bigint> {
  const r = await fetch(`${HIRO_API}/extended/v1/address/${agentAddress}/stx`);
  const j: any = await r.json();
  const bal = j?.balance;
  return bal != null ? BigInt(bal) : 0n;
}

/**
 * "swap 30% of my STX to sBTC" — resolve the percentage against the AGENT wallet's
 * STX balance (not the user's), then execute. percent is 0-100. sBTC->STX would
 * need an sBTC balance read; for the demo the percentage path is STX-denominated.
 */
export async function executePercentageSwap(args: {
  wallet: AgentWalletRecord;
  tokenIn: string;
  tokenOut: string;
  percent: number;
}): Promise<SwapOutcome> {
  if (args.percent <= 0 || args.percent > 100) {
    return { ok: false, reason: `Invalid percent ${args.percent}` };
  }
  const total = await agentStxBalance(args.wallet.agentAddress);
  const amount = (total * BigInt(Math.round(args.percent * 100))) / 10_000n;
  if (amount <= 0n) {
    return { ok: false, reason: `Computed amount is zero (agent STX balance ${total})` };
  }
  return getSwapAgent().execute({
    wallet: args.wallet,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
    amount,
  });
}

// --- Scheduled (one-shot) swaps ------------------------------------------

export interface ScheduleHandle {
  cancel: () => void;
  firesAt: number;
}

/**
 * "swap at 3pm UTC" — fire a swap at a target time. Uses a backend timer; at trigger
 * time the SwapAgent re-validates the policy AND the on-chain record-spend-after gate
 * enforces a burn-height "not before", so the chain — not the setTimeout — is the
 * authority on timing.
 */
export function scheduleSwap(args: {
  request: SwapRequest;
  atEpochMs: number;
  /** Optional burn-height gate enforced on-chain at execution. */
  executeAfterBurnHeight?: number;
  onResult?: (outcome: SwapOutcome) => void;
  onError?: (err: unknown) => void;
}): ScheduleHandle {
  const delay = Math.max(0, args.atEpochMs - Date.now());
  const request: SwapRequest = { ...args.request, executeAfterBurnHeight: args.executeAfterBurnHeight };
  const timer = setTimeout(async () => {
    try {
      const outcome = await getSwapAgent().execute(request);
      args.onResult?.(outcome);
    } catch (err) {
      args.onError?.(err);
    }
  }, delay);
  timer.unref?.();
  return { cancel: () => clearTimeout(timer), firesAt: args.atEpochMs };
}

/**
 * Estimate the burn-block height a future epoch corresponds to, for the on-chain
 * time gate. Stacks burn blocks (Bitcoin) average ~10 minutes; this is a coarse
 * estimate used only to set record-spend-after's gate, which itself just enforces a
 * lower bound.
 */
export async function estimateBurnHeightAt(atEpochMs: number): Promise<number> {
  const now = await getPolicyChecker().currentBurnHeight();
  const minutesAhead = Math.max(0, (atEpochMs - Date.now()) / 60_000);
  return Number(now) + Math.floor(minutesAhead / 10);
}
