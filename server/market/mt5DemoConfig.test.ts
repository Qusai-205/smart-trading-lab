import { afterEach, describe, expect, it } from "vitest";
import { isMt5DemoBridgeConfigured } from "./mt5Demo";

const originalToken = process.env.MT5_DEMO_BRIDGE_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.MT5_DEMO_BRIDGE_TOKEN;
  else process.env.MT5_DEMO_BRIDGE_TOKEN = originalToken;
});

describe("MT5 Demo bridge authentication", () => {
  it("stays disabled until a non-empty bridge token is configured", () => {
    delete process.env.MT5_DEMO_BRIDGE_TOKEN;
    expect(isMt5DemoBridgeConfigured()).toBe(false);
    process.env.MT5_DEMO_BRIDGE_TOKEN = "  ";
    expect(isMt5DemoBridgeConfigured()).toBe(false);
    process.env.MT5_DEMO_BRIDGE_TOKEN = "demo-bridge-token-test-only";
    expect(isMt5DemoBridgeConfigured()).toBe(true);
  });
});
