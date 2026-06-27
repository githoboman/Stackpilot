import { Cl } from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME } from "../stacksConfig.js";
import type { ClarityCall } from "./policyCreator.js";

/**
 * Owner-signed pause/resume Clarity calls. Both flip `active` on the policy and are
 * re-checked by validate on-chain, so a paused policy hard-blocks the agent even if
 * the off-chain pre-flight is bypassed. Returned as call descriptors for the owner's
 * connected wallet (@stacks/connect) to sign.
 */
function ownerCall(functionName: string, policyId: number): ClarityCall {
  return {
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgsHex: [Cl.serialize(Cl.uint(policyId))],
  };
}

export function buildPauseCall(policyId: number): ClarityCall {
  return ownerCall("pause", policyId);
}

export function buildResumeCall(policyId: number): ClarityCall {
  return ownerCall("resume", policyId);
}
