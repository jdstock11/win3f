import { MergedDailyData, OptionChainRow, OIShiftAnalysis, SmartMoneyFlow, SupportResistanceLevel, TopOIRow, TopOIAdditionsReductions, VolatilityExpectedMove } from "./types";

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

  const validStrikes = chain.filter(r => (r.CE?.openInterest || 0) > 0 || (r.PE?.openInterest || 0) > 0);
  
  validStrikes.forEach(targetStrikeRow => {
    const targetStrike = targetStrikeRow.strikePrice;
    let totalPain = 0;

    chain.forEach(row => {
      if (row.strikePrice < targetStrike && row.CE) {
        totalPain += (targetStrike - row.strikePrice) * row.CE.openInterest;
      }
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
    if (row.CE && row.CE.changeInOI !== 0) {
      const isPriceUp = row.CE.close > row.CE.open; 
      const isOIUp = row.CE.changeInOI > 0;
      
      let type: OIShiftAnalysis["type"] = "None";
      if (isOIUp && !isPriceUp) type = "Fresh Call Writing";
      else if (!isOIUp && isPriceUp) type = "Call Unwinding";
      else if (isOIUp && isPriceUp) type = "Long Build-up";
      else if (!isOIUp && !isPriceUp) type = "Short Build-up";
      
      if (type !== "None") {
        shifts.push({ strikePrice: row.strikePrice, type, intensity: Math.abs(row.CE.changeInOI), volume: row.CE.volume });
      }
    }
    
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

export const identifySmartMoney = (currentChain: OptionChainRow[], previousChain?: OptionChainRow[]): SmartMoneyFlow[] => {
  const flow: SmartMoneyFlow[] = [];
  let totalVol = 0;
  let count = 0;
  currentChain.forEach(r => {
    if (r.CE) { totalVol += r.CE.volume; count++; }
    if (r.PE) { totalVol += r.PE.volume; count++; }
  });
  const avgVol = count > 0 ? totalVol / count : 0;
  const highVolThreshold = avgVol * 3;

  currentChain.forEach(row => {
    const prevRow = previousChain?.find(r => r.strikePrice === row.strikePrice);
    
    if (row.CE && row.CE.volume > highVolThreshold && row.CE.changeInOI > 0) {
      const isPriceDown = row.CE.close < row.CE.open;
      const type = isPriceDown ? "Institutional Call Writing" : "Institutional Call Buying";
      
      let volChange: number | "N/A" = "N/A";
      let premChange: number | "N/A" = "N/A";
      if (prevRow?.CE) {
        volChange = row.CE.volume - prevRow.CE.volume;
        premChange = row.CE.close - prevRow.CE.close;
      } else {
        premChange = row.CE.close - row.CE.open; // fallback to intraday
      }
      
      flow.push({
        strikePrice: row.strikePrice,
        type,
        confidence: row.CE.volume / avgVol,
        oi: row.CE.openInterest,
        oiChange: row.CE.changeInOI,
        volume: row.CE.volume,
        volumeChange: volChange,
        premiumChange: premChange,
        suggestedAction: type.includes("Writing") ? "Expect Resistance / Downside" : "Expect Upside Breakout"
      });
    }
    
    if (row.PE && row.PE.volume > highVolThreshold && row.PE.changeInOI > 0) {
      const isPriceDown = row.PE.close < row.PE.open;
      const type = isPriceDown ? "Institutional Put Writing" : "Institutional Put Buying";

      let volChange: number | "N/A" = "N/A";
      let premChange: number | "N/A" = "N/A";
      if (prevRow?.PE) {
        volChange = row.PE.volume - prevRow.PE.volume;
        premChange = row.PE.close - prevRow.PE.close;
      } else {
        premChange = row.PE.close - row.PE.open; // fallback to intraday
      }

      flow.push({
        strikePrice: row.strikePrice,
        type,
        confidence: row.PE.volume / avgVol,
        oi: row.PE.openInterest,
        oiChange: row.PE.changeInOI,
        volume: row.PE.volume,
        volumeChange: volChange,
        premiumChange: premChange,
        suggestedAction: type.includes("Writing") ? "Expect Support / Upside" : "Expect Downside Breakdown"
      });
    }
  });

  return flow.sort((a, b) => b.confidence - a.confidence);
};

export const calculateSupportResistance = (chain: OptionChainRow[]): SupportResistanceLevel[] => {
  const levels: SupportResistanceLevel[] = [];
  
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

const buildTopOIRow = (row: OptionChainRow, type: "CE" | "PE", previousChain?: OptionChainRow[]): TopOIRow => {
  const data = type === "CE" ? row.CE! : row.PE!;
  const prevRow = previousChain?.find(r => r.strikePrice === row.strikePrice);
  const prevData = type === "CE" ? prevRow?.CE : prevRow?.PE;
  
  let volChange: number | "N/A" = "N/A";
  let premChange: number | "N/A" = "N/A";
  let classification = "Unknown";
  let suggestedAction = "Monitor";
  let confidence = "Low";
  let evidence = "Insufficient Data";
  let riskLevel = "Moderate";
  let classificationLogic = "N/A";
  let reasoning = "N/A";
  
  if (prevData) {
    volChange = data.volume - prevData.volume;
    premChange = data.close - prevData.close;
    
    if (data.changeInOI > 0) {
      if (premChange > 0) {
        classification = "Long Build-up";
        suggestedAction = "Trend continuation possible.";
        classificationLogic = "Premium ↑ + OI ↑ = Long Build-up";
        reasoning = `OI increased by ${data.changeInOI} and premium increased by ${premChange.toFixed(2)}. Buyers are aggressively adding positions.`;
        riskLevel = "Moderate";
        evidence = "Rising OI + Rising Premium";
        confidence = "High";
      } else {
        classification = "Short Build-up (Writing)";
        suggestedAction = "Fresh writing detected. Watch resistance/support.";
        classificationLogic = "Premium ↓ + OI ↑ = Short Build-up (Writing)";
        reasoning = `OI increased by ${data.changeInOI} while premium dropped by ${Math.abs(premChange).toFixed(2)}. Sellers are dominating this strike.`;
        riskLevel = "Moderate";
        evidence = "Rising OI + Falling Premium";
        confidence = "High";
      }
    } else if (data.changeInOI < 0) {
      if (premChange > 0) {
        classification = "Short Covering";
        suggestedAction = "Possible sharp reversal.";
        classificationLogic = "Premium ↑ + OI ↓ = Short Covering";
        reasoning = `OI decreased by ${Math.abs(data.changeInOI)} while premium jumped by ${premChange.toFixed(2)}. Option writers are covering their positions in panic.`;
        riskLevel = "High";
        evidence = "Falling OI + Rising Premium";
        confidence = "High";
      } else {
        classification = "Long Unwinding";
        suggestedAction = "Existing trend losing strength.";
        classificationLogic = "Premium ↓ + OI ↓ = Long Unwinding";
        reasoning = `Both OI and premium decreased by ${Math.abs(premChange).toFixed(2)}. Existing buyers are closing their positions.`;
        riskLevel = "Moderate";
        evidence = "Falling OI + Falling Premium";
        confidence = "High";
      }
    }
  } else {
    premChange = data.close - data.open;
    if (data.changeInOI > 0) {
        classification = "Build-up (Direction cannot be confirmed)";
        reasoning = "Previous premium change data unavailable.";
        classificationLogic = "OI ↑ + Premium ? = Unknown Build-up";
    } else if (data.changeInOI < 0) {
        classification = "Unwinding (Direction cannot be confirmed)";
        reasoning = "Previous premium change data unavailable.";
        classificationLogic = "OI ↓ + Premium ? = Unknown Unwinding";
    } else {
        classification = "Neutral";
        reasoning = "No change in OI.";
        classificationLogic = "OI = 0";
    }
    suggestedAction = "Awaiting more data.";
  }

  return {
    strike: row.strikePrice,
    oi: data.openInterest,
    oiChange: data.changeInOI,
    volume: data.volume,
    volumeChange: volChange,
    premiumChange: premChange,
    classification,
    confidence,
    evidence,
    suggestedAction,
    riskLevel,
    details: {
      currentOI: data.openInterest,
      previousOI: prevData ? prevData.openInterest : "N/A",
      oiChange: data.changeInOI,
      currentPremium: data.close,
      previousPremium: prevData ? prevData.close : "N/A",
      premiumChange: premChange,
      volume: data.volume,
      volumeChange: volChange,
      classificationLogic,
      reasoning
    }
  };
};

export const getTopOITables = (currentChain: OptionChainRow[], previousChain?: OptionChainRow[]) => {
  const sortedCE = [...currentChain].filter(r => r.CE).sort((a, b) => (b.CE?.openInterest || 0) - (a.CE?.openInterest || 0));
  const sortedPE = [...currentChain].filter(r => r.PE).sort((a, b) => (b.PE?.openInterest || 0) - (a.PE?.openInterest || 0));

  return {
    topCE: sortedCE.slice(0, 3).map(r => buildTopOIRow(r, "CE", previousChain)),
    topPE: sortedPE.slice(0, 3).map(r => buildTopOIRow(r, "PE", previousChain))
  };
};

export const getTopOIAdditionsReductions = (currentChain: OptionChainRow[], previousChain?: OptionChainRow[]): TopOIAdditionsReductions => {
  const sortedCEAdd = [...currentChain].filter(r => r.CE && r.CE.changeInOI > 0).sort((a, b) => (b.CE?.changeInOI || 0) - (a.CE?.changeInOI || 0));
  const sortedPEAdd = [...currentChain].filter(r => r.PE && r.PE.changeInOI > 0).sort((a, b) => (b.PE?.changeInOI || 0) - (a.PE?.changeInOI || 0));
  
  const sortedCERed = [...currentChain].filter(r => r.CE && r.CE.changeInOI < 0).sort((a, b) => (a.CE?.changeInOI || 0) - (b.CE?.changeInOI || 0));
  const sortedPERed = [...currentChain].filter(r => r.PE && r.PE.changeInOI < 0).sort((a, b) => (a.PE?.changeInOI || 0) - (b.PE?.changeInOI || 0));

  return {
    ceAdditions: sortedCEAdd.slice(0, 3).map(r => buildTopOIRow(r, "CE", previousChain)),
    peAdditions: sortedPEAdd.slice(0, 3).map(r => buildTopOIRow(r, "PE", previousChain)),
    ceReductions: sortedCERed.slice(0, 3).map(r => buildTopOIRow(r, "CE", previousChain)),
    peReductions: sortedPERed.slice(0, 3).map(r => buildTopOIRow(r, "PE", previousChain)),
  };
};

export const calculateVolatilityAndExpectedMove = (currentChain: OptionChainRow[]): VolatilityExpectedMove => {
  // Find ATM strike
  const underlyingValue = currentChain.find(r => (r.CE?.underlyingValue || r.PE?.underlyingValue))?.CE?.underlyingValue || 0;
  
  if (underlyingValue === 0) {
    return { atmStrike: 0, straddlePremium: "N/A", expectedDailyMove: "N/A", impliedRangeUpper: "N/A", impliedRangeLower: "N/A" };
  }

  // Find closest strike
  const atmRow = currentChain.reduce((prev, curr) => {
    return (Math.abs(curr.strikePrice - underlyingValue) < Math.abs(prev.strikePrice - underlyingValue) ? curr : prev);
  });

  if (atmRow && atmRow.CE && atmRow.PE) {
    const straddlePremium = atmRow.CE.close + atmRow.PE.close;
    // Rough heuristic for daily move: Straddle premium implies expiration move, daily move approx by straddle * some factor (e.g., 0.3) if it's weekly
    const expectedMove = straddlePremium; // let's just use straddle premium as expected move till expiry
    
    return {
      atmStrike: atmRow.strikePrice,
      straddlePremium,
      expectedDailyMove: expectedMove,
      impliedRangeUpper: underlyingValue + expectedMove,
      impliedRangeLower: underlyingValue - expectedMove
    };
  }

  return { atmStrike: 0, straddlePremium: "N/A", expectedDailyMove: "N/A", impliedRangeUpper: "N/A", impliedRangeLower: "N/A" };
};

