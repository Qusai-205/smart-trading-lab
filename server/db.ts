import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { analysisSchedules, analysisSignals, InsertUser, marketAssets, mt5DemoBars, mt5DemoConnections, riskSettings, users } from "../drizzle/schema";
import type { Mt5DemoPayload } from "./market/mt5Demo";
import type { SignalAnalysis } from "../shared/market";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export const DEFAULT_RISK_SETTINGS = {
  accountEquity: 10_000,
  riskPerTradePercent: 1,
  maxPositionPercent: 20,
  stopAtrMultiplier: 1.5,
  rewardRiskRatio: 2,
  alertOnRiskBreach: true,
};

export async function getRiskSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(riskSettings).where(eq(riskSettings.userId, userId)).limit(1))[0];
}

export async function saveRiskSettings(userId: number, input: typeof DEFAULT_RISK_SETTINGS) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(riskSettings).values({
    userId,
    accountEquity: input.accountEquity.toFixed(2),
    riskPerTradePercent: input.riskPerTradePercent.toFixed(2),
    maxPositionPercent: input.maxPositionPercent.toFixed(2),
    stopAtrMultiplier: input.stopAtrMultiplier.toFixed(2),
    rewardRiskRatio: input.rewardRiskRatio.toFixed(2),
    alertOnRiskBreach: input.alertOnRiskBreach,
  }).onDuplicateKeyUpdate({
    set: {
      accountEquity: input.accountEquity.toFixed(2),
      riskPerTradePercent: input.riskPerTradePercent.toFixed(2),
      maxPositionPercent: input.maxPositionPercent.toFixed(2),
      stopAtrMultiplier: input.stopAtrMultiplier.toFixed(2),
      rewardRiskRatio: input.rewardRiskRatio.toFixed(2),
      alertOnRiskBreach: input.alertOnRiskBreach,
    },
  });
  return getRiskSettings(userId);
}

export async function listMarketAssets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketAssets).where(eq(marketAssets.userId, userId)).orderBy(desc(marketAssets.updatedAt));
}

export async function saveMarketAsset(userId: number, input: { symbol: string; label?: string; assetClass: "equity" | "crypto" | "etf" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const symbol = input.symbol.trim().toUpperCase();
  await db.insert(marketAssets).values({ userId, symbol, label: input.label?.trim() || null, assetClass: input.assetClass, active: true })
    .onDuplicateKeyUpdate({ set: { label: input.label?.trim() || null, assetClass: input.assetClass, active: true } });
  return (await db.select().from(marketAssets).where(and(eq(marketAssets.userId, userId), eq(marketAssets.symbol, symbol))).limit(1))[0];
}

export async function getAnalysisSchedule(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(analysisSchedules).where(eq(analysisSchedules.userId, userId)).limit(1))[0];
}

export async function getScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(analysisSchedules).where(eq(analysisSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function saveAnalysisSchedule(input: {
  userId: number;
  enabled: boolean;
  cronExpression: string;
  emailAlertsEnabled: boolean;
  scheduleCronTaskUid: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(analysisSchedules).values(input).onDuplicateKeyUpdate({
    set: {
      enabled: input.enabled,
      cronExpression: input.cronExpression,
      emailAlertsEnabled: input.emailAlertsEnabled,
      scheduleCronTaskUid: input.scheduleCronTaskUid,
    },
  });
  return getAnalysisSchedule(input.userId);
}

export async function storeAnalysisSignal(input: { userId: number; assetId: number; analysis: SignalAnalysis }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(analysisSignals).values({
    userId: input.userId,
    assetId: input.assetId,
    direction: input.analysis.direction,
    strength: input.analysis.strength,
    dataCoverage: input.analysis.dataCoverage,
    reasons: input.analysis.reasons,
    limitations: input.analysis.limitations,
    indicators: input.analysis.indicators ?? null,
  });
}

export async function getLatestMt5DemoConnection() {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(mt5DemoConnections).orderBy(desc(mt5DemoConnections.lastSyncAtMs)).limit(1))[0] ?? null;
}

export async function upsertMt5DemoConnection(payload: Mt5DemoPayload) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(mt5DemoConnections).values({
    broker: payload.broker,
    server: payload.server,
    accountLogin: payload.accountLogin,
    equity: payload.equity.toFixed(2),
    balance: payload.balance.toFixed(2),
    leverage: payload.leverage,
    lastSyncAtMs: payload.syncedAtMs,
    payload,
  });
}

export async function upsertMt5DemoBars(accountLogin: string, bars: Mt5DemoPayload["bars"]) {
  if (bars.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  for (const bar of bars) {
    await db.insert(mt5DemoBars).values({
      accountLogin,
      symbol: bar.symbol.toUpperCase(),
      timeframe: bar.timeframe,
      capturedAtMs: bar.timestamp,
      open: bar.open.toFixed(6),
      high: bar.high.toFixed(6),
      low: bar.low.toFixed(6),
      close: bar.close.toFixed(6),
      volume: bar.volume === undefined ? null : bar.volume.toFixed(2),
    }).onDuplicateKeyUpdate({ set: {
      open: bar.open.toFixed(6), high: bar.high.toFixed(6), low: bar.low.toFixed(6), close: bar.close.toFixed(6), volume: bar.volume === undefined ? null : bar.volume.toFixed(2),
    } });
  }
}

export async function getMt5DemoBars(accountLogin: string, symbol: string, timeframe = "D1") {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(mt5DemoBars).where(and(eq(mt5DemoBars.accountLogin, accountLogin), eq(mt5DemoBars.symbol, symbol.toUpperCase()), eq(mt5DemoBars.timeframe, timeframe))).orderBy(mt5DemoBars.capturedAtMs).limit(10_000);
  return rows.map(row => ({ timestamp: row.capturedAtMs, open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: row.volume === null ? undefined : Number(row.volume) }));
}
