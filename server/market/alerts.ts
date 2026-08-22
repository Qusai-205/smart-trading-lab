export type MarketAlertEmail = {
  to: string;
  subject: string;
  headline: string;
  summary: string;
  details: string[];
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

export function buildMarketAlertEmail(input: MarketAlertEmail) {
  const safeDetails = input.details.map(detail => `<li style="margin:0 0 8px">${escapeHtml(detail)}</li>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#081327;color:#e7edf7;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#10223e"><p style="margin:0 0 10px;color:#98e7d2;font-size:13px">مختبر التداول الذكي · Alpaca Paper فقط</p><h1 style="margin:0;color:#fff;font-size:22px">${escapeHtml(input.headline)}</h1><p style="margin:16px 0;color:#c0ccde;line-height:1.8">${escapeHtml(input.summary)}</p><ul style="margin:0;padding-right:20px;color:#dce5f3;line-height:1.7">${safeDetails}</ul><div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);font-size:12px;line-height:1.7;color:#94a5be">هذه رسالة تحليل ومحاكاة فقط، وليست نصيحة مالية أو ضماناً للعائد. لا يتم تنفيذ تداول حي من هذا النظام.</div></div></div></body></html>`;
}

export async function sendMarketAlertEmail(input: MarketAlertEmail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { delivered: false, reason: "not-configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: buildMarketAlertEmail(input) }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`فشل إرسال بريد التنبيه (${response.status}): ${message || response.statusText}`);
  }
  return { delivered: true, payload: await response.json().catch(() => ({})) };
}

function escapeHtml(input: string) {
  return input.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}
