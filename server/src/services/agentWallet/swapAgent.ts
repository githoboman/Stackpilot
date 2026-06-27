import { randomUUID } from "crypto";
import { getPolicyChecker } from "./policyChecker.js";
import { getBudgetTracker } from "./budgetTracker.js";
import { callPolicy, recordSpendArgs, recordSpendAfterArgs } from "./contractCall.js";
import { quoteSwap } from "./bitflowAdapter.js";
import { PROTOCOL_ID, canonicalAsset } from "./stacksConfig.js";
import { getAgentAlerts } from "./alerts.js";
import { AgentActionType } from "./types.js";
import type { AgentWalletRecord } from "./types.js";

/**
 * The swap agent runs the guarded pipeline for a single Bitflow action on Stacks:
 *
 *   1. off-chain pre-flight (fast reject against the live Clarity policy)
 *   2. budget allocation (soft reservation)
 *   3. Bitflow quote (route + min-out sizing)
 *   4. AUTHORITATIVE on-chain step: record-spend re-validates EVERY constraint and
 *      aborts (ERR-REVOKED / ERR-BUDGET-EXCEEDED / ...) if violated. This is the
 *      guard the whole pitch rests on.
 *
 * Demo posture (build plan option A — sequenced): record-spend lands first; if it
 * aborts (revoked / over budget / expired), the Bitflow swap is never submitted. The
 * Bitflow swap call itself is the marked integration point in bitflowAdapter.ts.
 */
export interface SwapRequest {
  wallet: AgentWalletRecord;
  tokenIn: string; // "STX"
  tokenOut: string; // "sBTC"
  amount: bigint; // base units of tokenIn
  /** Optional time gate (burn-block height) for scheduled / DCA runs. */
  executeAfterBurnHeight?: number;
}

export interface SwapOutcome {
  ok: boolean;
  reason?: string;
  txid?: string;
  /** Expected output of the swap in base units of tokenOut (from the quote). */
  expectedOut?: string;
  /** True when the quote came from the live Bitflow SDK. */
  liveQuote?: boolean;
}

export class SwapAgent {
  async execute(req: SwapRequest): Promise<SwapOutcome> {
    const { wallet } = req;
    if (!wallet.policyId) return { ok: false, reason: "Agent wallet is not bound to a policy" };

    const tokenIn = canonicalAsset(req.tokenIn);
    const tokenOut = canonicalAsset(req.tokenOut);

    // 1. Off-chain pre-flight (fast reject).
    const pre = await getPolicyChecker().preflight(wallet.policyId, {
      actionType: AgentActionType.Swap,
      amount: req.amount,
      protocol: PROTOCOL_ID,
      asset: tokenIn,
    });
    if (!pre.ok) return { ok: false, reason: pre.reason };

    // 2. Soft budget allocation (released on settle/fail).
    const allocationId = randomUUID();
    const tracker = getBudgetTracker();
    if (!(await tracker.tryAllocate(wallet.policyId, allocationId, req.amount))) {
      return { ok: false, reason: "Insufficient available budget after pending allocations" };
    }

    try {
      // 3. Quote the Bitflow route (sizing / min-out).
      const quote = await quoteSwap({ tokenIn, tokenOut, amountIn: req.amount });

      // 4. Authoritative on-chain step: record-spend re-validates EVERY constraint.
      //    Time-gated variant when a burn-height gate is supplied (scheduled / DCA).
      const policyId = Number(wallet.policyId);
      const res = req.executeAfterBurnHeight
        ? await callPolicy(
            wallet,
            "record-spend-after",
            recordSpendAfterArgs(policyId, AgentActionType.Swap, req.amount, PROTOCOL_ID, tokenIn, req.executeAfterBurnHeight),
          )
        : await callPolicy(
            wallet,
            "record-spend",
            recordSpendArgs(policyId, AgentActionType.Swap, req.amount, PROTOCOL_ID, tokenIn),
          );

      if (!res.success) {
        // On-chain rejection (revoked / over budget / expired) or network error.
        tracker.release(wallet.policyId, allocationId);
        getAgentAlerts().actionFailed(wallet.ownerAddress, res.error ?? "Unknown error", {
          policyId: wallet.policyId,
          tokenIn,
          tokenOut,
        });
        return { ok: false, reason: res.error };
      }

      // 5. (Integration point) submit the Bitflow swap now that the guard passed.
      //    Sequenced demo: if step 4 had aborted, we never reach here. When the live
      //    SDK route is wired in bitflowAdapter.getRoute(), broadcast it here.

      tracker.release(wallet.policyId, allocationId);
      getAgentAlerts().actionSucceeded(
        wallet.ownerAddress,
        "Swap executed",
        `${req.amount} ${tokenIn} -> ${tokenOut}`,
        { txid: res.txid, expectedOut: quote.expectedOut.toString(), liveQuote: quote.live },
      );
      // Surface budget/expiry warnings after the spend lands.
      void getAgentAlerts().evaluatePolicy(wallet.ownerAddress, wallet.policyId);

      return {
        ok: true,
        txid: res.txid,
        expectedOut: quote.expectedOut.toString(),
        liveQuote: quote.live,
      };
    } catch (err: any) {
      tracker.release(wallet.policyId, allocationId);
      return { ok: false, reason: err?.message || String(err) };
    }
  }
}

let instance: SwapAgent | null = null;
export function getSwapAgent(): SwapAgent {
  if (!instance) instance = new SwapAgent();
  return instance;
}
