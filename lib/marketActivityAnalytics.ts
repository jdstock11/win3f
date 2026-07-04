import { MostActiveOptionRow, MarketAnalytics } from './marketActivityTypes';

export const calculateAnalytics = (data: MostActiveOptionRow[]): MarketAnalytics => {
  let totalCEOI = 0;
  let totalPEOI = 0;
  let totalCEVol = 0;
  let totalPEVol = 0;

  let highestCEOI = { strike: 0, oi: 0 };
  let highestPEOI = { strike: 0, oi: 0 };
  let highestCEVolume = { strike: 0, vol: 0 };
  let highestPEVolume = { strike: 0, vol: 0 };

  let callActivityScore = 0;
  let putActivityScore = 0;

  data.forEach(row => {
    if (row.optionType === 'CE') {
      totalCEOI += row.openInterest;
      totalCEVol += row.volume;
      
      if (row.openInterest > highestCEOI.oi) {
        highestCEOI = { strike: row.strikePrice, oi: row.openInterest };
      }
      if (row.volume > highestCEVolume.vol) {
        highestCEVolume = { strike: row.strikePrice, vol: row.volume };
      }

      if (row.changeInOI > 0) callActivityScore += 1;
      else if (row.changeInOI < 0) callActivityScore -= 1;

    } else if (row.optionType === 'PE') {
      totalPEOI += row.openInterest;
      totalPEVol += row.volume;

      if (row.openInterest > highestPEOI.oi) {
        highestPEOI = { strike: row.strikePrice, oi: row.openInterest };
      }
      if (row.volume > highestPEVolume.vol) {
        highestPEVolume = { strike: row.strikePrice, vol: row.volume };
      }

      if (row.changeInOI > 0) putActivityScore += 1;
      else if (row.changeInOI < 0) putActivityScore -= 1;
    }
  });

  const useOI = totalCEOI > 0 || totalPEOI > 0;
  const pcr = useOI 
    ? Number((totalPEOI / totalCEOI).toFixed(2)) 
    : (totalCEVol > 0 ? Number((totalPEVol / totalCEVol).toFixed(2)) : 0);

  const support = highestPEOI.oi > 0 ? highestPEOI.strike : highestPEVolume.strike;
  const resistance = highestCEOI.oi > 0 ? highestCEOI.strike : highestCEVolume.strike;
  
  let marketBias: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (pcr > 1.2) marketBias = 'Bullish';
  else if (pcr < 0.8) marketBias = 'Bearish';

  let smartMoneyBias: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (putActivityScore > callActivityScore) smartMoneyBias = 'Bullish';
  else if (callActivityScore > putActivityScore) smartMoneyBias = 'Bearish';

  let totalWeightedStrike = 0;
  let totalWeight = 0;
  data.forEach(row => {
    const weight = useOI ? row.openInterest : row.volume;
    totalWeightedStrike += row.strikePrice * weight;
    totalWeight += weight;
  });
  const centerOfGravity = totalWeight > 0 ? Number((totalWeightedStrike / totalWeight).toFixed(2)) : 0;

  const institutionalActivityScore = Math.min(100, Math.floor(((totalCEVol + totalPEVol) / 100000) * 10));
  const bullishBearishRanking = pcr > 0 ? Math.min(100, Math.max(0, Math.floor((pcr / 2) * 100))) : 50;

  const callActivity = callActivityScore >= 0 ? 'Call Writing' : 'Call Buying/Unwinding';
  const putActivity = putActivityScore >= 0 ? 'Put Writing' : 'Put Buying/Unwinding';

  return {
    totalCEOI,
    totalPEOI,
    pcr,
    highestCEOI,
    highestPEOI,
    highestCEVolume,
    highestPEVolume,
    support,
    resistance,
    marketBias,
    smartMoneyBias,
    centerOfGravity,
    institutionalActivityScore,
    bullishBearishRanking,
    callActivity,
    putActivity
  };
};
