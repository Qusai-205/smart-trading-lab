import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getLatestMt5DemoConnection, upsertMt5DemoConnection, upsertMt5DemoBars } from "../db";

const MT5_DEMO_BRIDGE_TOKEN = () => process.env.MT5_DEMO_BRIDGE_TOKEN?.trim() ?? "";

const mt5DemoPayloadSchema = z.object({
  broker: z.literal("Equiti Jordan"),
  environment: z.literal("demo"),
  server: z.string().trim().regex(/^EquitiGroupLtd-Demo(?:[ .-].*)?$/, "يجب أن يكون الخادم تابعاً لـ EquitiGroupLtd-Demo."),
  accountLogin: z.string().trim().regex(/^\d{4,20}$/),
  equity: z.number().finite().nonnegative(),
  balance: z.number().finite().nonnegative(),
  leverage: z.number().int().min(1).max(10_000),
  syncedAtMs: z.number().int().positive(),
  positions: z.array(z.object({
    symbol: z.string().trim().min(1).max(30),
    volume: z.number().finite().nonnegative(),
    side: z.enum(["buy", "sell"]),
    profit: z.number().finite(),
  })).max(200).default([]),
  bars: z.array(z.object({
    symbol: z.string().trim().regex(/^[A-Za-z0-9._-]{1,30}$/),
    timeframe: z.enum(["M15", "H1", "H4", "D1"]),
    timestamp: z.number().int().positive(),
    open: z.number().finite().positive(),
    high: z.number().finite().positive(),
    low: z.number().finite().positive(),
    close: z.number().finite().positive(),
    volume: z.number().finite().nonnegative().optional(),
  })).max(10_000).default([]),
});

export type Mt5DemoPayload = z.infer<typeof mt5DemoPayloadSchema>;

export function parseMt5DemoPayload(input: unknown) {
  const payload = mt5DemoPayloadSchema.parse(input);
  if (payload.syncedAtMs > Date.now() + 5 * 60_000) throw new Error("وقت المزامنة من MT5 يقع في المستقبل بشكل غير مقبول.");
  for (const bar of payload.bars) {
    if (bar.low > bar.high || bar.open < bar.low || bar.open > bar.high || bar.close < bar.low || bar.close > bar.high) {
      throw new Error("إحدى شموع MT5 غير متسقة؛ تم رفض كامل المزامنة بدلاً من إنشاء تحليل مضلل.");
    }
  }
  return payload;
}

export function isMt5DemoBridgeConfigured() {
  return Boolean(MT5_DEMO_BRIDGE_TOKEN());
}

export async function getMt5DemoStatus() {
  return {
    configured: isMt5DemoBridgeConfigured(),
    environment: "demo-only" as const,
    connection: await getLatestMt5DemoConnection(),
  };
}

export function registerMt5DemoBridge(app: Express) {
  app.post("/api/mt5/demo/ingest", async (req: Request, res: Response) => {
    const expectedToken = MT5_DEMO_BRIDGE_TOKEN();
    const suppliedToken = req.header("x-mt5-demo-token")?.trim() ?? "";
    if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
      return res.status(403).json({ error: "demo-bridge-token-required" });
    }
    try {
      const payload = parseMt5DemoPayload(req.body);
      await upsertMt5DemoConnection(payload);
      await upsertMt5DemoBars(payload.accountLogin, payload.bars);
      return res.json({ ok: true, environment: "demo-only", receivedAtMs: Date.now(), barsStored: payload.bars.length });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "invalid-mt5-demo-payload" });
    }
  });
}
