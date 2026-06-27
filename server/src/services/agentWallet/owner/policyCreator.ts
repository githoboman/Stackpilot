import { Cl, type ClarityValue } from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME, PROTOCOL_ID, canonicalAsset } from "../stacksConfig.js";
import { AgentActionType } from "../types.js";

/**
 * Builds the create-policy Clarity call for the OWNER to sign with their connected
 * Stacks wallet (Leather/Xverse via @stacks/connect). The server never signs this —
 * it only describes the contract call (address/name/function + serialized args).
 *
 * On Stacks there is no capability object: the agent principal is stored inside the
 * policy and `revoked` is the hard stop, so create-policy just records the binding.
 */
export interface CreatePolicyInput {
  /** Agent wallet Stacks address that the policy authorizes. */
  agentAddress: string;
  /** Budget cap in base units (micro-STX). */
  budgetCap: bigint;
  /** Allowed protocol id strings (defaults to the Bitflow protocol id). */
  allowedProtocols?: string[];
  /** Allowed asset SYMBOLS (e.g. ["STX","sBTC"]). */
  allowedAssets: string[];
  /** Allowed actions (defaults to swap + limit). */
  allowedActions?: AgentActionType[];
  /** Expiry as an absolute burn-block height (required — resolved by the route). */
  expiryBurnHeight: number;
}

/**
 * A Clarity contract-call descriptor the frontend passes to @stacks/connect's
 * `request('stx_callContract', ...)`. functionArgs are hex-serialized Clarity values
 * so they survive JSON transport to the browser, where they're sent as-is.
 */
export interface ClarityCall {
  contract: string; // "ST….agent-policy"
  contractAddress: string;
  contractName: string;
  functionName: string;
  /** Hex-serialized Clarity values (Cl.serialize), one per argument. */
  functionArgsHex: string[];
}

function call(functionName: string, args: ClarityValue[]): ClarityCall {
  return {
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgsHex: args.map((a) => Cl.serialize(a)),
  };
}

export function buildCreatePolicyCall(input: CreatePolicyInput): ClarityCall {
  const protocols = input.allowedProtocols ?? [PROTOCOL_ID];
  const assets = input.allowedAssets.map(canonicalAsset);
  const actions = input.allowedActions ?? [AgentActionType.Swap, AgentActionType.LimitOrder];

  return call("create-policy", [
    Cl.principal(input.agentAddress),
    Cl.uint(input.budgetCap),
    Cl.list(protocols.map((p) => Cl.stringAscii(p))),
    Cl.list(assets.map((a) => Cl.stringAscii(a))),
    Cl.list(actions.map((a) => Cl.uint(a))),
    Cl.uint(input.expiryBurnHeight),
  ]);
}
