import { describe, expect, it } from "vitest";
import { parseMt5DemoPayload } from "./mt5Demo";

const basePayload = {
  broker: "Equiti Jordan",
  environment: "demo",
  server: "Equiti-Demo",
  accountLogin: "12345678",
  equity: 10_000,
  balance: 10_000,
  leverage: 100,
  syncedAtMs: Date.now(),
  positions: [],
  bars: [],
};

describe("MT5 Demo bridge payload", () => {
  it("accepts a valid Equiti Jordan demo snapshot", () => {
    expect(parseMt5DemoPayload(basePayload).environment).toBe("demo");
  });

  it("rejects a live environment or non-numeric account login", () => {
    expect(() => parseMt5DemoPayload({ ...basePayload, environment: "live" })).toThrow();
    expect(() => parseMt5DemoPayload({ ...basePayload, accountLogin: "live-account" })).toThrow();
  });

  it("rejects inconsistent OHLC price bars", () => {
    expect(() => parseMt5DemoPayload({ ...basePayload, bars: [{ symbol: "XAUUSD", timeframe: "D1", timestamp: Date.now(), open: 10, high: 9, low: 8, close: 9 }] })).toThrow("غير متسقة");
  });
});
