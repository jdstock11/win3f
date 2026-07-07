import { MergedDailyData, OptionChainRow, OIShiftAnalysis, SmartMoneyFlow, SupportResistanceLevel } from "./types";

export const calculatePCR = (chain: OptionChainRow[]): number => {
  let totalCE = 0;
  let totalPE = 0;
  chain.forEach(row => {
    totalCE += row.CE?.openInterest || 0;
    totalPE += row.PE?.openInterest || 0;
  });
  return totalCE === 0 ? 0 : totalPE / totalCE;
};

export const calculateMaxPain = (chain: OptionChainRow[]): number => {
  let minPain = Infinity;
  let maxPainStrike = 0;

  // Only check strikes that have some open interest
  const validStrikes = chain.filter(r => (r.CE?.openInterest || 0) > 0 || (r.PE?.openInterest || 0) > 0);
  
  validStrikes.forEach(targetStrikeRow => {
    const targetStrike = targetStrikeRow.strikePrice;
    let totalPain = 0;

    chain.forEach(row => {
      // Pain for Call writers if expiry happens at targetStrike
      if (row.strikePrice < targetStrike && row.CE) {
        totalPain += (targetStrike - row.strikePrice) * row.CE.openInterest;
      }
      // Pain for Put writers if expiry happens at targetStrike
      if (row.strikePrice > targetStrike && row.PE) {
        totalPain += (row.strikePrice - targetStrike) * row.PE.openInterest;
      }
    });

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = targetStrike;
    }
  });

  return maxPainStrike;
};

export const analyzeOIShifts = (chain: OptionChainRow[]): OIShiftAnalysis[] => {
  const shifts: OIShiftAnalysis[] = [];
  
  chain.forEach(row => {
    // Analyze CE
    if (row.CE && row.CE.changeInOI !== 0) {
      const isPriceUp = row.CE.close > row.CE.open; // Simplified price trend, ideally compare with previous close
      const isOIUp = row.CE.changeInOI > 0;
      
      let type: OIShiftAnalysis["type"] = "None";
      if (isOIUp && !isPriceUp) type = "Fresh Call Writing";
      else if (!isOIUp && isPriceUp) type = "Call Unwinding";
      else if (isOIUp && isPriceUp) type = "Long Build-up";
      else if (!isOIUp && !isPriceUp) type = "Short Build-up"; // Long liquidation
      
      if (type !== "None") {
        shifts.push({ strikePrice: row.strikePrice, type, intensity: Math.abs(row.CE.changeInOI), volume: row.CE.volume });
      }
    }
    
    // Analyze PE
    if (row.PE && row.PE.changeInOI !== 0) {
      const isPriceUp = row.PE.close > row.PE.open;
      const isOIUp = row.PE.changeInOI > 0;
      
      let type: OIShiftAnalysis["type"] = "None";
      if (isOIUp && !isPriceUp) type = "Fresh Put Writing";
      else if (!isOIUp && isPriceUp) type = "Put Unwinding";
      else if (isOIUp && isPriceUp) type = "Long Build-up";
      else if (!isOIUp && !isPriceUp) type = "Short Build-up";
      
      if (type !== "None") {
        shifts.push({ strikePrice: row.strikePrice, type, intensity: Math.abs(row.PE.changeInOI), volume: row.PE.volume });
      }
    }
  });
  
  return shifts.sort((a, b) => b.intensity - a.intensity);
};

export const identifySmartMoney = (chain: OptionChainRow[]): SmartMoneyFlow[] => {
  const flow: SmartMoneyFlow[] = [];
  // Calculate average volume to find anomalies
  let totalVol = 0;
  let count = 0;
  chain.forEach(r => {
    if (r.CE) { totalVol += r.CE.volume; count++; }
    if (r.PE) { totalVol += r.PE.volume; count++; }
  });
  const avgVol = count > 0 ? totalVol / count : 0;
  const highVolThreshold = avgVol * 3; // 3x average volume is suspicious

  chain.forEach(row => {
    if (row.CE && row.CE.volume > highVolThreshold && row.CE.changeInOI > 0) {
      // High volume + High OI increase = Institution active
      const isPriceDown = row.CE.close < row.CE.open;
      flow.push({
        strikePrice: row.strikePrice,
        type: isPriceDown ? "Institutional Call Writing" : "Institutional Call Buying",
        confidence: row.CE.volume / avgVol
      });
    }
    if (row.PE && row.PE.volume > highVolThreshold && row.PE.changeInOI > 0) {
      const isPriceDown = row.PE.close < row.PE.open;
      flow.push({
        strikePrice: row.strikePrice,
        type: isPriceDown ? "Institutional Put Writing" : "Institutional Put Buying",
        confidence: row.PE.volume / avgVol
      });
    }
  });

  return flow.sort((a, b) => b.confidence - a.confidence);
};

export const calculateSupportResistance = (chain: OptionChainRow[]): SupportResistanceLevel[] => {
  const levels: SupportResistanceLevel[] = [];
  
  // Max OI for CE = Resistance, PE = Support
  let maxCeOI = 0, maxPeOI = 0;
  let maxCeOIStrike = 0, maxPeOIStrike = 0;
  
  let maxCeChange = 0, maxPeChange = 0;
  let maxCeChangeStrike = 0, maxPeChangeStrike = 0;

  chain.forEach(row => {
    if (row.CE) {
      if (row.CE.openInterest > maxCeOI) { maxCeOI = row.CE.openInterest; maxCeOIStrike = row.strikePrice; }
      if (row.CE.changeInOI > maxCeChange) { maxCeChange = row.CE.changeInOI; maxCeChangeStrike = row.strikePrice; }
    }
    if (row.PE) {
      if (row.PE.openInterest > maxPeOI) { maxPeOI = row.PE.openInterest; maxPeOIStrike = row.strikePrice; }
      if (row.PE.changeInOI > maxPeChange) { maxPeChange = row.PE.changeInOI; maxPeChangeStrike = row.strikePrice; }
    }
  });

  if (maxCeOIStrike) levels.push({ strikePrice: maxCeOIStrike, type: "Resistance", method: "Max OI", strength: maxCeOI });
  if (maxPeOIStrike) levels.push({ strikePrice: maxPeOIStrike, type: "Support", method: "Max OI", strength: maxPeOI });
  if (maxCeChangeStrike && maxCeChangeStrike !== maxCeOIStrike) levels.push({ strikePrice: maxCeChangeStrike, type: "Resistance", method: "Max Change in OI", strength: maxCeChange });
  if (maxPeChangeStrike && maxPeChangeStrike !== maxPeOIStrike) levels.push({ strikePrice: maxPeChangeStrike, type: "Support", method: "Max Change in OI", strength: maxPeChange });

  return levels;
};
