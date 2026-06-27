import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getAgentWalletInitializer } from "../services/agentWallet/init";
import { getAgentWalletStore } from "../services/agentWallet/store";
import { getSwapAgent } from "../services/agentWallet/swapAgent";
import { getPolicyChecker } from "../services/agentWallet/policyChecker";
import { getAgentAlerts } from "../services/agentWallet/alerts";
import { buildCreatePolicyCall } from "../services/agentWallet/owner/policyCreator";
import { buildPauseCall, buildResumeCall } from "../services/agentWallet/owner/pauseResume";
import { buildRevokeCall, clearLocalState } from "../services/agentWallet/owner/revocation";
import { getTradeIntentService } from "../services/agentWallet/tradeIntentService";
import { startAutoDca, stopAutoDca, dcaStatus } from "../services/agentWallet/autoDca";
import { toMicro, canonicalAsset, CONTRACT_ADDRESS } from "../services/agentWallet/stacksConfig";
import { AgentActionType } from "../services/agentWallet/types";

const router = Router();

const ok = (res: Response, data: unknown, message = "OK") =>
  res.json({ status: true, message, data });

const fail = (res: Response, code: number, detail: string) =>
  res.status(code).json({ status: false, message: detail, data: null, errors: [{ code: "AGENT_WALLET_ERROR", detail }] });

// ── Wallet lifecycle ──────────────────────────────────────────────────

/** POST /api/agent/wallet/init — get-or-create the agent wallet for the owner. */
router.post("/agent/wallet/init", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletInitializer().getOrCreate(owner);
    return ok(res, {
      agentAddress: wallet.agentAddress,
      policyId: wallet.policyId,
      bound: Boolean(wallet.policyId),
    });
  } catch (e: any) {
    return fail(res, 500, e?.message || "init failed");
  }
});

/** GET /api/agent/wallet — current agent wallet status for the owner. */
router.get("/agent/wallet", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await getAgentWalletStore().getByOwner(req.user!.wallet_address);
    if (!wallet) return ok(res, null, "No agent wallet yet");
    return ok(res, {
      agentAddress: wallet.agentAddress,
      policyId: wallet.policyId,
      bound: Boolean(wallet.policyId),
    });
  } catch (e: any) {
    return fail(res, 500, e?.message || "lookup failed");
  }
});

/**
 * GET /api/agent/policy — the live on-chain Clarity policy state for the owner's
 * bound policy: budget cap/spent, whitelists, expiry (burn height), active/revoked.
 * Powers the policy drawer. bigints are serialized as strings.
 */
router.get("/agent/policy", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await getAgentWalletStore().getByOwner(req.user!.wallet_address);
    if (!wallet?.policyId) return ok(res, null, "No bound policy");

    const policy = await getPolicyChecker().readPolicy(wallet.policyId);
    if (!policy) return ok(res, null, "Policy not found on-chain");

    const cap = policy.budgetCap;
    const spent = policy.budgetSpent;
    const remaining = cap > spent ? cap - spent : 0n;
    const usedPct = cap > 0n ? Number((spent * 10000n) / cap) / 100 : 0;

    let currentBurnHeight: string | null = null;
    try {
      currentBurnHeight = (await getPolicyChecker().currentBurnHeight()).toString();
    } catch {
      /* best-effort */
    }

    return ok(res, {
      policyId: policy.policyId,
      budgetCap: cap.toString(),
      budgetSpent: spent.toString(),
      budgetRemaining: remaining.toString(),
      usedPercent: usedPct,
      allowedAssets: policy.allowedAssets,
      allowedProtocols: policy.allowedProtocols,
      allowedActions: policy.allowedActions,
      expiryBurnHeight: policy.expiryBurnHeight.toString(),
      currentBurnHeight,
      isActive: policy.isActive,
      revoked: policy.revoked,
    });
  } catch (e: any) {
    return fail(res, 500, e?.message || "policy read failed");
  }
});

// ── Owner controls (return Clarity call descriptors to sign with @stacks/connect) ──

/**
 * POST /api/agent/policy/create-call — build the create-policy Clarity call for the
 * owner to sign. Body: { budgetCap (micro-STX string|number), allowedAssets[],
 * allowedActions?, expiryBlocks? }. expiryBlocks is added to the current burn height.
 */
router.post("/agent/policy/create-call", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletInitializer().getOrCreate(owner);
    const { budgetCap, allowedAssets, allowedActions, expiryBlocks } = req.body ?? {};
    if (budgetCap == null || !Array.isArray(allowedAssets)) {
      return fail(res, 400, "budgetCap and allowedAssets[] are required");
    }
    if (!CONTRACT_ADDRESS) {
      return fail(res, 503, "The agent-policy contract isn't deployed yet (STACKS_CONTRACT unset). Deploy it to testnet, then set STACKS_CONTRACT in server/.env.");
    }

    const now = await getPolicyChecker().currentBurnHeight();
    const expiryBurnHeight = Number(now) + Number(expiryBlocks ?? 144); // ~24h at 10min/block

    const call = buildCreatePolicyCall({
      agentAddress: wallet.agentAddress,
      budgetCap: BigInt(budgetCap),
      allowedAssets,
      allowedActions: allowedActions as AgentActionType[] | undefined,
      expiryBurnHeight,
    });

    return ok(res, { call, agentAddress: wallet.agentAddress, expiryBurnHeight });
  } catch (e: any) {
    return fail(res, 500, e?.message || "create-call failed");
  }
});

/**
 * POST /api/agent/policy/bind — after the owner signs+confirms create-policy, the
 * frontend reads the new policy id (the contract's nonce) and posts it here to bind
 * it to the agent wallet. Body: { policyId }.
 */
router.post("/agent/policy/bind", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletStore().getByOwner(owner);
    if (!wallet) return fail(res, 404, "No agent wallet to bind");

    const policyId = String(req.body?.policyId ?? "").trim();
    if (!policyId || !/^\d+$/.test(policyId)) {
      return fail(res, 400, "A numeric policyId is required");
    }

    // Verify the policy exists on-chain and authorizes THIS agent before binding.
    const onchain = await getPolicyChecker().readPolicy(policyId);
    if (!onchain) return fail(res, 404, `Policy ${policyId} not found on-chain`);
    if (onchain.agentAddress !== wallet.agentAddress) {
      return fail(res, 409, "On-chain policy authorizes a different agent address");
    }

    const bound = await getAgentWalletInitializer().bindToPolicy(wallet.agentAddress, policyId);
    return ok(res, { policyId: bound.policyId }, "Policy bound");
  } catch (e: any) {
    return fail(res, 500, e?.message || "bind failed");
  }
});

/** POST /api/agent/policy/pause-call — pause Clarity call descriptor. */
router.post("/agent/policy/pause-call", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await getAgentWalletStore().getByOwner(req.user!.wallet_address);
    if (!wallet?.policyId) return fail(res, 404, "No bound policy");
    return ok(res, { call: buildPauseCall(Number(wallet.policyId)) });
  } catch (e: any) {
    return fail(res, 500, e?.message || "pause-call failed");
  }
});

/** POST /api/agent/policy/resume-call — resume Clarity call descriptor. */
router.post("/agent/policy/resume-call", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await getAgentWalletStore().getByOwner(req.user!.wallet_address);
    if (!wallet?.policyId) return fail(res, 404, "No bound policy");
    return ok(res, { call: buildResumeCall(Number(wallet.policyId)) });
  } catch (e: any) {
    return fail(res, 500, e?.message || "resume-call failed");
  }
});

/**
 * POST /api/agent/policy/revoke-call — the headline hard stop. Returns the revoke
 * Clarity call for the owner to sign; also stops any running Auto-DCA and clears
 * local soft-budget state immediately. After the owner signs, the agent's next
 * record-spend aborts on-chain with ERR-REVOKED.
 */
router.post("/agent/policy/revoke-call", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletStore().getByOwner(owner);
    if (!wallet?.policyId) return fail(res, 404, "No bound policy");

    stopAutoDca(owner);
    clearLocalState(wallet.policyId);
    getAgentAlerts().revoked(owner, wallet.policyId);

    return ok(res, {
      call: buildRevokeCall(Number(wallet.policyId)),
      note: "Sign this with the owner wallet. The agent's next action will then abort on-chain (ERR-REVOKED).",
    });
  } catch (e: any) {
    return fail(res, 500, e?.message || "revoke-call failed");
  }
});

// ── Agentic entrypoint (natural language) ─────────────────────────────

/**
 * POST /api/agent/intent — the headline agentic endpoint. Plain-language
 * instruction ("DCA 5 STX into sBTC every hour", "swap 10 STX to sBTC") -> parsed
 * intent -> validated against policy -> executed or armed. Body: { message }.
 */
router.post("/agent/intent", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const { message } = req.body ?? {};
    if (!message) return fail(res, 400, "message is required");
    const result = await getTradeIntentService().handle(owner, String(message));
    return ok(res, result, result.message);
  } catch (e: any) {
    return fail(res, 500, e?.message || "intent failed");
  }
});

// ── Agent actions (executed server-side with the agent key) ───────────

/**
 * POST /api/agent/swap — execute a single Bitflow swap via the agent.
 * Body: { tokenIn, tokenOut, amount }. amount is in WHOLE tokens (e.g. 5 STX).
 */
router.post("/agent/swap", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletStore().getByOwner(owner);
    if (!wallet) return fail(res, 404, "No agent wallet");

    const { tokenIn, tokenOut, amount } = req.body ?? {};
    if (!tokenIn || !tokenOut || amount == null) {
      return fail(res, 400, "tokenIn, tokenOut, amount are required");
    }
    const inSym = canonicalAsset(String(tokenIn));

    const outcome = await getSwapAgent().execute({
      wallet,
      tokenIn: inSym,
      tokenOut: canonicalAsset(String(tokenOut)),
      amount: toMicro(Number(amount), inSym),
    });

    if (!outcome.ok) return fail(res, 422, outcome.reason || "swap rejected");
    return ok(res, outcome, "Action executed");
  } catch (e: any) {
    return fail(res, 500, e?.message || "swap failed");
  }
});

// ── Auto-DCA (headline feature) ───────────────────────────────────────

/**
 * POST /api/agent/dca/start — start a recurring Auto-DCA loop.
 * Body: { tokenIn?, tokenOut?, amount, intervalMs, maxRuns? }. amount is in WHOLE
 * tokens. Defaults: STX -> sBTC.
 */
router.post("/agent/dca/start", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.user!.wallet_address;
    const wallet = await getAgentWalletStore().getByOwner(owner);
    if (!wallet) return fail(res, 404, "No agent wallet");
    if (!wallet.policyId) return fail(res, 409, "Create a policy before starting Auto-DCA");

    const { tokenIn, tokenOut, amount, intervalMs, maxRuns } = req.body ?? {};
    if (amount == null || !intervalMs) {
      return fail(res, 400, "amount and intervalMs are required");
    }
    const inSym = canonicalAsset(String(tokenIn || "STX"));
    const outSym = canonicalAsset(String(tokenOut || "sBTC"));

    const state = startAutoDca(owner, {
      ownerAddress: owner,
      request: { wallet, tokenIn: inSym, tokenOut: outSym, amount: toMicro(Number(amount), inSym) },
      intervalMs: Number(intervalMs),
      maxRuns: Number(maxRuns ?? process.env.DCA_MAX_RUNS ?? 24),
    });
    return ok(res, state, "Auto-DCA started");
  } catch (e: any) {
    return fail(res, 500, e?.message || "dca start failed");
  }
});

/** POST /api/agent/dca/stop — stop the owner's Auto-DCA loop. */
router.post("/agent/dca/stop", requireAuth, async (req: AuthRequest, res: Response) => {
  const owner = req.user!.wallet_address;
  const stopped = stopAutoDca(owner);
  return ok(res, { stopped }, stopped ? "Auto-DCA stopped" : "No active Auto-DCA");
});

/** GET /api/agent/dca/status — current Auto-DCA state + run history. */
router.get("/agent/dca/status", requireAuth, async (req: AuthRequest, res: Response) => {
  const owner = req.user!.wallet_address;
  return ok(res, dcaStatus(owner));
});

// ── Alerts feed ───────────────────────────────────────────────────────

/** GET /api/agent/alerts?sinceId=... — newest-first in-app alerts for the owner. */
router.get("/agent/alerts", requireAuth, async (req: AuthRequest, res: Response) => {
  const owner = req.user!.wallet_address;
  const sinceId = req.query.sinceId as string | undefined;
  return ok(res, getAgentAlerts().list(owner, sinceId));
});

export default router;
