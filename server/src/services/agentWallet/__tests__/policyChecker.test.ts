import { describe, it, expect, vi, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// The checker reads the Clarity policy via the Hiro call-read-only HTTP API, so we
// stub global fetch to return a serialized (some (tuple ...)) for get-policy.
vi.mock("../stacksConfig.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    CONTRACT_ADDRESS: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    CONTRACT_NAME: "agent-policy",
    HIRO_API: "https://api.testnet.hiro.so",
    requireContract: () => ({ address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", name: "agent-policy" }),
  };
});

import { getPolicyChecker } from "../policyChecker.js";
import { AgentActionType } from "../types.js";

const PROTOCOL = "bitflow-amm";
const OWNER = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const AGENT = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";
const NOW = 1000n; // burn height well before the default expiry

/** Serialize a get-policy (some {tuple}) response the way the contract would. */
function policyResult(overrides: Partial<Record<string, any>> = {}) {
  const f = {
    cap: 500n,
    spent: 0n,
    protocols: [PROTOCOL],
    assets: ["STX", "sBTC"],
    actions: [0, 1, 2],
    expiry: 1_000_000n,
    active: true,
    revoked: false,
    ...overrides,
  };
  const tuple = Cl.tuple({
    owner: Cl.principal(OWNER),
    agent: Cl.principal(AGENT),
    "budget-cap": Cl.uint(f.cap),
    "budget-spent": Cl.uint(f.spent),
    "allowed-protocols": Cl.list(f.protocols.map((p: string) => Cl.stringAscii(p))),
    "allowed-assets": Cl.list(f.assets.map((a: string) => Cl.stringAscii(a))),
    "allowed-actions": Cl.list(f.actions.map((a: number) => Cl.uint(a))),
    "expiry-burn-height": Cl.uint(f.expiry),
    active: Cl.bool(f.active),
    revoked: Cl.bool(f.revoked),
    "created-at": Cl.uint(0),
  });
  return { okay: true, result: Cl.serialize(Cl.some(tuple)) };
}

function stubFetch(result: any) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => result })) as any);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("PolicyChecker.preflight (Clarity)", () => {
  it("passes a valid in-scope swap within budget", async () => {
    stubFetch(policyResult());
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects when policy is missing", async () => {
    stubFetch({ okay: true, result: Cl.serialize(Cl.none()) });
    const r = await getPolicyChecker().preflight(
      "9",
      { actionType: AgentActionType.Swap, amount: 1n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found/i);
  });

  it("rejects a revoked policy", async () => {
    stubFetch(policyResult({ revoked: true }));
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/revoked/i);
  });

  it("rejects a paused (inactive) policy", async () => {
    stubFetch(policyResult({ active: false }));
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/paused/i);
  });

  it("rejects an expired policy", async () => {
    stubFetch(policyResult({ expiry: NOW - 1n }));
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/expired/i);
  });

  it("rejects a non-whitelisted protocol", async () => {
    stubFetch(policyResult());
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: "evil-amm", asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/protocol/i);
  });

  it("rejects a non-whitelisted asset for value-moving actions", async () => {
    stubFetch(policyResult());
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.LimitOrder, amount: 100n, protocol: PROTOCOL, asset: "ETH" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/asset/i);
  });

  it("does NOT enforce asset scope on a cancel", async () => {
    stubFetch(policyResult());
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Cancel, amount: 0n, protocol: PROTOCOL, asset: "ETH" },
      NOW,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a disallowed action type", async () => {
    stubFetch(policyResult({ actions: [2] })); // cancel only
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not permitted/i);
  });

  it("rejects when spend would exceed remaining budget", async () => {
    stubFetch(policyResult({ cap: 500n, spent: 450n }));
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/budget/i);
  });

  it("allows spend exactly at the cap boundary", async () => {
    stubFetch(policyResult({ cap: 500n, spent: 400n }));
    const r = await getPolicyChecker().preflight(
      "1",
      { actionType: AgentActionType.Swap, amount: 100n, protocol: PROTOCOL, asset: "STX" },
      NOW,
    );
    expect(r.ok).toBe(true);
  });
});
