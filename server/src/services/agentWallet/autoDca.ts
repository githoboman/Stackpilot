import { getSwapAgent, type SwapRequest, type SwapOutcome } from "./swapAgent.js";
import { getAgentAlerts } from "./alerts.js";

/**
 * Auto-DCA — the headline feature. Recurringly swaps STX -> sBTC on a fixed
 * interval, re-validating the on-chain Clarity policy every run (swapAgent.execute
 * does preflight + the authoritative record-spend), so it hard-stops the moment the
 * policy is revoked / expired / out of budget.
 *
 * One active DCA per key (the owner address). Run history is kept in memory and
 * surfaced via dcaStatus() for the frontend's run-history list + next-run countdown.
 */
export interface DcaConfig {
  request: Omit<SwapRequest, "executeAfterBurnHeight">;
  intervalMs: number; // e.g. 3_600_000 = hourly
  maxRuns: number; // safety cap
  /** Owner address, for alerts + status. */
  ownerAddress: string;
}

export interface DcaRun {
  n: number;
  at: number; // epoch ms
  ok: boolean;
  txid?: string;
  reason?: string;
}

export interface DcaState {
  active: boolean;
  runs: number;
  maxRuns: number;
  intervalMs: number;
  nextRunAt: number | null;
  history: DcaRun[];
  tokenIn: string;
  tokenOut: string;
  amount: string;
  stoppedReason?: string;
}

interface DcaHandle {
  cancel: () => void;
  state: DcaState;
}

const active = new Map<string, DcaHandle>();

/** Regex for outcomes that mean the agent was hard-stopped on-chain. */
const HARD_STOP = /revoke|expire|budget|inactive|paused|u12|u4|u3|u2/i;

export function startAutoDca(key: string, cfg: DcaConfig): DcaState {
  // Replace any existing DCA for this key.
  stopAutoDca(key);

  const state: DcaState = {
    active: true,
    runs: 0,
    maxRuns: cfg.maxRuns,
    intervalMs: cfg.intervalMs,
    nextRunAt: Date.now(),
    history: [],
    tokenIn: cfg.request.tokenIn,
    tokenOut: cfg.request.tokenOut,
    amount: cfg.request.amount.toString(),
  };

  let timer: ReturnType<typeof setInterval> | null = null;

  const finish = (reason: string) => {
    if (timer) clearInterval(timer);
    timer = null;
    state.active = false;
    state.nextRunAt = null;
    state.stoppedReason = reason;
  };

  const tick = async () => {
    if (!state.active) return;
    if (state.runs >= cfg.maxRuns) {
      finish("Reached max runs");
      return;
    }
    state.runs += 1;
    const n = state.runs;

    let outcome: SwapOutcome;
    try {
      outcome = await getSwapAgent().execute({ ...cfg.request });
    } catch (err: any) {
      outcome = { ok: false, reason: err?.message || String(err) };
    }

    const run: DcaRun = { n, at: Date.now(), ok: outcome.ok, txid: outcome.txid, reason: outcome.reason };
    state.history.unshift(run);
    if (state.history.length > 50) state.history.length = 50;

    if (outcome.ok) {
      getAgentAlerts().actionSucceeded(
        cfg.ownerAddress,
        `Auto-DCA run ${n}`,
        `Swapped ${state.amount} ${state.tokenIn} -> ${state.tokenOut}`,
        { txid: outcome.txid, run: n },
      );
    } else {
      getAgentAlerts().actionFailed(cfg.ownerAddress, `Auto-DCA run ${n} failed: ${outcome.reason ?? "unknown"}`, { run: n });
      // Stop early if the agent was hard-stopped on-chain (revoked / expired / budget).
      if (HARD_STOP.test(outcome.reason ?? "")) {
        finish(`Stopped: ${outcome.reason}`);
        return;
      }
    }

    if (state.runs >= cfg.maxRuns) {
      finish("Reached max runs");
      return;
    }
    state.nextRunAt = Date.now() + cfg.intervalMs;
  };

  timer = setInterval(tick, cfg.intervalMs);
  (timer as any).unref?.();
  active.set(key, { cancel: () => finish("Cancelled by owner"), state });

  // Fire the first run immediately (does not wait a full interval).
  void tick();

  return state;
}

export function stopAutoDca(key: string): boolean {
  const h = active.get(key);
  if (!h) return false;
  h.cancel();
  active.delete(key);
  return true;
}

export function dcaStatus(key: string): DcaState | null {
  return active.get(key)?.state ?? null;
}
