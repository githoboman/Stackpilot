import {
  makeContractCall,
  broadcastTransaction,
  Cl,
  PostConditionMode,
  type ClarityValue,
} from "@stacks/transactions";
import { NETWORK, requireContract } from "./stacksConfig.js";
import { getAgentKeypairService } from "./keypair.js";
import type { AgentWalletRecord } from "./types.js";

/**
 * Signs + broadcasts Clarity contract calls with the AGENT key — never the user's
 * connected wallet. There is no PTB on
 * Stacks, just a single contract-call transaction.
 *
 * The agent key is decrypted only for the moment of signing. A revoked policy makes
 * record-spend abort on-chain with ERR-REVOKED (u12), surfaced here as a failed tx.
 */
export interface CallResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/** Sign + broadcast a policy contract call with the AGENT key. */
export async function callPolicy(
  wallet: AgentWalletRecord,
  functionName: string,
  functionArgs: ClarityValue[],
): Promise<CallResult> {
  try {
    const { address, name } = requireContract();
    const senderKey = getAgentKeypairService().secret(wallet.encryptedSecretKey);

    const tx = await makeContractCall({
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs,
      senderKey,
      network: NETWORK,
      // Demo posture: the policy call moves no tokens itself (record-spend only
      // mutates the budget map), so Allow is safe. The actual Bitflow swap, once
      // wired, gets its own post-conditions. Tighten for mainnet.
      postConditionMode: PostConditionMode.Allow,
    });

    const res = await broadcastTransaction({ transaction: tx, network: NETWORK });

    // broadcastTransaction returns either { txid } or { error, reason, ... }.
    if ("error" in res && (res as any).error) {
      const reason = (res as any).reason ? `: ${(res as any).reason}` : "";
      const data = (res as any).reason_data ? ` ${JSON.stringify((res as any).reason_data)}` : "";
      return { success: false, error: `${(res as any).error}${reason}${data}` };
    }
    return { success: true, txid: (res as any).txid };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/** Build the Clarity args for record-spend. */
export function recordSpendArgs(
  policyId: number,
  action: number,
  amount: bigint,
  protocol: string,
  asset: string,
): ClarityValue[] {
  return [
    Cl.uint(policyId),
    Cl.uint(action),
    Cl.uint(amount),
    Cl.stringAscii(protocol),
    Cl.stringAscii(asset),
  ];
}

/** Build the Clarity args for the time-gated record-spend-after (scheduled/DCA). */
export function recordSpendAfterArgs(
  policyId: number,
  action: number,
  amount: bigint,
  protocol: string,
  asset: string,
  executeAfterBurnHeight: number,
): ClarityValue[] {
  return [
    Cl.uint(policyId),
    Cl.uint(action),
    Cl.uint(amount),
    Cl.stringAscii(protocol),
    Cl.stringAscii(asset),
    Cl.uint(executeAfterBurnHeight),
  ];
}
