import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TradeIntentSchema, type TradeIntent } from "./tradeIntentSchema.js";
import { parseIntentFallback } from "./tradeIntentFallback.js";

export { TradeIntentSchema, type TradeIntent } from "./tradeIntentSchema.js";

/**
 * Natural-language trade-intent parser. Turns a user instruction like
 * "swap 30% of my STX to sBTC" or "DCA 5 STX into sBTC every hour" into a
 * structured TradeIntent the agent engine can validate against policy and execute.
 *
 * Mirrors the codebase's existing pattern (taskManagerAgent): Gemini Flash +
 * Zod `withStructuredOutput`, temperature 0 for deterministic extraction.
 */

const SYSTEM_PROMPT = `You translate a user's natural-language crypto instruction into a structured trade intent for an autonomous agent on the Stacks blockchain trading via the Bitflow AMM. The headline feature is Auto-DCA into Bitcoin (STX -> sBTC on a recurring schedule).

Rules:
- Supported tokens: STX, sBTC. If a token isn't named, infer from context; default the pair to STX/sBTC.
- "swap 100 STX to sBTC" -> action=market_swap, tokenIn=STX, tokenOut=sBTC, amount=100.
- "DCA 5 STX into sBTC every hour" -> action=dca, tokenIn=STX, tokenOut=sBTC, amount=5, interval="every hour".
- "buy 10 sBTC of STX daily" -> action=dca, amount=10, interval="daily".
- "swap 30% of my STX" -> action=percentage_swap, tokenIn=STX, tokenOut=sBTC, percentage=30.
- "buy sBTC if STX drops below 0.25" -> action=conditional_swap, tokenIn=STX, tokenOut=sBTC, price=0.25, condition=below.
- "swap 50 STX at 3pm UTC" -> action=scheduled_swap, amount=50, schedule="15:00 UTC".
- "cancel" / "revoke" / "stop" -> action=cancel.
- If the instruction isn't a trade, action=unknown.
- Always fill 'summary' with a clear one-line restatement.
- Never invent amounts or prices that the user didn't state.`;

/** Keys that are clearly placeholders, not real Gemini credentials. */
function isUsableKey(key: string | undefined): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.length < 10) return false;
  return !/^(dummy|test|changeme|placeholder|your[-_]?key|xxx+)/i.test(k);
}

export class TradeIntentParser {
  // The bound structured-output runnable; null when no usable key is configured.
  private structured: { invoke: (input: unknown) => Promise<TradeIntent> } | null = null;
  private readonly hasKey: boolean;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY_TASK || process.env.GEMINI_API_KEY;
    this.hasKey = isUsableKey(apiKey);
    if (this.hasKey) {
      const llm = new ChatGoogleGenerativeAI({
        model: process.env.LLM_MODEL || "gemini-2.5-flash",
        apiKey,
        temperature: 0,
        maxOutputTokens: 512,
      });
      this.structured = llm.withStructuredOutput(TradeIntentSchema) as {
        invoke: (input: unknown) => Promise<TradeIntent>;
      };
    }
  }

  /**
   * Parse a natural-language instruction into a structured TradeIntent.
   * Uses Gemini when a real key is configured; otherwise (or if the LLM call
   * fails) falls back to the deterministic regex parser so the NL box still
   * works in a live demo. The result is always a validated TradeIntent.
   */
  async parse(message: string): Promise<TradeIntent> {
    if (!this.structured) return parseIntentFallback(message);
    try {
      return await this.structured.invoke([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ]);
    } catch (e) {
      // Gemini unavailable mid-session (invalid key, network, rate limit):
      // degrade to the deterministic parser rather than failing the request.
      console.warn(`[tradeIntent] Gemini parse failed, using fallback: ${(e as Error)?.message || e}`);
      return parseIntentFallback(message);
    }
  }
}

let instance: TradeIntentParser | null = null;
export function getTradeIntentParser(): TradeIntentParser {
  if (!instance) instance = new TradeIntentParser();
  return instance;
}
