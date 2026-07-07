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
  oi: number;
  oiChange: number;
  volume: number;
  volumeChange: number | "N/A";
  premiumChange: number | "N/A";
  suggestedAction: string;
}

export interface SupportResistanceLevel {
  strikePrice: number;
  strength: number;
  type: "Support" | "Resistance";
  method: "Max OI" | "Max Change in OI";
}

// AI ENGINE TYPES
export type TradeQuality = "Excellent" | "Good" | "Average" | "Weak";

export interface ScoreComponent {
  score: number;
  confidence: number;
  reason: string;
}

export interface ScoreEngineResult {
  pcr: ScoreComponent;         // Max 20
  oi: ScoreComponent;          // Max 20
  smartMoney: ScoreComponent;  // Max 15
  support: ScoreComponent;     // Max 10
  resistance: ScoreComponent;  // Max 10
  volume: ScoreComponent;      // Max 10
  historical: ScoreComponent;  // Max 15
  marketStructure: ScoreComponent; // Max 10
  
  bullishTotal: number;
  bearishTotal: number;
  neutralTotal: number;
  
  quality: TradeQuality;
}

export interface TradeExecutionPlan {
  bias: "Bullish" | "Bearish" | "Neutral";
  qualityScore: number;
  expectedRange: {
    lowerBound: number;
    upperBound: number;
  };
  preferredStrategy: string;
  suggestedEntry: string;
  confirmationRule: string;
  suggestedStopLoss: string;
  target1: string;
  target2: string;
  risk: string;
  reward: string;
  riskReward: string;
  confidence: number;
  reasons: string[];
}

export interface AvoidTradeZone {
  lowerBound: number;
  upperBound: number;
  reason: string;
}

export interface AiStrategy extends TradeExecutionPlan {
  avoidTradeZone: AvoidTradeZone;
  institutionalConclusion: InstitutionalConclusion;
}

export interface HistoricalSimilarity {
  matchedOccurrences: number;
  breakdown: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  averageNextDayMove: string;
  bestOutcome: string;
  worstOutcome: string;
  topMatches: string[];
  historicalSuccessRatio: number; // %
  confidenceScore: number;
}

export interface OIInterpretationDetails {
  currentOI: number;
  previousOI: number | "N/A";
  oiChange: number;
  currentPremium: number;
  previousPremium: number | "N/A";
  premiumChange: number | "N/A";
  volume: number;
  volumeChange: number | "N/A";
  classificationLogic: string;
  reasoning: string;
}

export interface TopOIRow {
  strike: number;
  oi: number;
  oiChange: number;
  volume: number;
  volumeChange: number | "N/A";
  premiumChange: number | "N/A";
  classification: string;
  confidence: string;
  evidence: string;
  suggestedAction: string;
  riskLevel: string;
  details: OIInterpretationDetails;
}

export interface TopOIAdditionsReductions {
  ceAdditions: TopOIRow[];
  peAdditions: TopOIRow[];
  ceReductions: TopOIRow[];
  peReductions: TopOIRow[];
}

export interface VolatilityExpectedMove {
  atmStrike: number;
  straddlePremium: number | "N/A";
  expectedDailyMove: number | "N/A";
  impliedRangeUpper: number | "N/A";
  impliedRangeLower: number | "N/A";
}

export interface DailyPCRRow {
  date: string;
  ceOI: number;
  peOI: number;
  pcr: number;
  dailyChange: number | "N/A";
  interpretation: string;
}

export interface InstitutionalConclusion {
  marketBias: string;
  confidence: number;
  keyReasons: string[];
  bestStrategy: string;
  conservativeApproach: string;
  aggressiveApproach: string;
  riskWarnings: string[];
  explanation: string;
}
