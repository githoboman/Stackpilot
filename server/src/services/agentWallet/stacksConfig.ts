import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

/**
 * Single source of truth for the Stackpilot agent-policy on-chain identifiers and
 * the canonical asset/protocol strings the Clarity policy whitelists against.
 *
 * Everything is env-driven so the same code targets
 * testnet today and mainnet later. The Clarity policy does EXACT ascii-string
 * membership over allowed-assets / allowed-protocols, so the strings here must match
 * exactly what create-policy was given.
 */

export type StacksNetworkName = "testnet" | "mainnet";

export function getNetworkName(): StacksNetworkName {
  return (process.env.STACKS_NETWORK as StacksNetworkName) || "testnet";
}

/** The @stacks/network client for the configured network. */
export const NETWORK = getNetworkName() === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

/**
 * Resolve the deployed agent-policy contract id from env, e.g.
 *   STACKS_CONTRACT="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.agent-policy"
 * Split into address + name for makeContractCall / call-read-only.
 */
const full = process.env.STACKS_CONTRACT || "";
const [addr, name] = full.split(".");
export const CONTRACT_ADDRESS = addr || "";
export const CONTRACT_NAME = name || "agent-policy";

/** Hiro API base for read-only calls + chain tip lookups. */
export const HIRO_API =
  process.env.HIRO_API ||
  (getNetworkName() === "mainnet" ? "https://api.hiro.so" : "https://api.testnet.hiro.so");

/** Throw a clear error if the contract id hasn't been wired yet. */
export function requireContract(): { address: string; name: string } {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "STACKS_CONTRACT not set. Deploy agent-policy.clar to Stacks testnet and set " +
        "STACKS_CONTRACT=ST<deployer>.agent-policy in server/.env.",
    );
  }
  return { address: CONTRACT_ADDRESS, name: CONTRACT_NAME };
}

/**
 * Canonical asset symbols the policy whitelists against (exact-match in Clarity).
 * The headline DCA pair is STX -> sBTC, so Bitcoin (via sBTC) is the DCA target.
 */
export const ASSET_SYMBOLS = ["STX", "sBTC"] as const;

/** The protocol id whitelisted in the policy for swaps. */
export const PROTOCOL_ID = process.env.PROTOCOL_ID || "bitflow-amm";

/**
 * On-chain coin decimals per symbol. STX uses 6 (micro-STX); sBTC uses 8 (sats),
 * mirroring BTC. The agent records spend and sizes amounts in these base units.
 */
export const DECIMALS: Record<string, number> = { STX: 6, SBTC: 8 };

/** Decimals for a symbol; defaults to 6 (STX-like) for unknown coins. */
export function decimalsFor(symbol: string): number {
  return DECIMALS[symbol.toUpperCase()] ?? 6;
}

/** Convert whole tokens to base units (bigint) for the given symbol. */
export function toMicro(amount: number, symbol: string): bigint {
  return BigInt(Math.round(amount * 10 ** decimalsFor(symbol)));
}

/** Convert base units to whole tokens (number) for display/quotes. */
export function toWholeTokens(amountBaseUnits: bigint, symbol: string): number {
  return Number(amountBaseUnits) / 10 ** decimalsFor(symbol);
}

/**
 * Normalize an asset symbol to the canonical whitelist form ("STX", "sBTC").
 * The Clarity whitelist stores "sBTC" (mixed case), so we map case-insensitively
 * back to the canonical string the policy was created with.
 */
export function canonicalAsset(symbol: string): string {
  const up = symbol.toUpperCase();
  if (up === "SBTC") return "sBTC";
  if (up === "STX") return "STX";
  return symbol;
}
