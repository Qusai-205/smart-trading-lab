export type MarketBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type SignalDirection = "bullish" | "bearish" | "neutral" | "insufficient_data";

export type RiskPlan = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  stopDistance: number;
  maximumRiskAmount: number;
  maximumPositionValue: number;
  estimatedUnits: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
};

export type SignalAnalysis = {
  direction: SignalDirection;
  strength: number;
  confidenceLabel: string;
  dataCoverage: number;
  latestClose?: number;
  timestamp?: number;
  reasons: string[];
  limitations: string[];
  indicators?: {
    fastSma: number;
    slowSma: number;
    rsi14: number;
    atr14: number;
    volumeRatio?: number;
  };
  riskPlan?: RiskPlan;
};

export type BacktestTrade = {
  entryTimestamp: number;
  exitTimestamp: number;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
  exitReason: "stop" | "target" | "time" | "signal";
};

export type BacktestResult = {
  barCount: number;
  tradeCount: number;
  winRate: number | null;
  cumulativeReturnPercent: number | null;
  maxDrawdownPercent: number | null;
  slippageBps: number;
  trades: BacktestTrade[];
  limitations: string[];
};
