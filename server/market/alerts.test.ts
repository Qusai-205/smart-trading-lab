import { describe, expect, it } from "vitest";
import { buildMarketAlertEmail } from "./alerts";

describe("market email alerts", () => {
  it("escapes dynamic text and includes the paper-only safety boundary", () => {
    const html = buildMarketAlertEmail({
      to: "person@example.com",
      subject: "تحليل",
      headline: "إشارة <تجريبية>",
      summary: "لا يوجد تداول حي",
      details: ["AAPL & SL"],
    });
    expect(html).toContain("إشارة &lt;تجريبية&gt;");
    expect(html).toContain("AAPL &amp; SL");
    expect(html).toContain("Alpaca Paper فقط");
  });
});
