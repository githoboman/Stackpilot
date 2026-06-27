import { toWholeTokens, canonicalAsset } from "./stacksConfig.js";

/**
 * Bitflow AMM adapter — quote + (eventually) build a STX->sBTC swap on Stacks.
 *
 *
 * SHAPE-FIRST, SDK-READY: the swapAgent depends only on quoteSwap() returning an
 * expected-out + min-out. The real Bitflow SDK call is isolated behind getRoute()
 * so it can be dropped in once testnet pool/SDK specifics are verified live, without
 * touching the agent pipeline.
 *
 * To wire the real SDK (per the build plan):
 *   npm install @bitflowlabs/core-sdk
 *   node -e "console.log(Object.keys(require('@bitflowlabs/core-sdk')))"  // confirm exports
 * then implement getRoute() with sdk.getBestRoute({ tokenInId, tokenOutId, amount }).
 *
 * Until then getRoute() falls back to a deterministic local estimate so the
 * sequenced demo (validate -> record-spend on-chain -> swap) runs end-to-end. The
 * on-chain record-spend guard — the whole pitch — is fully real regardless.
 */

export interface BitflowSwap {
  tokenIn: string; // "STX"
  tokenOut: string; // "sBTC"
  amountIn: bigint; // base units of tokenIn (micro-STX)
  slippageBps?: number; // default 100 = 1%
}

export interface BitflowQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  /** Expected output in base units of tokenOut. */
  expectedOut: bigint;
  /** Minimum acceptable output after slippage, base units of tokenOut. */
  minOut: bigint;
  /** Indicative price (tokenOut per tokenIn, whole tokens). */
  price: number;
  /** True when this came from the live Bitflow SDK; false for the local estimate. */
  live: boolean;
  /** Opaque route payload from the SDK (contract/function to call), when live. */
  route?: unknown;
}

/**
 * Indicative STX->sBTC price for the local estimate (sBTC per 1 STX, whole tokens).
 * Overridable via env so the demo can be tuned without code changes. This is ONLY
 * used by the fallback path; the live SDK route supersedes it.
 */
const ESTIMATE_STX_PER_SBTC = Number(process.env.BITFLOW_ESTIMATE_PRICE || "0.00001");

/**
 * Live route hook. Returns null to signal "use the local estimate". Replace the body
 * with the Bitflow SDK once verified on testnet.
 */
async function getRoute(_s: BitflowSwap): Promise<BitflowQuote | null> {
  // --- BITFLOW SDK INTEGRATION POINT ---------------------------------------
  // const sdk = new BitflowSDK({ API_HOST: process.env.BITFLOW_API_HOST, API_KEY: process.env.BITFLOW_API_KEY });
  // const route = await sdk.getBestRoute({ tokenInId: s.tokenIn, tokenOutId: s.tokenOut, amount: Number(s.amountIn) });
  // return { ...mapRouteToQuote(route), live: true, route };
  // -------------------------------------------------------------------------
  return null;
}

/** Get a route + min-out quote. Falls back to a deterministic local estimate. */
export async function quoteSwap(s: BitflowSwap): Promise<BitflowQuote> {
  const tokenIn = canonicalAsset(s.tokenIn);
  const tokenOut = canonicalAsset(s.tokenOut);
  const slippageBps = s.slippageBps ?? 100;

  const live = await getRoute({ ...s, tokenIn, tokenOut });
  if (live) return live;

  // Local estimate: convert amountIn to whole tokens, apply the indicative price,
  // re-base to tokenOut units, then subtract slippage for min-out.
  const inWhole = toWholeTokens(s.amountIn, tokenIn);
  const price = tokenOut.toUpperCase() === "SBTC" ? ESTIMATE_STX_PER_SBTC : 1 / ESTIMATE_STX_PER_SBTC;
  const outWhole = inWhole * price;
  const outDecimals = tokenOut.toUpperCase() === "SBTC" ? 8 : 6;
  const expectedOut = BigInt(Math.round(outWhole * 10 ** outDecimals));
  const minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;

  return {
    tokenIn,
    tokenOut,
    amountIn: s.amountIn,
    expectedOut,
    minOut,
    price,
    live: false,
  };
}
