import { describe, expect, it } from "vitest";
import type { MarketBar } from "../../shared/market";
import { analyzeBars, calculateRiskPlan, validateBars } from "./analysis";
import { runBacktest } from "./backtest";

const settings = {
  accountEquity: 10_000,
  riskPerTradePercent: 1,
  maxPositionPercent: 20,
  stopAtrMultiplier: 1.5,
  rewardRiskRatio: 2,
};

function series(count: number): MarketBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.5;
    return { timestamp: 1_700_000_000_000 + index * 86_400_000, open: close - 0.2, high: close + 0.8, low: close - 0.8, close, volume: 1_000 + index * 10 };
  });
}

describe("market analysis safeguards", () => {
  it("withholds a signal when the data history is shorter than the model warmup", () => {
    const result = analyzeBars(series(20), settings);
    expect(result.direction).toBe("insufficient_data");
    expect(result.strength).toBe(0);
  });

  it("caps the signal strength and labels it as indicator agreement rather than a promised outcome", () => {
    const result = analyzeBars(series(80), settings);
    expect(result.strength).toBeLessThanOrEqual(80);
    expect(result.limitations.join(" ")).toContain("ليست احتمال نجاح");
  });

  it("limits position size by the smaller of risk budget and exposure budget", () => {
    const plan = calculateRiskPlan(100, "bullish", 2, settings)!;
    expect(plan.estimatedUnits).toBe(20);
    expect(plan.maximumPositionValue).toBe(2_000);
  });

  it("rejects malformed OHLC data instead of silently analysing it", () => {
    expect(() => validateBars([{ timestamp: 1, open: 10, high: 9, low: 11, close: 10 }])).toThrow("غير متسقة");
  });

  it("uses the following bar open for backtest entry to avoid same-bar lookahead", () => {
    const bars = series(100);
    const result = runBacktest(bars, { ...settings, slippageBps: 5, maximumHoldingBars: 4 });
    if (result.trades.length > 0) {
      expect(result.trades[0].entryTimestamp).toBe(bars[61].timestamp);
    }
    expect(result.limitations.join(" ")).toContain("الشمعة التالية");
  });
});
