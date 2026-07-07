export interface RawNSEOptionRow {
  Symbol: string;
  Date: string;
  Expiry: string;
  "Option type": string;
  "Strike Price": string;
  Open: string;
  High: string;
  Low: string;
  Close: string;
  LTP: string;
  "Settle Price": string;
  "No. of contracts": string;
  "Turnover * in  ₹ Lakhs": string;
  "Premium Turnover ** in   ₹ Lakhs": string;
  "Open Int": string;
  "Change in OI": string;
  "Underlying Value": string;
}

export interface OptionDataPoint {
  strikePrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  ltp: number;
  volume: number;
  openInterest: number;
  changeInOI: number;
  underlyingValue: number;
}

export interface OptionChainRow {
  strikePrice: number;
  underlyingValue: number;
  CE: OptionDataPoint | null;
  PE: OptionDataPoint | null;
}

export interface MergedDailyData {
  date: string;
  expiry: string;
  chain: OptionChainRow[];
}

export interface MarketBias {
  bias: "Bullish" | "Bearish" | "Neutral";
  score: number;
}

export interface ProbabilityResult {
  bullish: number;
  bearish: number;
  sideways: number;
  confidenceScore: number;
  expectedRange: {
    lowerBound: number;
    upperBound: number;
  };
  bias: MarketBias;
}

export interface OIShiftAnalysis {
  strikePrice: number;
  type: "Fresh Call Writing" | "Fresh Put Writing" | "Call Unwinding" | "Put Unwinding" | "Long Build-up" | "Short Build-up" | "None";
  intensity: number;
  volume: number;
}

export interface SmartMoneyFlow {
  strikePrice: number;
  type: "Institutional Call Writing" | "Institutional Put Writing" | "Institutional Call Buying" | "Institutional Put Buying" | "Normal";
  confidence: number;
}

export interface SupportResistanceLevel {
  strikePrice: number;
  strength: number; // based on OI or Change in OI
  type: "Support" | "Resistance";
  method: "Max OI" | "Max Change in OI";
}

// AI ENGINE TYPES
export type TradeQuality = "Excellent" | "Good" | "Average" | "Weak";

export interface ScoreEngineResult {
  pcrScore: number;         // Max 20
  oiScore: number;          // Max 20
  smartMoneyScore: number;  // Max 15
  supportScore: number;     // Max 10
  resistanceScore: number;  // Max 10
  volumeScore: number;      // Max 10
  historicalScore: number;  // Max 15
  marketStructureScore: number; // Max 10
  
  bullishTotal: number;
  bearishTotal: number;
  neutralTotal: number;
  
  quality: TradeQuality;
}

export interface AiStrategy {
  bias: "Bullish" | "Bearish" | "Neutral";
  qualityScore: number;
  expectedRange: {
    lowerBound: number;
    upperBound: number;
  };
  preferredStrategy: string;
  suggestedEntry: string;
  suggestedStopLoss: string;
  target1: string;
  target2: string;
  riskReward: string;
  reasons: string[];
}

export interface HistoricalSimilarity {
  matchedOccurrences: number;
  averageNextDayMove: string;
  historicalSuccessRatio: number; // %
}
