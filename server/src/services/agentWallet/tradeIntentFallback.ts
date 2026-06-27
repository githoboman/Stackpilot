import { TradeIntentSchema, type TradeIntent } from "./tradeIntentSchema.js";

/**
 * Deterministic, dependency-free fallback parser for natural-language trade
 * instructions. Used as a safety net when the Gemini-backed parser is
 * unavailable (missing/invalid GEMINI_API_KEY, network error, rate limit) so the
 * NL command box keeps working in a live demo. Covers the same canonical shapes
 * the LLM is prompted on; returns action="unknown" when it can't read the text.
 *
 * This is intentionally conservative: it never invents amounts or prices the
 * user didn't write, mirroring the LLM system prompt.
 */

const TOKENS = ["STX", "sBTC"];

/** Canonicalize a matched token to its whitelist form ("STX" / "sBTC"). */
function canon(t: string): string {
  return t.toUpperCase() === "SBTC" ? "sBTC" : "STX";
}

/** Find token symbols in textual order, else []. */
function findTokens(text: string): string[] {
  const found: string[] = [];
  // Match STX / sBTC / BTC (BTC treated as sBTC). Case-insensitive; preserve order
  // so "STX ... sBTC" maps to in→out correctly.
  const re = /\b(sbtc|stx|btc)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.push(/stx/i.test(m[1]) ? "STX" : "sBTC");
  }
  return found;
}

/** Resolve in/out from the tokens mentioned and a default pair. */
function resolvePair(tokens: string[], fallbackIn = "STX", fallbackOut = "sBTC"): { tokenIn: string; tokenOut: string } {
  if (tokens.length >= 2) return { tokenIn: canon(tokens[0]), tokenOut: canon(tokens[1]) };
  if (tokens.length === 1) {
    const t = canon(tokens[0]);
    // Single token named: assume they're spending it, default the counter-asset.
    return t === "sBTC" ? { tokenIn: "sBTC", tokenOut: "STX" } : { tokenIn: "STX", tokenOut: "sBTC" };
  }
  return { tokenIn: fallbackIn, tokenOut: fallbackOut };
}

function num(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
}

/**
 * Parse a natural-language instruction into a structured TradeIntent without any
 * LLM. Returns a validated TradeIntent (action="unknown" on failure).
 */
export function parseIntentFallback(message: string): TradeIntent {
  const text = message.trim();
  const lower = text.toLowerCase();
  const tokens = findTokens(text);

  // cancel / revoke / stop
  if (/\b(cancel|revoke|stop)\b/.test(lower)) {
    return TradeIntentSchema.parse({ action: "cancel", summary: "Stop the agent / cancel recurring runs." });
  }

  const percentage = num(text, /(\d+(?:\.\d+)?)\s*%/);
  const priceMatch = text.match(/(?:below|above|at|under|over)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  const price = priceMatch ? Number(priceMatch[1]) : undefined;

  // Resolve the trade amount. Prefer a token-qualified number ("100 STX"); only
  // fall back to a bare number when it isn't the price we already extracted, so
  // "buy if STX drops below 0.25" doesn't mistake the 0.25 price for an amount.
  const amountFromToken = num(text, /(\d+(?:\.\d+)?)\s*(?:stx|sbtc|btc)\b/i);

  // Recurrence phrase for auto-DCA: "every hour", "hourly", "each day", "daily".
  const intervalMatch =
    text.match(/\b(every\s+\d*\s*(?:min|minute|minutes|hour|hours|day|days|week|weeks))\b/i) ||
    text.match(/\b(hourly|daily|weekly)\b/i);
  const interval = intervalMatch ? intervalMatch[1].trim().toLowerCase() : undefined;
  // Strip the price phrase and any "N%" so neither is mistaken for the amount.
  const bareText = (priceMatch ? text.replace(priceMatch[0], " ") : text).replace(/\d+(?:\.\d+)?\s*%/g, " ");
  const amount = amountFromToken ?? num(bareText, /\b(\d+(?:\.\d+)?)\b/);
  const condition: "below" | "above" | undefined = /\b(below|under|drops?|less than)\b/i.test(lower)
    ? "below"
    : /\b(above|over|rises?|more than)\b/i.test(lower)
    ? "above"
    : undefined;
  const scheduleMatch =
    text.match(/\b(?:at|@)\s*(\d{1,2}:\d{2}\s*(?:utc|am|pm)?)/i) ||
    text.match(/\b(in\s+\d+\s*(?:min|minute|minutes|hour|hours))\b/i);
  const schedule = scheduleMatch ? scheduleMatch[1].trim() : undefined;

  // dca: a recurring instruction with an interval ("DCA 5 STX into sBTC every hour")
  if (interval && /\b(dca|swap|buy|sell|trade|convert|invest|stack)\b/i.test(lower)) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "dca",
      tokenIn,
      tokenOut,
      ...(amount != null ? { amount } : {}),
      interval,
      summary: `Auto-DCA ${amount ?? ""} ${tokenIn} → ${tokenOut} ${interval}.`.replace(/\s+/g, " ").trim(),
    });
  }

  // conditional: has a direction + price ("buy sBTC if STX drops below 0.20")
  if (condition && price != null && /\b(if|when|once)\b/i.test(lower)) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "conditional_swap",
      tokenIn,
      tokenOut,
      price,
      condition,
      ...(amount != null ? { amount } : {}),
      summary: `Swap ${tokenIn} → ${tokenOut} when price goes ${condition} ${price}.`,
    });
  }

  // limit order: explicit "limit" + a price
  if (/\blimit\b/i.test(lower) && price != null) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "limit_order",
      tokenIn,
      tokenOut,
      ...(amount != null ? { amount } : {}),
      price,
      summary: `Limit order ${amount ?? ""} ${tokenIn} @ ${price}.`.replace(/\s+/g, " ").trim(),
    });
  }

  // scheduled: a swap with a time phrase
  if (schedule && /\b(swap|buy|sell|trade)\b/i.test(lower)) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "scheduled_swap",
      tokenIn,
      tokenOut,
      ...(amount != null ? { amount } : {}),
      schedule,
      summary: `Scheduled swap ${amount ?? ""} ${tokenIn} → ${tokenOut} at ${schedule}.`.replace(/\s+/g, " ").trim(),
    });
  }

  // percentage swap
  if (percentage != null && /\b(swap|sell|buy|trade|convert)\b/i.test(lower)) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "percentage_swap",
      tokenIn,
      tokenOut,
      percentage,
      summary: `Swap ${percentage}% of ${tokenIn} → ${tokenOut}.`,
    });
  }

  // market swap: a swap verb + an amount
  if (amount != null && /\b(swap|sell|buy|trade|convert|exchange)\b/i.test(lower)) {
    const { tokenIn, tokenOut } = resolvePair(tokens);
    return TradeIntentSchema.parse({
      action: "market_swap",
      tokenIn,
      tokenOut,
      amount,
      summary: `Swap ${amount} ${tokenIn} → ${tokenOut}.`,
    });
  }

  return TradeIntentSchema.parse({
    action: "unknown",
    summary: `Couldn't read "${text}" as a trade instruction.`,
  });
}

export const _testing = { findTokens, resolvePair };
export { TOKENS };
