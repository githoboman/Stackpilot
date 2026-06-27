import { Cl } from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME } from "../stacksConfig.js";
import { getBudgetTracker } from "../budgetTracker.js";
import type { ClarityCall } from "./policyCreator.js";

/**
 * Revocation on Stacks is ONE owner-signed call — far simpler than an object-capability two-step
 * dance (which needed the agent to hand back the capability before the owner could
 * consume it). Here `revoke` flips the policy's `revoked` flag; the agent's next
 * record-spend then aborts on-chain with ERR-REVOKED (u12).
 *
 * Honest note: an object-capability model would destroy a capability object so the
 * next agent tx couldn't resolve its input. Clarity has no objects, so revoke sets a
 * flag and the agent's next call aborts at the (not revoked) assert. Same guarantee
 * (agent hard-stopped on-chain, owner-only), different mechanism.
 */

export function buildRevokeCall(policyId: number): ClarityCall {
  return {
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "revoke",
    functionArgsHex: [Cl.serialize(Cl.uint(policyId))],
  };
}

/**
 * Local-side cleanup the server can do immediately when a revoke is requested:
 * drop any pending soft budget allocations for the policy. The authoritative
 * teardown is the owner-signed revoke call above.
 */
export function clearLocalState(policyId: string): void {
  getBudgetTracker().clear(policyId);
}
