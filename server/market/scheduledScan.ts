import type { Request, Response } from "express";
import { getScheduleByTaskUid, getUserById } from "../db";
import { sdk } from "../_core/sdk";
import { sendMarketAlertEmail } from "./alerts";
import { getMt5DemoStatus } from "./mt5Demo";

export async function runScheduledMarketScan(req: Request, res: Response) {
  const timestamp = new Date().toISOString();
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await getScheduleByTaskUid(cronUser.taskUid);
    if (!schedule || !schedule.enabled) return res.json({ ok: true, skipped: "orphan-or-disabled" });

    const status = await getMt5DemoStatus();
    if (!status.configured) return res.json({ ok: true, skipped: "mt5-demo-bridge-not-configured" });
    if (!status.connection) return res.json({ ok: true, skipped: "mt5-demo-not-synced" });

    const user = await getUserById(schedule.userId);
    if (schedule.emailAlertsEnabled && user?.email) {
      await sendMarketAlertEmail({
        to: user.email,
        subject: "مختبر التداول الذكي: اكتملت مراجعة MT5 Demo",
        headline: "اكتملت مراجعة اتصال MT5 Demo",
        summary: "تم التحقق من آخر ملخص متاح لحساب Equiti MT5 التجريبي. لا يتم إرسال أوامر أو فتح مراكز من هذا الفحص.",
        details: [
          `الخادم: ${status.connection.server}.`,
          `قيمة الحساب: ${status.connection.equity}.`,
          `آخر مزامنة: ${new Date(status.connection.lastSyncAtMs).toISOString()}.`,
        ],
      });
    }
    return res.json({ ok: true, environment: "demo-only", syncedAtMs: status.connection.lastSyncAtMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ScheduledMarketScan]", message);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp });
  }
}
