import { bigint, boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const marketAssets = mysqlTable("market_assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  label: varchar("label", { length: 80 }),
  assetClass: mysqlEnum("assetClass", ["equity", "crypto", "etf"]).default("equity").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("market_assets_user_symbol_unique").on(table.userId, table.symbol),
  index("market_assets_user_active_idx").on(table.userId, table.active),
]);

export const marketSnapshots = mysqlTable("market_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  capturedAtMs: bigint("capturedAtMs", { mode: "number" }).notNull(),
  open: decimal("open", { precision: 16, scale: 6 }).notNull(),
  high: decimal("high", { precision: 16, scale: 6 }).notNull(),
  low: decimal("low", { precision: 16, scale: 6 }).notNull(),
  close: decimal("close", { precision: 16, scale: 6 }).notNull(),
  volume: decimal("volume", { precision: 22, scale: 2 }),
}, table => [index("market_snapshots_asset_time_idx").on(table.assetId, table.capturedAtMs)]);

export const analysisSignals = mysqlTable("analysis_signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId").notNull(),
  direction: mysqlEnum("direction", ["bullish", "bearish", "neutral", "insufficient_data"]).notNull(),
  strength: int("strength").notNull(),
  dataCoverage: int("dataCoverage").notNull(),
  reasons: json("reasons").$type<string[]>().notNull(),
  limitations: json("limitations").$type<string[]>().notNull(),
  indicators: json("indicators").$type<Record<string, number | undefined>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("analysis_signals_user_asset_created_idx").on(table.userId, table.assetId, table.createdAt)]);

export const riskSettings = mysqlTable("risk_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accountEquity: decimal("accountEquity", { precision: 16, scale: 2 }).notNull(),
  riskPerTradePercent: decimal("riskPerTradePercent", { precision: 5, scale: 2 }).notNull(),
  maxPositionPercent: decimal("maxPositionPercent", { precision: 5, scale: 2 }).notNull(),
  stopAtrMultiplier: decimal("stopAtrMultiplier", { precision: 5, scale: 2 }).notNull(),
  rewardRiskRatio: decimal("rewardRiskRatio", { precision: 5, scale: 2 }).notNull(),
  alertOnRiskBreach: boolean("alertOnRiskBreach").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("risk_settings_user_unique").on(table.userId)]);

export const analysisSchedules = mysqlTable("analysis_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  cronExpression: varchar("cronExpression", { length: 80 }).default("0 0 9 * * 1-5").notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  emailAlertsEnabled: boolean("emailAlertsEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("analysis_schedules_user_unique").on(table.userId), index("analysis_schedules_task_uid_idx").on(table.scheduleCronTaskUid)]);

export const paperOrders = mysqlTable("paper_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  quantity: int("quantity").notNull(),
  status: varchar("status", { length: 40 }).notNull(),
  brokerOrderId: varchar("brokerOrderId", { length: 80 }),
  payload: json("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("paper_orders_user_created_idx").on(table.userId, table.createdAt)]);

export const mt5DemoConnections = mysqlTable("mt5_demo_connections", {
  id: int("id").autoincrement().primaryKey(),
  broker: varchar("broker", { length: 80 }).notNull(),
  server: varchar("server", { length: 120 }).notNull(),
  accountLogin: varchar("accountLogin", { length: 64 }).notNull(),
  equity: decimal("equity", { precision: 16, scale: 2 }).notNull(),
  balance: decimal("balance", { precision: 16, scale: 2 }).notNull(),
  leverage: int("leverage").notNull(),
  lastSyncAtMs: bigint("lastSyncAtMs", { mode: "number" }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("mt5_demo_connections_last_sync_idx").on(table.lastSyncAtMs)]);

export const mt5DemoBars = mysqlTable("mt5_demo_bars", {
  id: int("id").autoincrement().primaryKey(),
  accountLogin: varchar("accountLogin", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 30 }).notNull(),
  timeframe: varchar("timeframe", { length: 12 }).notNull(),
  capturedAtMs: bigint("capturedAtMs", { mode: "number" }).notNull(),
  open: decimal("open", { precision: 16, scale: 6 }).notNull(),
  high: decimal("high", { precision: 16, scale: 6 }).notNull(),
  low: decimal("low", { precision: 16, scale: 6 }).notNull(),
  close: decimal("close", { precision: 16, scale: 6 }).notNull(),
  volume: decimal("volume", { precision: 22, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("mt5_demo_bars_unique").on(table.accountLogin, table.symbol, table.timeframe, table.capturedAtMs),
  index("mt5_demo_bars_lookup_idx").on(table.accountLogin, table.symbol, table.timeframe, table.capturedAtMs),
]);

export const backtestRuns = mysqlTable("backtest_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetId: int("assetId"),
  startAtMs: bigint("startAtMs", { mode: "number" }).notNull(),
  endAtMs: bigint("endAtMs", { mode: "number" }).notNull(),
  slippageBps: int("slippageBps").notNull(),
  metrics: json("metrics").$type<Record<string, unknown>>().notNull(),
  limitations: json("limitations").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("backtest_runs_user_created_idx").on(table.userId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
