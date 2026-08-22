import { describe, expect, it } from "vitest";
import { validateCronExpression } from "./scheduleValidation";

describe("scheduled market scan validation", () => {
  it("accepts a six-field UTC cron schedule with no sub-minute scanning", () => {
    expect(validateCronExpression("0 0 9 * * 1-5")).toBe("0 0 9 * * 1-5");
  });

  it("rejects five-field schedules and non-zero seconds", () => {
    expect(() => validateCronExpression("0 9 * * 1-5")).toThrow("6 حقول");
    expect(() => validateCronExpression("30 0 9 * * 1-5")).toThrow("حقل الثواني 0");
  });
});
