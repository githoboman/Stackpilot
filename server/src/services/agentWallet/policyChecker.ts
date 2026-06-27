import { Cl, cvToJSON, hexToCV } from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME, HIRO_API, requireContract } from "./stacksConfig.js";
import { AgentActionType } from "./types.js";

/**
 * Off-chain mirror of the on-chain Clarity AgentPolicy map. Field names track the
 * Clarity tuple, decoded via the Hiro call-read-only API. This is an OPTIMIZATION:
 * obviously-invalid intents are rejected before a contract call is broadcast. The
 * Clarity record-spend remains the authoritative guarantee; the two stay in lockstep.
 */
export interface OnChainPolicy {
  policyId: string;
  owner: string;
  agentAddress: string;
  budgetCap: bigint;
  budgetSpent: bigint;
  allowedProtocols: string[];
  allowedAssets: string[];
  allowedActions: number[];
  /** burn-block-height at/after which the policy is expired (NOT epoch ms). */
  expiryBurnHeight: bigint;
  isActive: boolean;
  revoked: boolean;
  createdAt: bigint;
}

export interface PreflightInput {
  actionType: AgentActionType;
  /** Spend amount in the budget's base units. */
  amount: bigint;
  /** Canonical protocol id string (must match an allowed-protocols entry). */
  protocol: string;
  /** Canonical asset symbol string (must match an allowed-assets entry). */
  asset: string;
}

export type PreflightResult =
  | { ok: true; policy: OnChainPolicy }
  | { ok: false; reason: string; policy?: OnChainPolicy };

export class PolicyChecker {
  /** Current burn-block height from the Hiro chain tip. */
  async currentBurnHeight(): Promise<bigint> {
    const r = await fetch(`${HIRO_API}/extended/v1/block?limit=1`);
    const j: any = await r.json();
    const h = j?.results?.[0]?.burn_block_height;
    if (typeof h !== "number") throw new Error("Could not read burn-block height from Hiro");
    return BigInt(h);
  }

  /** Fetch + decode the Clarity policy tuple via call-read-only. Null if not found. */
  async readPolicy(policyId: string): Promise<OnChainPolicy | null> {
    const { address, name } = requireContract();
    const body = {
      sender: address,
      arguments: [Cl.serialize(Cl.uint(Number(policyId)))],
    };
    const r = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${address}/${name}/get-policy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const j: any = await r.json();
    if (!j?.okay || !j?.result) return null;

    // get-policy returns (optional {tuple}). cvToJSON nests as value.value.<field>.value.
    const decoded = cvToJSON(hexToCV(j.result));
    const t = decoded?.value?.value;
    if (!t) return null;

    return {
      policyId,
      owner: t.owner.value,
      agentAddress: t.agent.value,
      budgetCap: BigInt(t["budget-cap"].value),
      budgetSpent: BigInt(t["budget-spent"].value),
      allowedProtocols: (t["allowed-protocols"].value ?? []).map((x: any) => x.value),
      allowedAssets: (t["allowed-assets"].value ?? []).map((x: any) => x.value),
      allowedActions: (t["allowed-actions"].value ?? []).map((x: any) => Number(x.value)),
      expiryBurnHeight: BigInt(t["expiry-burn-height"].value),
      isActive: Boolean(t.active.value),
      revoked: Boolean(t.revoked.value),
      createdAt: BigInt(t["created-at"].value),
    };
  }

  /**
   * Run the full pre-flight against the live on-chain policy. nowBurnHeight lets
   * callers inject the chain tip for testing; defaults to a fresh Hiro lookup so the
   * expiry check uses the same clock the contract does (burn-block-height).
   */
  async preflight(
    policyId: string,
    input: PreflightInput,
    nowBurnHeight?: bigint,
  ): Promise<PreflightResult> {
    const policy = await this.readPolicy(policyId);
    if (!policy) return { ok: false, reason: "Policy not found on-chain" };

    if (policy.revoked) {
      return { ok: false, reason: "Policy is revoked (hard stop)", policy };
    }
    if (!policy.isActive) {
      return { ok: false, reason: "Policy is paused (active=false)", policy };
    }

    const now = nowBurnHeight ?? (await this.currentBurnHeight());
    if (now >= policy.expiryBurnHeight) {
      return { ok: false, reason: "Policy has expired", policy };
    }
    if (!policy.allowedActions.includes(input.actionType)) {
      return { ok: false, reason: `Action ${AgentActionType[input.actionType]} not permitted by policy`, policy };
    }
    if (!policy.allowedProtocols.includes(input.protocol)) {
      return { ok: false, reason: `Protocol ${input.protocol} not whitelisted`, policy };
    }
    const movesValue =
      input.actionType === AgentActionType.Swap ||
      input.actionType === AgentActionType.LimitOrder;
    if (movesValue && !policy.allowedAssets.includes(input.asset)) {
      return { ok: false, reason: `Asset ${input.asset} not whitelisted`, policy };
    }
    if (policy.budgetSpent + input.amount > policy.budgetCap) {
      const remaining = policy.budgetCap - policy.budgetSpent;
      return {
        ok: false,
        reason: `Budget exceeded: needs ${input.amount}, only ${remaining} remaining of ${policy.budgetCap}`,
        policy,
      };
    }

    return { ok: true, policy };
  }
}

let instance: PolicyChecker | null = null;
export function getPolicyChecker(): PolicyChecker {
  if (!instance) instance = new PolicyChecker();
  return instance;
}

// Re-export for callers that referenced the contract identity via this module.
export { CONTRACT_ADDRESS, CONTRACT_NAME };
