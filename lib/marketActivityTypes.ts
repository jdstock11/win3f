export interface MostActiveOptionRow {
  symbol: string;
  optionType: 'CE' | 'PE';
  strikePrice: number;
  expiryDate: string;
  volume: number;
  openInterest: number;
  changeInOI: number;
  ltp: number;
  premiumTurnover?: number;
}

export interface GroupedMarketData {
  symbol: string;
  records: MostActiveOptionRow[];
  analytics: MarketAnalytics;
}

export interface MarketAnalytics {
  totalCEOI: number;
  totalPEOI: number;
  pcr: number;
  highestCEOI: { strike: number; oi: number };
  highestPEOI: { strike: number; oi: number };
  highestCEVolume: { strike: number; vol: number };
  highestPEVolume: { strike: number; vol: number };
  support: number;
  resistance: number;
  marketBias: 'Bullish' | 'Bearish' | 'Neutral';
  smartMoneyBias: 'Bullish' | 'Bearish' | 'Neutral';
  centerOfGravity: number;
  institutionalActivityScore: number;
  bullishBearishRanking: number; // 0 to 100
  callActivity: string; // e.g. "Call Writing", "Call Buying"
  putActivity: string; // e.g. "Put Writing", "Put Buying"
}
