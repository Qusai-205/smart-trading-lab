import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { DEFAULT_RISK_SETTINGS, getAnalysisSchedule, getMt5DemoBars, getRiskSettings, listMarketAssets, saveAnalysisSchedule, saveMarketAsset, saveRiskSettings } from "./db";
import { getMt5DemoStatus } from "./market/mt5Demo";
import { analyzeBars } from "./market/analysis";
import { runBacktest } from "./market/backtest";
import { validateCronExpression } from "./market/scheduleValidation";

const riskInput = z.object({
  accountEquity: z.number().finite().min(100).max(10_000_000),
  riskPerTradePercent: z.number().finite().min(0.1).max(2),
  maxPositionPercent: z.number().finite().min(1).max(50),
  stopAtrMultiplier: z.number().finite().min(0.5).max(5),
  rewardRiskRatio: z.number().finite().min(1).max(5),
  alertOnRiskBreach: z.boolean(),
});

function normalizeRiskSettings(value: Awaited<ReturnType<typeof getRiskSettings>>) {
  if (!value) return DEFAULT_RISK_SETTINGS;
  return {
    accountEquity: Number(value.accountEquity),
    riskPerTradePercent: Number(value.riskPerTradePercent),
    maxPositionPercent: Number(value.maxPositionPercent),
    stopAtrMultiplier: Number(value.stopAtrMultiplier),
    rewardRiskRatio: Number(value.rewardRiskRatio),
    alertOnRiskBreach: value.alertOnRiskBreach,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  market: router({
    assets: router({
      list: protectedProcedure.query(({ ctx }) => listMarketAssets(ctx.user.id)),
      save: protectedProcedure.input(z.object({
        symbol: z.string().trim().regex(/^[A-Za-z0-9.\-/]{1,20}$/),
        label: z.string().trim().max(80).optional(),
        assetClass: z.enum(["equity", "crypto", "etf"]),
      })).mutation(({ ctx, input }) => saveMarketAsset(ctx.user.id, input)),
    }),
    risk: router({
      get: protectedProcedure.query(async ({ ctx }) => normalizeRiskSettings(await getRiskSettings(ctx.user.id))),
      save: protectedProcedure.input(riskInput).mutation(async ({ ctx, input }) => normalizeRiskSettings(await saveRiskSettings(ctx.user.id, input))),
    }),
  }),
  mt5: router({
    status: protectedProcedure.query(() => getMt5DemoStatus()),
    analyze: protectedProcedure.input(z.object({ symbol: z.string().trim().regex(/^[A-Za-z0-9._-]{1,30}$/), timeframe: z.enum(["M15", "H1", "H4", "D1"]).default("D1") })).mutation(async ({ ctx, input }) => {
      const status = await getMt5DemoStatus();
      if (!status.connection) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد مزامنة MT5 Demo بعد." });
      const bars = await getMt5DemoBars(status.connection.accountLogin, input.symbol, input.timeframe);
      const settings = normalizeRiskSettings(await getRiskSettings(ctx.user.id));
      return {
        symbol: input.symbol.toUpperCase(),
        bars: bars.length,
        signal: analyzeBars(bars, settings),
        backtest: runBacktest(bars, { ...settings, slippageBps: 5, maximumHoldingBars: 10 }),
      };
    }),
  }),
  schedules: router({
    get: protectedProcedure.query(async ({ ctx }) => (await getAnalysisSchedule(ctx.user.id)) ?? null),
    configure: protectedProcedure.input(z.object({
      enabled: z.boolean(),
      cronExpression: z.string().trim().min(11).max(80),
      emailAlertsEnabled: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      let cronExpression: string;
      try {
        cronExpression = validateCronExpression(input.cronExpression);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "صيغة جدول غير صالحة." });
      }
      const existing = await getAnalysisSchedule(ctx.user.id);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      let taskUid = existing?.scheduleCronTaskUid ?? null;
      if (input.enabled) {
        if (process.env.NODE_ENV !== "production") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يتطلب تشغيل الفحص الدوري نشر الموقع أولاً؛ لا يمكن توجيه الوظائف الدورية إلى بيئة المعاينة." });
        }
        if (taskUid) {
          await updateHeartbeatJob(taskUid, { cron: cronExpression, enable: true, description: "فحص سوق دوري للتداول التجريبي" }, sessionToken);
        } else {
          const created = await createHeartbeatJob({
            name: `market-scan-${ctx.user.id}`,
            cron: cronExpression,
            path: "/api/scheduled/market-scan",
            description: "مراجعة دورية لاتصال MT5 Demo فقط دون أوامر سوقية",
          }, sessionToken);
          taskUid = created.taskUid;
        }
      } else if (taskUid) {
        await updateHeartbeatJob(taskUid, { enable: false }, sessionToken);
      }
      return saveAnalysisSchedule({ userId: ctx.user.id, enabled: input.enabled, cronExpression, emailAlertsEnabled: input.emailAlertsEnabled, scheduleCronTaskUid: taskUid });
    }),
    requestSessionPreview: protectedProcedure.query(({ ctx }) => ({
      readyForDeployment: false,
      hasSession: Boolean(parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME]),
      message: "سيُفعل المسح الدوري فقط بعد نشر الموقع وربط موفر البريد، مع بقائه معطلاً افتراضياً.",
    })),
  }),
});

export type AppRouter = typeof appRouter;
