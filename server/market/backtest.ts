import type { BacktestResult, BacktestTrade, MarketBar } from "../../shared/market";
import { analyzeBars, type RiskSettingsInput, validateBars } from "./analysis";

export type BacktestConfig = RiskSettingsInput & {
  slippageBps: number;
  maximumHoldingBars: number;
};

function fillPrice(price: number, direction: "long" | "short", isEntry: boolean, slippageBps: number) {
  const multiplier = slippageBps / 10_000;
  const adverse = direction === "long" ? (isEntry ? 1 + multiplier : 1 - multiplier) : (isEntry ? 1 - multiplier : 1 + multiplier);
  return price * adverse;
}

export function runBacktest(input: MarketBar[], config: BacktestConfig): BacktestResult {
  const bars = validateBars(input);
  const trades: BacktestTrade[] = [];
  const warmup = 60;
  let index = warmup;

  while (index < bars.length - 1) {
    const history = bars.slice(0, index + 1);
    const analysis = analyzeBars(history, config);
    if (analysis.direction !== "bullish" && analysis.direction !== "bearish" || !analysis.riskPlan) {
      index += 1;
      continue;
    }

    const direction = analysis.direction === "bullish" ? "long" : "short";
    const entryBar = bars[index + 1];
    const entryPrice = fillPrice(entryBar.open, direction, true, config.slippageBps);
    const stop = analysis.riskPlan.stopLoss;
    const target = analysis.riskPlan.takeProfit;
    const finalIndex = Math.min(bars.length - 1, index + 1 + config.maximumHoldingBars);
    let exitIndex = finalIndex;
    let exitPrice = bars[finalIndex].close;
    let exitReason: BacktestTrade["exitReason"] = "time";

    for (let cursor = index + 1; cursor <= finalIndex; cursor += 1) {
      const bar = bars[cursor];
      if (direction === "long" && bar.low <= stop) {
        exitIndex = cursor;
        exitPrice = stop;
        exitReason = "stop";
        break;
      }
      if (direction === "short" && bar.high >= stop) {
        exitIndex = cursor;
        exitPrice = stop;
        exitReason = "stop";
        break;
      }
      if (direction === "long" && bar.high >= target) {
        exitIndex = cursor;
        exitPrice = target;
        exitReason = "target";
        break;
      }
      if (direction === "short" && bar.low <= target) {
        exitIndex = cursor;
        exitPrice = target;
        exitReason = "target";
        break;
      }
    }

    const adjustedExit = fillPrice(exitPrice, direction, false, config.slippageBps);
    const returnPercent = direction === "long"
      ? ((adjustedExit - entryPrice) / entryPrice) * 100
      : ((entryPrice - adjustedExit) / entryPrice) * 100;
    trades.push({
      entryTimestamp: entryBar.timestamp,
      exitTimestamp: bars[exitIndex].timestamp,
      direction,
      entryPrice,
      exitPrice: adjustedExit,
      returnPercent,
      exitReason,
    });
    index = exitIndex + 1;
  }

  if (trades.length === 0) {
    return {
      barCount: bars.length,
      tradeCount: 0,
      winRate: null,
      cumulativeReturnPercent: null,
      maxDrawdownPercent: null,
      slippageBps: config.slippageBps,
      trades,
      limitations: [
        "لم تُنتج القواعد صفقات خلال الفترة؛ لا يجب تفسير ذلك كإثبات صلاحية أو فشل الاستراتيجية.",
        "تم احتساب الدخول في افتتاح الشمعة التالية للإشارة لتقليل تسرب المعلومات المستقبلية.",
      ],
    };
  }

  let equity = 1;
  let highWaterMark = 1;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity *= 1 + trade.returnPercent / 100;
    highWaterMark = Math.max(highWaterMark, equity);
    maxDrawdown = Math.min(maxDrawdown, ((equity - highWaterMark) / highWaterMark) * 100);
  }
  const winners = trades.filter(trade => trade.returnPercent > 0).length;
  return {
    barCount: bars.length,
    tradeCount: trades.length,
    winRate: (winners / trades.length) * 100,
    cumulativeReturnPercent: (equity - 1) * 100,
    maxDrawdownPercent: maxDrawdown,
    slippageBps: config.slippageBps,
    trades,
    limitations: [
      "هذه نتيجة تاريخية افتراضية وليست توقعاً للأداء المستقبلي أو ضماناً للعائد.",
      "تم تطبيق انزلاق ثابت؛ السبريد والسيولة وأثر السوق قد تكون أسوأ في التنفيذ التجريبي أو الحقيقي.",
      "المحاكاة لا تشمل العمولات أو الضرائب أو انقطاعات البيانات أو أحداث الأخبار الفجائية.",
      "الدخول يُقيّم عند إغلاق الشمعة ويُحاكى عند افتتاح الشمعة التالية لتجنب استخدام معلومة مستقبلية.",
    ],
  };
}
