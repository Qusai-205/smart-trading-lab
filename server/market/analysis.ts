import type { MarketBar, RiskPlan, SignalAnalysis, SignalDirection } from "../../shared/market";

export type RiskSettingsInput = {
  accountEquity: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
  stopAtrMultiplier: number;
  rewardRiskRatio: number;
};

const MINIMUM_BARS = 60;

function finite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} يجب أن يكون رقماً صالحاً.`);
  return value;
}

export function validateBars(input: MarketBar[]): MarketBar[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("لا توجد بيانات سوق للتحليل.");
  const bars = [...input]
    .map(bar => ({
      ...bar,
      timestamp: finite(bar.timestamp, "الطابع الزمني"),
      open: finite(bar.open, "سعر الافتتاح"),
      high: finite(bar.high, "أعلى سعر"),
      low: finite(bar.low, "أدنى سعر"),
      close: finite(bar.close, "سعر الإغلاق"),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (bar.low > bar.high || bar.close < bar.low || bar.close > bar.high || bar.open < bar.low || bar.open > bar.high) {
      throw new Error("بيانات الشمعة غير متسقة؛ تم إيقاف التحليل بدلاً من توليد إشارة مضللة.");
    }
    if (index > 0 && bars[index - 1].timestamp === bar.timestamp) {
      throw new Error("توجد شموع مكررة بالتوقيت نفسه؛ يجب تنظيف البيانات أولاً.");
    }
  }
  return bars;
}

export function sma(values: number[], period: number): number {
  if (values.length < period) throw new Error(`يلزم ${period} نقاط على الأقل لحساب المتوسط المتحرك.`);
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) throw new Error(`يلزم ${period + 1} إغلاقاً على الأقل لحساب RSI.`);
  const changes = values.slice(-(period + 1)).slice(1).map((value, index) => value - values.slice(-(period + 1))[index]);
  const gains = changes.map(change => Math.max(change, 0));
  const losses = changes.map(change => Math.max(-change, 0));
  const avgGain = gains.reduce((sum, value) => sum + value, 0) / period;
  const avgLoss = losses.reduce((sum, value) => sum + value, 0) / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function atr(bars: MarketBar[], period = 14): number {
  if (bars.length < period + 1) throw new Error(`يلزم ${period + 1} شموع على الأقل لحساب ATR.`);
  const relevant = bars.slice(-(period + 1));
  const ranges = relevant.slice(1).map((bar, index) => {
    const previousClose = relevant[index].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
  });
  return ranges.reduce((sum, value) => sum + value, 0) / period;
}

export function calculateRiskPlan(
  entry: number,
  direction: Exclude<SignalDirection, "insufficient_data" | "neutral">,
  atrValue: number,
  settings: RiskSettingsInput,
): RiskPlan | undefined {
  if (atrValue <= 0 || entry <= 0 || settings.accountEquity <= 0) return undefined;
  const stopDistance = atrValue * settings.stopAtrMultiplier;
  const stopLoss = direction === "bullish" ? entry - stopDistance : entry + stopDistance;
  if (stopLoss <= 0) return undefined;

  const maximumRiskAmount = settings.accountEquity * (settings.riskPerTradePercent / 100);
  const unitRisk = Math.abs(entry - stopLoss);
  const unitsFromRisk = Math.floor(maximumRiskAmount / unitRisk);
  const maximumPositionValue = settings.accountEquity * (settings.maxPositionPercent / 100);
  const unitsFromExposure = Math.floor(maximumPositionValue / entry);
  const estimatedUnits = Math.max(0, Math.min(unitsFromRisk, unitsFromExposure));
  const takeProfit = direction === "bullish"
    ? entry + stopDistance * settings.rewardRiskRatio
    : entry - stopDistance * settings.rewardRiskRatio;

  return {
    entry,
    stopLoss,
    takeProfit,
    stopDistance,
    maximumRiskAmount,
    maximumPositionValue,
    estimatedUnits,
    riskPerTradePercent: settings.riskPerTradePercent,
    maxPositionPercent: settings.maxPositionPercent,
  };
}

export function analyzeBars(input: MarketBar[], settings: RiskSettingsInput): SignalAnalysis {
  const bars = validateBars(input);
  const latest = bars.at(-1)!;
  const baseLimitations = [
    "قوة الإشارة قياس لاتفاق المؤشرات وتغطية البيانات، وليست احتمال نجاح أو ضمان عائد.",
    "المؤشرات الفنية لا تلتقط الأخبار المفاجئة أو فجوات الافتتاح أو تغير النظام السوقي.",
    "يجب مراجعة السبريد والسيولة والانزلاق قبل أي قرار تجريبي.",
  ];

  if (bars.length < MINIMUM_BARS) {
    return {
      direction: "insufficient_data",
      strength: 0,
      confidenceLabel: "لا توجد تغطية كافية",
      dataCoverage: Math.round((bars.length / MINIMUM_BARS) * 100),
      latestClose: latest.close,
      timestamp: latest.timestamp,
      reasons: [`تتوفر ${bars.length} شموع فقط بينما يلزم ${MINIMUM_BARS} شمعة على الأقل للتحليل الحالي.`],
      limitations: [...baseLimitations, "تم حجب الإشارة لتجنب استنتاج من عينة زمنية قصيرة."],
    };
  }

  const closes = bars.map(bar => bar.close);
  const fastSma = sma(closes, 20);
  const slowSma = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(bars, 14);
  const volumeValues = bars.map(bar => bar.volume).filter((value): value is number => typeof value === "number" && value > 0);
  const volumeRatio = volumeValues.length >= 20 ? latest.volume ? latest.volume / sma(volumeValues, 20) : undefined : undefined;

  const trend = fastSma > slowSma ? 1 : fastSma < slowSma ? -1 : 0;
  const rsiBias = rsi14 >= 56 ? 1 : rsi14 <= 44 ? -1 : 0;
  const closeBias = latest.close > fastSma ? 1 : latest.close < fastSma ? -1 : 0;
  const rawBias = trend * 2 + rsiBias + closeBias;
  const direction: SignalDirection = rawBias >= 2 ? "bullish" : rawBias <= -2 ? "bearish" : "neutral";
  const agreements = [trend !== 0, rsiBias !== 0 && Math.sign(rsiBias) === Math.sign(trend || rsiBias), closeBias !== 0 && Math.sign(closeBias) === Math.sign(trend || closeBias)].filter(Boolean).length;
  const volumeQuality = volumeRatio === undefined ? 0 : volumeRatio >= 1 ? 1 : 0;
  const strength = direction === "neutral" ? Math.min(45, 20 + agreements * 8) : Math.min(80, 35 + agreements * 12 + volumeQuality * 7);
  const reasons = [
    `المتوسط المتحرك لـ20 فترة (${fastSma.toFixed(2)}) ${fastSma >= slowSma ? "فوق" : "تحت"} المتوسط لـ50 فترة (${slowSma.toFixed(2)}).`,
    `مؤشر القوة النسبية RSI(14) عند ${rsi14.toFixed(1)}؛ تمت قراءته كزخم، لا كضمان اتجاه.`,
    `الإغلاق الأخير (${latest.close.toFixed(2)}) ${latest.close >= fastSma ? "أعلى" : "أدنى"} متوسط 20 فترة.`,
  ];
  if (volumeRatio !== undefined) reasons.push(`حجم آخر شمعة يساوي ${(volumeRatio * 100).toFixed(0)}% من متوسط حجم 20 فترة.`);

  return {
    direction,
    strength,
    confidenceLabel: direction === "neutral" ? "اتفاق محدود" : strength >= 65 ? "اتفاق مؤشرات متوسط" : "اتفاق مؤشرات محدود",
    dataCoverage: 100,
    latestClose: latest.close,
    timestamp: latest.timestamp,
    reasons,
    limitations: baseLimitations,
    indicators: { fastSma, slowSma, rsi14, atr14, volumeRatio },
    riskPlan: direction === "bullish" || direction === "bearish" ? calculateRiskPlan(latest.close, direction, atr14, settings) : undefined,
  };
}
