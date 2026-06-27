import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

// Deeper edge-case coverage on top of agent-policy.test.ts: multi-policy isolation,
// exact-cap boundary, cancel asset-scope exemption, the read-only validate view,
// get-policy field integrity, view accuracy, and owner-control authorization.

const accounts = simnet.getAccounts();
const owner = accounts.get("deployer")!;
const agent = accounts.get("wallet_1")!;
const owner2 = accounts.get("wallet_2")!;
const agent2 = accounts.get("wallet_3")!;
const stranger = accounts.get("wallet_4")!;
const C = "agent-policy";

const PROTO = "bitflow-amm";

function create(
  signer: string,
  agentP: string,
  cap = 1000n,
  expiryOffset = 1000,
  assets = ["STX", "sBTC"],
  actions = [0, 1],
) {
  return simnet.callPublicFn(
    C,
    "create-policy",
    [
      Cl.principal(agentP),
      Cl.uint(cap),
      Cl.list([Cl.stringAscii(PROTO)]),
      Cl.list(assets.map((a) => Cl.stringAscii(a))),
      Cl.list(actions.map((a) => Cl.uint(a))),
      Cl.uint(simnet.burnBlockHeight + expiryOffset),
    ],
    signer,
  );
}

function spend(id: number, amount: number, opts: { asset?: string; action?: number; caller?: string } = {}) {
  return simnet.callPublicFn(
    C,
    "record-spend",
    [
      Cl.uint(id),
      Cl.uint(opts.action ?? 0),
      Cl.uint(amount),
      Cl.stringAscii(PROTO),
      Cl.stringAscii(opts.asset ?? "STX"),
    ],
    opts.caller ?? agent,
  );
}

describe("agent-policy — edge cases", () => {
  // ── Nonce / multi-policy isolation ──────────────────────────────────
  it("increments the policy id (nonce) per creation", () => {
    expect(create(owner, agent).result).toBeOk(Cl.uint(1));
    expect(create(owner2, agent2).result).toBeOk(Cl.uint(2));
    expect(simnet.callReadOnlyFn(C, "get-nonce", [], owner).result).toBeUint(2);
  });

  it("keeps two policies' budgets fully independent", () => {
    create(owner, agent, 1000n); // id 1
    create(owner2, agent2, 500n); // id 2
    expect(spend(1, 600).result).toBeOk(Cl.uint(600));
    // Policy 2's agent is unaffected by policy 1's spend.
    expect(spend(2, 400, { caller: agent2 }).result).toBeOk(Cl.uint(400));
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(1)], owner).result).toBeOk(Cl.uint(400));
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(2)], owner).result).toBeOk(Cl.uint(100));
  });

  it("policy 1's agent cannot act on policy 2", () => {
    create(owner, agent, 1000n); // id 1, agent
    create(owner2, agent2, 1000n); // id 2, agent2
    // agent (policy 1) tries to spend on policy 2 → ERR-NOT-AGENT.
    expect(spend(2, 100, { caller: agent }).result).toBeErr(Cl.uint(8));
  });

  // ── Budget boundary ─────────────────────────────────────────────────
  it("allows spend that exactly hits the cap, then blocks the next micro-spend", () => {
    create(owner, agent, 1000n);
    expect(spend(1, 1000).result).toBeOk(Cl.uint(1000));
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(1)], owner).result).toBeOk(Cl.uint(0));
    expect(spend(1, 1).result).toBeErr(Cl.uint(4)); // ERR-BUDGET-EXCEEDED
  });

  it("permits a zero-amount spend (no-op) while in scope", () => {
    create(owner, agent, 1000n);
    expect(spend(1, 0).result).toBeOk(Cl.uint(0));
  });

  // ── Asset-scope exemption for non-value actions ─────────────────────
  it("does NOT enforce asset scope for a cancel action (action=2)", () => {
    // action 2 (cancel) must be whitelisted, but its asset is not scope-checked.
    create(owner, agent, 1000n, 1000, ["STX", "sBTC"], [0, 1, 2]);
    expect(spend(1, 0, { action: 2, asset: "ETH" }).result).toBeOk(Cl.uint(0));
  });

  it("still rejects a cancel action when action 2 is not whitelisted", () => {
    create(owner, agent, 1000n, 1000, ["STX"], [0, 1]); // no action 2
    expect(spend(1, 0, { action: 2, asset: "STX" }).result).toBeErr(Cl.uint(7)); // ERR-ACTION-NOT-OK
  });

  // ── Read-only validate view ─────────────────────────────────────────
  it("validate (read-only) returns ok for an in-scope action without mutating state", () => {
    create(owner, agent, 1000n);
    const r = simnet.callReadOnlyFn(
      C,
      "validate",
      [Cl.uint(1), Cl.principal(agent), Cl.uint(0), Cl.uint(100), Cl.stringAscii(PROTO), Cl.stringAscii("STX")],
      owner,
    );
    expect(r.result).toBeOk(Cl.bool(true));
    // Budget is untouched by the read-only check.
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(1)], owner).result).toBeOk(Cl.uint(1000));
  });

  it("validate (read-only) returns the right error for an over-budget probe", () => {
    create(owner, agent, 100n);
    const r = simnet.callReadOnlyFn(
      C,
      "validate",
      [Cl.uint(1), Cl.principal(agent), Cl.uint(0), Cl.uint(200), Cl.stringAscii(PROTO), Cl.stringAscii("STX")],
      owner,
    );
    expect(r.result).toBeErr(Cl.uint(4)); // ERR-BUDGET-EXCEEDED
  });

  // ── get-policy field integrity ──────────────────────────────────────
  it("stores the policy fields exactly as created", () => {
    create(owner, agent, 777n);
    const p = simnet.callReadOnlyFn(C, "get-policy", [Cl.uint(1)], owner).result;
    expect(p).toBeSome(
      Cl.tuple({
        owner: Cl.principal(owner),
        agent: Cl.principal(agent),
        "budget-cap": Cl.uint(777),
        "budget-spent": Cl.uint(0),
        "allowed-protocols": Cl.list([Cl.stringAscii(PROTO)]),
        "allowed-assets": Cl.list([Cl.stringAscii("STX"), Cl.stringAscii("sBTC")]),
        "allowed-actions": Cl.list([Cl.uint(0), Cl.uint(1)]),
        "expiry-burn-height": Cl.uint(simnet.burnBlockHeight + 1000),
        active: Cl.bool(true),
        revoked: Cl.bool(false),
        "created-at": Cl.uint(simnet.burnBlockHeight),
      }),
    );
  });

  it("reflects accumulated spend in get-policy budget-spent", () => {
    create(owner, agent, 1000n);
    spend(1, 250);
    spend(1, 125);
    const p = simnet.callReadOnlyFn(C, "get-policy", [Cl.uint(1)], owner).result;
    // Just assert the spent field; full-tuple match is covered above.
    expect(p).toBeSome(
      Cl.tuple({
        owner: Cl.principal(owner),
        agent: Cl.principal(agent),
        "budget-cap": Cl.uint(1000),
        "budget-spent": Cl.uint(375),
        "allowed-protocols": Cl.list([Cl.stringAscii(PROTO)]),
        "allowed-assets": Cl.list([Cl.stringAscii("STX"), Cl.stringAscii("sBTC")]),
        "allowed-actions": Cl.list([Cl.uint(0), Cl.uint(1)]),
        "expiry-burn-height": Cl.uint(simnet.burnBlockHeight + 1000),
        active: Cl.bool(true),
        revoked: Cl.bool(false),
        "created-at": Cl.uint(simnet.burnBlockHeight),
      }),
    );
  });

  // ── Owner controls authorization ────────────────────────────────────
  it("a stranger cannot pause, resume, or revoke", () => {
    create(owner, agent);
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(1)], stranger).result).toBeErr(Cl.uint(1));
    expect(simnet.callPublicFn(C, "resume", [Cl.uint(1)], stranger).result).toBeErr(Cl.uint(1));
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(1)], stranger).result).toBeErr(Cl.uint(1));
  });

  it("the agent (not the owner) cannot pause its own policy", () => {
    create(owner, agent);
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(1)], agent).result).toBeErr(Cl.uint(1)); // ERR-NOT-OWNER
  });

  it("double-revoke is idempotent-safe (second revoke still owner-gated, stays revoked)", () => {
    create(owner, agent);
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
    // Re-revoking by owner is allowed and the agent stays hard-stopped.
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
    expect(spend(1, 1).result).toBeErr(Cl.uint(12)); // ERR-REVOKED
  });

  it("pausing twice keeps the policy inactive (no error path needed)", () => {
    create(owner, agent);
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
    expect(spend(1, 1).result).toBeErr(Cl.uint(2)); // ERR-INACTIVE
  });

  // ── Operations on a missing policy ──────────────────────────────────
  it("record-spend / pause / resume / revoke all error on a non-existent policy", () => {
    expect(spend(99, 1).result).toBeErr(Cl.uint(13)); // ERR-NOT-FOUND
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(99)], owner).result).toBeErr(Cl.uint(13));
    expect(simnet.callPublicFn(C, "resume", [Cl.uint(99)], owner).result).toBeErr(Cl.uint(13));
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(99)], owner).result).toBeErr(Cl.uint(13));
  });

  // ── is-expired view ─────────────────────────────────────────────────
  it("is-expired flips from false to true across the expiry burn height", () => {
    create(owner, agent, 1000n, 5); // expires 5 blocks out
    expect(simnet.callReadOnlyFn(C, "is-expired", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(false));
    simnet.mineEmptyBurnBlocks(6);
    expect(simnet.callReadOnlyFn(C, "is-expired", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
  });
});
