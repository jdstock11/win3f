import { OptionChainRow, ProbabilityResult } from "./types";
import { calculatePCR, calculateSupportResistance } from "./analytics";

export const generateProbabilities = (chain: OptionChainRow[]): ProbabilityResult => {
  const pcr = calculatePCR(chain);
  const levels = calculateSupportResistance(chain);
  
  // Weights out of 100
  let bullishScore = 33;
  let bearishScore = 33;
  let sidewaysScore = 34;
  let confidence = 50; // Base confidence

  // PCR Analysis (0.5 to 1.5 typical range)
  if (pcr > 1.2) {
    bullishScore += 20;
    bearishScore -= 10;
    sidewaysScore -= 10;
    confidence += 10;
  } else if (pcr < 0.8 && pcr > 0) {
    bearishScore += 20;
    bullishScore -= 10;
    sidewaysScore -= 10;
    confidence += 10;
  } else if (pcr >= 0.8 && pcr <= 1.2) {
    sidewaysScore += 20;
    bullishScore -= 10;
    bearishScore -= 10;
    confidence += 10;
  }

  // Support / Resistance gap analysis
  const support = levels.find(l => l.type === "Support" && l.method === "Max OI")?.strikePrice || 0;
  const resistance = levels.find(l => l.type === "Resistance" && l.method === "Max OI")?.strikePrice || Infinity;
  
  // Find current underlying
  const underlyingValue = chain.find(r => (r.CE?.underlyingValue || r.PE?.underlyingValue))?.CE?.underlyingValue || 0;

  if (underlyingValue > 0 && support > 0 && resistance !== Infinity) {
    const distToSupport = underlyingValue - support;
    const distToResistance = resistance - underlyingValue;

    if (distToSupport < distToResistance * 0.3) {
      // Very close to support, bounce likely
      bullishScore += 15;
      bearishScore -= 5;
      sidewaysScore -= 10;
      confidence += 5;
    } else if (distToResistance < distToSupport * 0.3) {
      // Very close to resistance, rejection likely
      bearishScore += 15;
      bullishScore -= 5;
      sidewaysScore -= 10;
      confidence += 5;
    }
  }

  // Normalize scores
  const total = Math.max(bullishScore + bearishScore + sidewaysScore, 1);
  const normalizedBullish = Math.round((bullishScore / total) * 100);
  const normalizedBearish = Math.round((bearishScore / total) * 100);
  const normalizedSideways = 100 - normalizedBullish - normalizedBearish;

  let bias: "Bullish" | "Bearish" | "Neutral" = "Neutral";
  if (normalizedBullish > 45) bias = "Bullish";
  else if (normalizedBearish > 45) bias = "Bearish";

  return {
    bullish: normalizedBullish,
    bearish: normalizedBearish,
    sideways: normalizedSideways,
    confidenceScore: Math.min(confidence, 99),
    expectedRange: {
      lowerBound: support > 0 ? support : underlyingValue * 0.98,
      upperBound: resistance !== Infinity ? resistance : underlyingValue * 1.02
    },
    bias: {
      bias,
      score: Math.max(normalizedBullish, normalizedBearish, normalizedSideways)
    }
  };
};
