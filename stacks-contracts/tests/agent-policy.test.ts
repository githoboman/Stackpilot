import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

// `simnet` is injected globally by vitest-environment-clarinet.
const accounts = simnet.getAccounts();
const owner = accounts.get("deployer")!;
const agent = accounts.get("wallet_1")!;
const stranger = accounts.get("wallet_2")!;
const C = "agent-policy";

// Mirrors the spirit of the 17 Move tests (policy_tests.move + revocation_tests.move):
// budget enforcement, scope whitelists, owner-only controls, the revoke hard-stop,
// pause/resume gating, expiry, and the scheduled time-gate.

/** Create a standard policy and return the call result. */
function createPolicy(cap = 1000n, expiryOffset = 1000) {
  return simnet.callPublicFn(
    C,
    "create-policy",
    [
      Cl.principal(agent),
      Cl.uint(cap),
      Cl.list([Cl.stringAscii("bitflow-amm")]),
      Cl.list([Cl.stringAscii("STX"), Cl.stringAscii("sBTC")]),
      Cl.list([Cl.uint(0), Cl.uint(1)]),
      Cl.uint(simnet.burnBlockHeight + expiryOffset),
    ],
    owner,
  );
}

function recordSpend(amount: number, asset = "STX", action = 0, caller = agent) {
  return simnet.callPublicFn(
    C,
    "record-spend",
    [Cl.uint(1), Cl.uint(action), Cl.uint(amount), Cl.stringAscii("bitflow-amm"), Cl.stringAscii(asset)],
    caller,
  );
}

describe("agent-policy", () => {
  it("creates a policy and returns id 1", () => {
    expect(createPolicy().result).toBeOk(Cl.uint(1));
  });

  it("rejects a zero budget cap", () => {
    const r = simnet.callPublicFn(
      C,
      "create-policy",
      [
        Cl.principal(agent),
        Cl.uint(0),
        Cl.list([Cl.stringAscii("bitflow-amm")]),
        Cl.list([Cl.stringAscii("STX")]),
        Cl.list([Cl.uint(0)]),
        Cl.uint(simnet.burnBlockHeight + 1000),
      ],
      owner,
    );
    expect(r.result).toBeErr(Cl.uint(9)); // ERR-INVALID-BUDGET
  });

  it("rejects an expiry in the past", () => {
    const r = simnet.callPublicFn(
      C,
      "create-policy",
      [
        Cl.principal(agent),
        Cl.uint(1000),
        Cl.list([Cl.stringAscii("bitflow-amm")]),
        Cl.list([Cl.stringAscii("STX")]),
        Cl.list([Cl.uint(0)]),
        Cl.uint(simnet.burnBlockHeight), // not strictly greater than current
      ],
      owner,
    );
    expect(r.result).toBeErr(Cl.uint(10)); // ERR-INVALID-EXPIRY
  });

  it("agent can record spend within budget", () => {
    createPolicy();
    expect(recordSpend(400).result).toBeOk(Cl.uint(400));
  });

  it("accumulates spend across calls and updates remaining budget", () => {
    createPolicy(1000n);
    expect(recordSpend(400).result).toBeOk(Cl.uint(400));
    expect(recordSpend(300).result).toBeOk(Cl.uint(700));
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(1)], owner).result).toBeOk(Cl.uint(300));
  });

  it("aborts when a single spend exceeds budget", () => {
    createPolicy(500n);
    expect(recordSpend(600).result).toBeErr(Cl.uint(4)); // ERR-BUDGET-EXCEEDED
  });

  it("aborts when accumulated spend would exceed budget", () => {
    createPolicy(500n);
    expect(recordSpend(300).result).toBeOk(Cl.uint(300));
    expect(recordSpend(300).result).toBeErr(Cl.uint(4)); // ERR-BUDGET-EXCEEDED
  });

  it("rejects a non-agent caller", () => {
    createPolicy();
    expect(recordSpend(100, "STX", 0, stranger).result).toBeErr(Cl.uint(8)); // ERR-NOT-AGENT
  });

  it("rejects an unwhitelisted asset", () => {
    createPolicy();
    expect(recordSpend(100, "ETH").result).toBeErr(Cl.uint(6)); // ERR-ASSET-NOT-OK
  });

  it("rejects an unwhitelisted action", () => {
    createPolicy();
    expect(recordSpend(100, "STX", 3).result).toBeErr(Cl.uint(7)); // ERR-ACTION-NOT-OK (3 not in [0,1])
  });

  it("only owner can revoke", () => {
    createPolicy();
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(1)], stranger).result).toBeErr(Cl.uint(1)); // ERR-NOT-OWNER
    expect(simnet.callPublicFn(C, "revoke", [Cl.uint(1)], owner).result).toBeOk(Cl.bool(true));
  });

  it("revoked policy hard-stops the agent's next action", () => {
    createPolicy();
    simnet.callPublicFn(C, "revoke", [Cl.uint(1)], owner);
    expect(recordSpend(100).result).toBeErr(Cl.uint(12)); // ERR-REVOKED -- the headline guarantee
  });

  it("cannot resume a revoked policy", () => {
    createPolicy();
    simnet.callPublicFn(C, "revoke", [Cl.uint(1)], owner);
    expect(simnet.callPublicFn(C, "resume", [Cl.uint(1)], owner).result).toBeErr(Cl.uint(12)); // ERR-REVOKED
  });

  it("pause then resume gates the agent", () => {
    createPolicy();
    simnet.callPublicFn(C, "pause", [Cl.uint(1)], owner);
    expect(recordSpend(100).result).toBeErr(Cl.uint(2)); // ERR-INACTIVE
    simnet.callPublicFn(C, "resume", [Cl.uint(1)], owner);
    expect(recordSpend(100).result).toBeOk(Cl.uint(100));
  });

  it("only owner can pause", () => {
    createPolicy();
    expect(simnet.callPublicFn(C, "pause", [Cl.uint(1)], stranger).result).toBeErr(Cl.uint(1)); // ERR-NOT-OWNER
  });

  it("aborts after expiry", () => {
    createPolicy(1000n, 5); // expires 5 blocks out
    simnet.mineEmptyBurnBlocks(6);
    expect(recordSpend(100).result).toBeErr(Cl.uint(3)); // ERR-EXPIRED
  });

  it("time-gated record-spend-after rejects before the target burn height", () => {
    createPolicy();
    const future = simnet.burnBlockHeight + 50;
    const r = simnet.callPublicFn(
      C,
      "record-spend-after",
      [Cl.uint(1), Cl.uint(0), Cl.uint(100), Cl.stringAscii("bitflow-amm"), Cl.stringAscii("STX"), Cl.uint(future)],
      agent,
    );
    expect(r.result).toBeErr(Cl.uint(11)); // ERR-TOO-EARLY
  });

  it("time-gated record-spend-after executes once the burn height is reached", () => {
    createPolicy();
    const target = simnet.burnBlockHeight + 3;
    simnet.mineEmptyBurnBlocks(4);
    const r = simnet.callPublicFn(
      C,
      "record-spend-after",
      [Cl.uint(1), Cl.uint(0), Cl.uint(100), Cl.stringAscii("bitflow-amm"), Cl.stringAscii("STX"), Cl.uint(target)],
      agent,
    );
    expect(r.result).toBeOk(Cl.uint(100));
  });

  it("returns none for a missing policy and errors on its views", () => {
    expect(simnet.callReadOnlyFn(C, "get-policy", [Cl.uint(99)], owner).result).toBeNone();
    expect(simnet.callReadOnlyFn(C, "remaining-budget", [Cl.uint(99)], owner).result).toBeErr(Cl.uint(13)); // ERR-NOT-FOUND
  });
});
