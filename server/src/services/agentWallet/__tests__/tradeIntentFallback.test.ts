import { describe, it, expect } from "vitest";
import { parseIntentFallback } from "../tradeIntentFallback.js";

describe("parseIntentFallback (Stacks / STX -> sBTC)", () => {
  it("parses a fixed market swap", () => {
    const i = parseIntentFallback("swap 100 STX to sBTC");
    expect(i.action).toBe("market_swap");
    expect(i.tokenIn).toBe("STX");
    expect(i.tokenOut).toBe("sBTC");
    expect(i.amount).toBe(100);
  });

  it("parses the headline auto-DCA instruction", () => {
    const i = parseIntentFallback("DCA 5 STX into sBTC every hour");
    expect(i.action).toBe("dca");
    expect(i.tokenIn).toBe("STX");
    expect(i.tokenOut).toBe("sBTC");
    expect(i.amount).toBe(5);
    expect(i.interval).toMatch(/every hour/i);
  });

  it("parses a daily DCA", () => {
    const i = parseIntentFallback("stack 2 STX into bitcoin daily");
    expect(i.action).toBe("dca");
    expect(i.amount).toBe(2);
    expect(i.interval).toBe("daily");
  });

  it("parses a percentage swap", () => {
    const i = parseIntentFallback("swap 30% of my STX to sBTC");
    expect(i.action).toBe("percentage_swap");
    expect(i.tokenIn).toBe("STX");
    expect(i.tokenOut).toBe("sBTC");
    expect(i.percentage).toBe(30);
  });

  it("does not mistake a percentage for an amount", () => {
    const i = parseIntentFallback("swap 30% of my STX to sBTC");
    expect(i.percentage).toBe(30);
    expect(i.amount).toBeUndefined();
  });

  it("parses a conditional (below) swap", () => {
    const i = parseIntentFallback("buy sBTC if STX drops below 0.25");
    expect(i.action).toBe("conditional_swap");
    expect(i.condition).toBe("below");
    expect(i.price).toBe(0.25);
    expect(i.amount).toBeUndefined();
  });

  it("parses a scheduled swap with a time", () => {
    const i = parseIntentFallback("swap 50 STX at 15:00 UTC");
    expect(i.action).toBe("scheduled_swap");
    expect(i.amount).toBe(50);
    expect(i.schedule?.toLowerCase()).toContain("15:00");
  });

  it("parses a relative scheduled swap", () => {
    const i = parseIntentFallback("swap 5 STX in 10 minutes");
    expect(i.action).toBe("scheduled_swap");
    expect(i.schedule).toMatch(/in 10/i);
  });

  it("recognizes cancel / revoke / stop", () => {
    expect(parseIntentFallback("cancel my orders").action).toBe("cancel");
    expect(parseIntentFallback("revoke the agent").action).toBe("cancel");
    expect(parseIntentFallback("stop the dca").action).toBe("cancel");
  });

  it("defaults the pair to STX/sBTC when only one token is named", () => {
    const i = parseIntentFallback("swap 20 STX");
    expect(i.tokenIn).toBe("STX");
    expect(i.tokenOut).toBe("sBTC");
  });

  it("returns unknown for non-trade text", () => {
    const i = parseIntentFallback("what's the weather today?");
    expect(i.action).toBe("unknown");
    expect(i.summary).toBeTruthy();
  });

  it("never invents an amount the user didn't give", () => {
    const i = parseIntentFallback("swap my STX to sBTC");
    expect(i.amount).toBeUndefined();
    expect(i.action).not.toBe("market_swap");
  });
});
