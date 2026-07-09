import { OptionRow } from "./StrategyEngine";

export type Signal = "Long Build-up" | "Short Build-up" | "Long Unwinding" | "Short Covering" | "Insufficient data to classify";

export interface TopSignalRow {
  strike: number;
  oi: number;
  oiChange: number | "N/A";
  vol: number;
  volChange: number | "N/A"; 
  ltp: string | number;
  premChange: number | "N/A";
  confidence: number;
  action: string;
}

export interface OptionMatrixRow {
  strike: number;
  ceOI: number;
  peOI: number;
  ceOIChange: number | "N/A";
  peOIChange: number | "N/A";
  volume: number;
  ceLTP: string | number;
  peLTP: string | number;
  ceLTPChange: number | "N/A";
  peLTPChange: number | "N/A";
  ceSignal: Signal;
  peSignal: Signal;
  supportStrength: number;
  resistanceStrength: number;
}

export interface InstitutionalPositioning {
  calls: { writing: number; buying: number; unwinding: number; covering: number };
  puts: { writing: number; buying: number; unwinding: number; covering: number };
}

// Derive signals exactly as requested
export const classifySignal = (oiChange: number | undefined, ltpChange: number | undefined): Signal => {
  if (oiChange === undefined || ltpChange === undefined || isNaN(oiChange) || isNaN(ltpChange)) return "Insufficient data to classify";
  if (ltpChange > 0 && oiChange > 0) return "Long Build-up";
  if (ltpChange < 0 && oiChange > 0) return "Short Build-up";
  if (ltpChange < 0 && oiChange < 0) return "Long Unwinding";
  if (ltpChange > 0 && oiChange < 0) return "Short Covering";
  return "Insufficient data to classify";
};

const getAction = (signal: Signal) => {
  switch (signal) {
    case "Long Build-up": return "Aggressive Buying detected";
    case "Short Build-up": return "Fresh Writing/Resistance creation";
    case "Long Unwinding": return "Bulls exiting positions";
    case "Short Covering": return "Bears trapped, potential short squeeze";
    default: return "Wait for clear signal";
  }
};

export const generateInstitutionalData = (data: OptionRow[]) => {
  const topCeWriting: TopSignalRow[] = [];
  const topPeWriting: TopSignalRow[] = [];
  const topCeBuying: TopSignalRow[] = [];
  const topPeBuying: TopSignalRow[] = [];
  const topCeUnwinding: TopSignalRow[] = [];
  const topPeUnwinding: TopSignalRow[] = [];

  const matrix: OptionMatrixRow[] = [];
  
  let ceWritingOI = 0, ceBuyingOI = 0, ceUnwindingOI = 0, ceCoveringOI = 0;
  let peWritingOI = 0, peBuyingOI = 0, peUnwindingOI = 0, peCoveringOI = 0;

  data.forEach(row => {
    const ceSignal = classifySignal(row.callOIChange, row.callLTPChange);
    const peSignal = classifySignal(row.putOIChange, row.putLTPChange);

    const ceConf = Math.min(95, Math.max(40, 50 + (Math.abs(row.callOIChange || 0) / (row.callOI || 1)) * 100));
    const peConf = Math.min(95, Math.max(40, 50 + (Math.abs(row.putOIChange || 0) / (row.putOI || 1)) * 100));

    // Matrix Row
    matrix.push({
      strike: row.strike,
      ceOI: row.callOI,
      peOI: row.putOI,
      ceOIChange: row.callOIChange !== undefined && !isNaN(row.callOIChange) ? row.callOIChange : "N/A",
      peOIChange: row.putOIChange !== undefined && !isNaN(row.putOIChange) ? row.putOIChange : "N/A",
      volume: row.callVol + row.putVol,
      ceLTP: row.callLtpRaw ?? row.callLTP,
      peLTP: row.putLtpRaw ?? row.putLTP,
      ceLTPChange: row.callLTPChange !== undefined && !isNaN(row.callLTPChange) ? row.callLTPChange : "N/A",
      peLTPChange: row.putLTPChange !== undefined && !isNaN(row.putLTPChange) ? row.putLTPChange : "N/A",
      ceSignal,
      peSignal,
      resistanceStrength: row.callOI,
      supportStrength: row.putOI
    });

    const ceObj: TopSignalRow = {
      strike: row.strike, oi: row.callOI, oiChange: row.callOIChange ?? "N/A", vol: row.callVol, volChange: "N/A", ltp: row.callLtpRaw ?? row.callLTP, premChange: row.callLTPChange ?? "N/A", confidence: ceConf, action: getAction(ceSignal)
    };
    
    const peObj: TopSignalRow = {
      strike: row.strike, oi: row.putOI, oiChange: row.putOIChange ?? "N/A", vol: row.putVol, volChange: "N/A", ltp: row.putLtpRaw ?? row.putLTP, premChange: row.putLTPChange ?? "N/A", confidence: peConf, action: getAction(peSignal)
    };

    // CE Allocations
    if (ceSignal === "Short Build-up") { topCeWriting.push(ceObj); ceWritingOI += row.callOIChange || 0; }
    else if (ceSignal === "Long Build-up") { topCeBuying.push(ceObj); ceBuyingOI += row.callOIChange || 0; }
    else if (ceSignal === "Long Unwinding") { topCeUnwinding.push(ceObj); ceUnwindingOI += Math.abs(row.callOIChange || 0); }
    else if (ceSignal === "Short Covering") { ceCoveringOI += Math.abs(row.callOIChange || 0); }

    // PE Allocations
    if (peSignal === "Short Build-up") { topPeWriting.push(peObj); peWritingOI += row.putOIChange || 0; }
    else if (peSignal === "Long Build-up") { topPeBuying.push(peObj); peBuyingOI += row.putOIChange || 0; }
    else if (peSignal === "Long Unwinding") { topPeUnwinding.push(peObj); peUnwindingOI += Math.abs(row.putOIChange || 0); }
    else if (peSignal === "Short Covering") { peCoveringOI += Math.abs(row.putOIChange || 0); }
  });

  const totalCeShift = ceWritingOI + ceBuyingOI + ceUnwindingOI + ceCoveringOI || 1;
  const totalPeShift = peWritingOI + peBuyingOI + peUnwindingOI + peCoveringOI || 1;

  const positioning: InstitutionalPositioning = {
    calls: {
      writing: (ceWritingOI / totalCeShift) * 100,
      buying: (ceBuyingOI / totalCeShift) * 100,
      unwinding: (ceUnwindingOI / totalCeShift) * 100,
      covering: (ceCoveringOI / totalCeShift) * 100
    },
    puts: {
      writing: (peWritingOI / totalPeShift) * 100,
      buying: (peBuyingOI / totalPeShift) * 100,
      unwinding: (peUnwindingOI / totalPeShift) * 100,
      covering: (peCoveringOI / totalPeShift) * 100
    }
  };

  const sortByOIChange = (a: TopSignalRow, b: TopSignalRow) => Math.abs((b.oiChange as number) || 0) - Math.abs((a.oiChange as number) || 0);

  return {
    topCeWriting: topCeWriting.sort(sortByOIChange).slice(0, 5),
    topPeWriting: topPeWriting.sort(sortByOIChange).slice(0, 5),
    topCeBuying: topCeBuying.sort(sortByOIChange).slice(0, 5),
    topPeBuying: topPeBuying.sort(sortByOIChange).slice(0, 5),
    topCeUnwinding: topCeUnwinding.sort(sortByOIChange).slice(0, 5),
    topPeUnwinding: topPeUnwinding.sort(sortByOIChange).slice(0, 5),
    matrix: matrix.sort((a,b) => a.strike - b.strike),
    positioning
  };
};

export const generateDecisionEngine = (data: OptionRow[], atm: number) => {
  let tcOI = 0, tpOI = 0;
  let maxCall = { strike: 0, oi: 0 }, maxPut = { strike: 0, oi: 0 };
  let maxPainScore = Infinity;
  let maxPainStrike = atm;

  data.forEach(r => {
    tcOI += r.callOI;
    tpOI += r.putOI;
    if (r.callOI > maxCall.oi) maxCall = { strike: r.strike, oi: r.callOI };
    if (r.putOI > maxPut.oi) maxPut = { strike: r.strike, oi: r.putOI };
  });

  data.forEach(strikeRow => {
    let loss = 0;
    data.forEach(optRow => {
      if (optRow.strike < strikeRow.strike) loss += (strikeRow.strike - optRow.strike) * optRow.callOI;
      if (optRow.strike > strikeRow.strike) loss += (optRow.strike - strikeRow.strike) * optRow.putOI;
    });
    if (loss < maxPainScore) {
      maxPainScore = loss;
      maxPainStrike = strikeRow.strike;
    }
  });

  const pcr = tpOI / (tcOI || 1);
  const isSufficientData = data.some(r => r.callOIChange !== undefined && !isNaN(r.callOIChange));
  
  let score = 50;
  if (pcr > 1.2) score += 15; else if (pcr < 0.8) score -= 15;
  if (maxPut.strike > maxCall.strike) score += 15; // aggressive bull
  
  let expectedRangeLower = maxPut.strike || atm * 0.98;
  let expectedRangeUpper = maxCall.strike || atm * 1.02;

  let maxAllowedWidth = atm > 40000 ? 200 : 80;
  let rangeWidth = expectedRangeUpper - expectedRangeLower;
  let maxWidth = Math.min(maxAllowedWidth, rangeWidth * 0.25);
  
  let maxCombinedOI = 0;
  let maxCombinedStrike = atm;
  data.forEach(r => {
    if ((r.callOI + r.putOI) > maxCombinedOI) {
      maxCombinedOI = r.callOI + r.putOI;
      maxCombinedStrike = r.strike;
    }
  });

  let isGammaPinned = Math.abs(atm - maxPainStrike) <= maxWidth && Math.abs(maxPainStrike - maxCombinedStrike) <= maxWidth;
  
  let avoidZone = null;
  if (isGammaPinned) {
    let pinCenter = (atm + maxPainStrike + maxCombinedStrike) / 3;
    avoidZone = {
      lower: Math.round(pinCenter - (maxWidth / 2)),
      upper: Math.round(pinCenter + (maxWidth / 2))
    };
  }

  let bias = "Neutral";
  if (score > 60) bias = "Bullish";
  if (score < 40) bias = "Bearish";

  let summary = "";
  if (bias === "Bullish") summary = `Heavy Put Writing observed at ${maxPut.strike}. Put Writers defending ${maxPut.strike}. PCR stands bullish at ${pcr.toFixed(2)}. Expect upward momentum towards ${maxCall.strike}.`;
  else if (bias === "Bearish") summary = `Heavy Call Writing observed at ${maxCall.strike}. Call Writers defending ${maxCall.strike}. PCR stands bearish at ${pcr.toFixed(2)}. Expect downward momentum towards ${maxPut.strike}.`;
  else summary = `Balanced option flow. Resistance at ${maxCall.strike} and Support at ${maxPut.strike}. PCR neutral at ${pcr.toFixed(2)}. Expect range-bound movement until breakout.`;

  return {
    pcr: pcr,
    previousPcr: "Insufficient data to classify",
    pcrMomentum: "Insufficient data to classify",
    pcrInterpretation: pcr > 1.2 ? "Oversold/Bullish Support" : pcr < 0.8 ? "Overbought/Bearish Resistance" : "Neutral Base",
    pcrSuggestedAction: pcr > 1.2 ? "Buy on dips" : pcr < 0.8 ? "Sell on rallies" : "Iron Condor / Range strategies",
    
    intradayScore: {
      pcr: pcr > 1.2 ? 80 : pcr < 0.8 ? 20 : 50,
      oi: score,
      smartMoney: isSufficientData ? (score > 50 ? 70 : 30) : 50,
      volume: 50,
      momentum: isSufficientData ? (score > 50 ? 60 : 40) : 50,
      support: 80,
      resistance: 80,
      totalScore: score
    },

    tradeTrigger: {
      longTrigger: `Price crosses and holds above ${avoidZone ? avoidZone.upper : expectedRangeLower + (atm * 0.001)}`,
      longConfirmation: "Wait for 15-min candle close",
      longStop: `${maxPut.strike} (Daily Close)`,
      longTarget: `${maxCall.strike}`,
      shortTrigger: `Price crosses and holds below ${avoidZone ? avoidZone.lower : expectedRangeUpper - (atm * 0.001)}`,
      shortConfirmation: "Wait for hourly rejection wick",
      shortStop: `${maxCall.strike} (Daily Close)`,
      shortTarget: `${maxPut.strike}`,
      expectedRange: `${expectedRangeLower} - ${expectedRangeUpper}`,
      avoidZone: avoidZone ? `${avoidZone.lower} to ${avoidZone.upper}` : "No major Avoid Zone detected."
    },

    institutionalSummary: summary,

    finalDecision: {
      bias,
      probability: bias === "Bullish" ? 65 : bias === "Bearish" ? 65 : 50,
      bestStrategy: bias === "Bullish" ? "Bull Call Spread" : bias === "Bearish" ? "Bear Put Spread" : "Iron Condor",
      entry: bias === "Bullish" ? `Near ${maxPut.strike}` : bias === "Bearish" ? `Near ${maxCall.strike}` : `At ${atm}`,
      stop: bias === "Bullish" ? `${maxPut.strike * 0.99}` : bias === "Bearish" ? `${maxCall.strike * 1.01}` : "Outside Range",
      target: bias === "Bullish" ? `${maxCall.strike}` : bias === "Bearish" ? `${maxPut.strike}` : "Hold for Theta",
      invalidation: `Close beyond ${bias === "Bullish" ? 'Support' : bias === 'Bearish' ? 'Resistance' : 'Max Pain range'}`,
      tradeChecklist: [
        "Verified Institutional PCR",
        "Confirmed OI Shifts",
        "Smart Money Alignment Checked",
        "Risk-to-Reward minimum 1:2"
      ],
      reasons: [
        `PCR is ${pcr.toFixed(2)}`,
        `Major resistance at ${maxCall.strike}`,
        `Major support at ${maxPut.strike}`,
        avoidZone ? "Gamma pinning detected" : "Clean directional flow expected"
      ],
      conservativePlan: bias === "Bullish" ? "Sell Out-of-the-money Puts" : bias === "Bearish" ? "Sell Out-of-the-money Calls" : "Iron Condor",
      aggressivePlan: bias === "Bullish" ? "Buy ATM Calls" : bias === "Bearish" ? "Buy ATM Puts" : "Short Straddle",
      riskWarning: "Macro events can overwrite standard derivatives flow. Maintain strict stop loss."
    }
  };
};
