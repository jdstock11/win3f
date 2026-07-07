"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, TrendingDown, Layers, Percent, ShieldAlert,
  BarChart2, Target, Zap, Info, Filter, ArrowRight, BrainCircuit, AlertTriangle, Clock
} from "lucide-react";
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer, Area
} from "recharts";
import { calculateGreeks, estimateTimeToExpiry } from "../lib/greeks";

export interface OptionRow {
  strike: number;
  callOI: number;
  callVol: number;
  callLTP: number;
  callIV?: number;
  putOI: number;
  putVol: number;
  putLTP: number;
  putIV?: number;
  callOIChange?: number;
  callLTPChange?: number;
  putOIChange?: number;
  putLTPChange?: number;
}

export interface Dataset {
  id: string;
  symbol: string;
  expiry: string;
  data: OptionRow[];
  atm: number;
}

export interface Leg {
  strike: number;
  type: 'CE' | 'PE';
  action: 'Buy' | 'Sell';
  lots: number;
  ltp: number;
  expiryStr?: string;
  iv?: number;
}

interface Strategy {
  id: string;
  name: string;
  type: 'Bullish' | 'Bearish' | 'Neutral' | 'Vol Expansion' | 'Calendar';
  legs: Leg[];
  reasoning: string;
  // Computed Analytics
  netPremium: number;
  costType: 'Credit' | 'Debit';
  maxProfit: number | 'Unlimited';
  maxLoss: number | 'Unlimited';
  breakevens: number[];
  marginRequired: number;
  pop: number; 
  rr: number; 
  isUnlimitedLoss: boolean;
  payoffData: { price: number; pnl: number }[];
  netGreeks: { delta: number, gamma: number, theta: number, vega: number };
}

export const getLotSize = (symbol: string) => {
  const upper = symbol.toUpperCase();
  if (upper.includes("BANKNIFTY")) return 15;
  if (upper.includes("FINNIFTY")) return 40;
  if (upper.includes("MIDCPNIFTY")) return 75;
  if (upper.includes("SENSEX")) return 10;
  if (upper.includes("NIFTY")) return 50;
  return 50; // Fallback
};

// Advanced Payoff Engine
export const simulatePayoff = (legs: Leg[], spot: number, lotSize: number) => {
  const data = [];
  const range = spot * 0.1;
  const step = range / 200; 
  
  for(let price = spot - range; price <= spot + range; price += step) {
    let pnl = 0;
    legs.forEach(leg => {
      // Simplified intrinsic payoff assuming all expire today. For Calendar, this is an approximation.
      const intrinsic = leg.type === 'CE' ? Math.max(0, price - leg.strike) : Math.max(0, leg.strike - price);
      const legPnl = leg.action === 'Buy' ? (intrinsic - leg.ltp) : (leg.ltp - intrinsic);
      pnl += legPnl * leg.lots * lotSize;
    });
    data.push({ price: Math.round(price), pnl: Math.round(pnl) });
  }
  return data;
};

// Universal Strategy Analytics Engine
export const analyzeStrategy = (legs: Leg[], spot: number, lotSize: number): Omit<Strategy, 'id' | 'name' | 'type' | 'legs' | 'reasoning'> => {
  const points = simulatePayoff(legs, spot, lotSize);
  
  let maxProfit = -Infinity;
  let maxLoss = Infinity;
  let breakevens: number[] = [];
  let netPremiumNum = 0;

  // Greeks accumulation
  let netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0;
  
  legs.forEach(leg => {
    const value = leg.ltp * leg.lots * lotSize;
    if (leg.action === 'Sell') netPremiumNum += value;
    if (leg.action === 'Buy') netPremiumNum -= value;

    const tte = estimateTimeToExpiry(leg.expiryStr || "");
    const iv = (leg.iv && leg.iv > 0) ? leg.iv / 100 : 0.2; // fallback to 20% IV
    const greeks = calculateGreeks(spot, leg.strike, tte, 0.05, iv, leg.type);
    
    const multiplier = leg.action === 'Buy' ? 1 : -1;
    netDelta += greeks.delta * multiplier * leg.lots * lotSize;
    netGamma += greeks.gamma * multiplier * leg.lots * lotSize;
    netTheta += greeks.theta * multiplier * leg.lots * lotSize;
    netVega += greeks.vega * multiplier * leg.lots * lotSize;
  });

  points.forEach(p => {
    if (p.pnl > maxProfit) maxProfit = p.pnl;
    if (p.pnl < maxLoss) maxLoss = p.pnl;
  });

  const leftSlope = points[1].pnl - points[0].pnl;
  const rightSlope = points[points.length - 1].pnl - points[points.length - 2].pnl;

  const isUnlimitedLoss = (leftSlope > 10 && points[0].pnl < -1000) || (rightSlope < -10 && points[points.length-1].pnl < -1000);
  const isUnlimitedProfit = (leftSlope < -10 && points[0].pnl > 1000) || (rightSlope > 10 && points[points.length-1].pnl > 1000);

  for(let i = 1; i < points.length; i++) {
    if ((points[i-1].pnl <= 0 && points[i].pnl > 0) || (points[i-1].pnl >= 0 && points[i].pnl < 0)) {
      const p1 = points[i-1];
      const p2 = points[i];
      const ratio = Math.abs(p1.pnl) / (Math.abs(p1.pnl) + Math.abs(p2.pnl) || 1);
      const exactPrice = Math.round(p1.price + (p2.price - p1.price) * ratio);
      if (!breakevens.includes(exactPrice)) {
        breakevens.push(exactPrice);
      }
    }
  }

  let margin = 0;
  legs.forEach(leg => {
    if (leg.action === 'Sell') margin += 110000 * leg.lots;
  });
  const longLegs = legs.filter(l => l.action === 'Buy').reduce((acc, leg) => acc + leg.lots, 0);
  const shortLegs = legs.filter(l => l.action === 'Sell').reduce((acc, leg) => acc + leg.lots, 0);
  if (longLegs > 0 && shortLegs > 0) {
    if (longLegs >= shortLegs) margin = 35000 * shortLegs;
    else margin = (35000 * longLegs) + (110000 * (shortLegs - longLegs));
  }

  let pop = 50;
  if (netPremiumNum > 0 && isUnlimitedLoss) pop = 70;
  else if (netPremiumNum > 0 && !isUnlimitedLoss) pop = 65;
  else if (netPremiumNum < 0 && isUnlimitedProfit) pop = 35;
  else if (netPremiumNum > 0 && breakevens.length > 1) pop = 75;

  return {
    netPremium: netPremiumNum,
    costType: netPremiumNum > 0 ? 'Credit' : 'Debit',
    maxProfit: isUnlimitedProfit ? 'Unlimited' : maxProfit,
    maxLoss: isUnlimitedLoss ? 'Unlimited' : maxLoss,
    breakevens: breakevens.sort((a,b) => a-b),
    marginRequired: margin,
    pop,
    rr: isUnlimitedLoss ? 0 : Math.abs(maxProfit / maxLoss),
    isUnlimitedLoss,
    payoffData: points,
    netGreeks: { delta: netDelta, gamma: netGamma, theta: netTheta, vega: netVega }
  };
};

export default function StrategyEngine({ activeDataset, compareDataset }: { activeDataset: Dataset | null, compareDataset?: Dataset | null }) {
  const [filterType, setFilterType] = useState<string>("All");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const strategies = useMemo(() => {
    if (!activeDataset || !activeDataset.data.length) return [];
    
    const { atm, data, symbol, expiry } = activeDataset;
    const lotSize = getLotSize(symbol);
    const atmData = data.find(d => d.strike === atm);
    if (!atmData) return [];

    const strats: Strategy[] = [];
    const strikes = data.map(d => d.strike).sort((a,b) => a-b);
    const atmIndex = strikes.indexOf(atm);

    const getStrike = (offset: number) => data.find(d => d.strike === strikes[atmIndex + offset]);

    const otmCall1 = getStrike(1);
    const otmCall2 = getStrike(2);
    const otmCall4 = getStrike(4);
    const otmPut1 = getStrike(-1);
    const otmPut2 = getStrike(-2);
    const otmPut4 = getStrike(-4);

    // Standard Spreads
    if (atmData && otmCall2) {
      const legs: Leg[] = [
        { strike: atm, type: 'CE', action: 'Sell', lots: 1, ltp: atmData.callLTP, expiryStr: expiry, iv: atmData.callIV },
        { strike: otmCall2.strike, type: 'CE', action: 'Buy', lots: 1, ltp: otmCall2.callLTP, expiryStr: expiry, iv: otmCall2.callIV }
      ];
      strats.push({
        id: 'bear_call', name: "Bear Call Spread", type: "Bearish", legs,
        reasoning: "Strictly defined risk credit spread. Best for mildly bearish or neutral setups.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    if (atmData && otmPut2) {
      const legs: Leg[] = [
        { strike: atm, type: 'PE', action: 'Sell', lots: 1, ltp: atmData.putLTP, expiryStr: expiry, iv: atmData.putIV },
        { strike: otmPut2.strike, type: 'PE', action: 'Buy', lots: 1, ltp: otmPut2.putLTP, expiryStr: expiry, iv: otmPut2.putIV }
      ];
      strats.push({
        id: 'bull_put', name: "Bull Put Spread", type: "Bullish", legs,
        reasoning: "Strictly defined risk credit spread. Collect premium above put floor.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // Iron Condor
    if (otmCall2 && otmCall4 && otmPut2 && otmPut4) {
      const legs: Leg[] = [
        { strike: otmCall2.strike, type: 'CE', action: 'Sell', lots: 1, ltp: otmCall2.callLTP, expiryStr: expiry, iv: otmCall2.callIV },
        { strike: otmCall4.strike, type: 'CE', action: 'Buy', lots: 1, ltp: otmCall4.callLTP, expiryStr: expiry, iv: otmCall4.callIV },
        { strike: otmPut2.strike, type: 'PE', action: 'Sell', lots: 1, ltp: otmPut2.putLTP, expiryStr: expiry, iv: otmPut2.putIV },
        { strike: otmPut4.strike, type: 'PE', action: 'Buy', lots: 1, ltp: otmPut4.putLTP, expiryStr: expiry, iv: otmPut4.putIV }
      ];
      strats.push({
        id: 'iron_condor', name: "Iron Condor", type: "Neutral", legs,
        reasoning: "Non-directional delta neutral strategy. Profit from range-bound price action and theta decay.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // Vol Expansion
    if (atmData) {
      const legs: Leg[] = [
        { strike: atm, type: 'CE', action: 'Buy', lots: 1, ltp: atmData.callLTP, expiryStr: expiry, iv: atmData.callIV },
        { strike: atm, type: 'PE', action: 'Buy', lots: 1, ltp: atmData.putLTP, expiryStr: expiry, iv: atmData.putIV }
      ];
      strats.push({
        id: 'long_straddle', name: "Long Straddle", type: "Vol Expansion", legs,
        reasoning: "High Vega exposure. Profits from explosive moves in either direction or an increase in Implied Volatility.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // CALENDAR SPREADS
    if (compareDataset && compareDataset.data.length > 0) {
      const nextData = compareDataset.data;
      const nextAtmCall = nextData.find(d => d.strike === atm);
      const nextAtmPut = nextData.find(d => d.strike === atm);

      if (atmData && nextAtmCall) {
        const legs: Leg[] = [
          { strike: atm, type: 'CE', action: 'Sell', lots: 1, ltp: atmData.callLTP, expiryStr: expiry, iv: atmData.callIV },
          { strike: atm, type: 'CE', action: 'Buy', lots: 1, ltp: nextAtmCall.callLTP, expiryStr: compareDataset.expiry, iv: nextAtmCall.callIV }
        ];
        strats.push({
          id: 'long_calendar_call', name: "Long Call Calendar", type: "Calendar", legs,
          reasoning: "Positive Theta and positive Vega. Profits if underlying stays near strike and IV increases.",
          ...analyzeStrategy(legs, atm, lotSize)
        });
      }

      if (atmData && nextAtmPut) {
         const legs: Leg[] = [
           { strike: atm, type: 'PE', action: 'Sell', lots: 1, ltp: atmData.putLTP, expiryStr: expiry, iv: atmData.putIV },
           { strike: atm, type: 'PE', action: 'Buy', lots: 1, ltp: nextAtmPut.putLTP, expiryStr: compareDataset.expiry, iv: nextAtmPut.putIV }
         ];
         strats.push({
           id: 'long_calendar_put', name: "Long Put Calendar", type: "Calendar", legs,
           reasoning: "Profits from rapid decay of the short front-month option while holding longer-dated protection.",
           ...analyzeStrategy(legs, atm, lotSize)
         });
      }

      // Diagonal Spread
      const nextOtmCall = nextData.find(d => d.strike === (otmCall2?.strike || atm));
      if (atmData && nextOtmCall) {
        const legs: Leg[] = [
          { strike: atm, type: 'CE', action: 'Sell', lots: 1, ltp: atmData.callLTP, expiryStr: expiry, iv: atmData.callIV },
          { strike: nextOtmCall.strike, type: 'CE', action: 'Buy', lots: 1, ltp: nextOtmCall.callLTP, expiryStr: compareDataset.expiry, iv: nextOtmCall.callIV }
        ];
        strats.push({
          id: 'bull_diagonal', name: "Bull Call Diagonal", type: "Calendar", legs,
          reasoning: "Combination of a calendar and vertical spread. Directional bias with theta advantage.",
          ...analyzeStrategy(legs, atm, lotSize)
        });
      }
    }

    return strats.sort((a,b) => b.pop - a.pop);
  }, [activeDataset, compareDataset]);

  const filteredStrategies = useMemo(() => {
    if (filterType === "All") return strategies;
    return strategies.filter(s => s.type === filterType || s.costType === filterType);
  }, [strategies, filterType]);

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || filteredStrategies[0];

  const formatMoney = (n: number | string) => {
    if (n === 'Unlimited') return 'Unlimited';
    return `₹${new Intl.NumberFormat('en-IN').format(Number(n))}`;
  };

  if (!activeDataset) return <div className="text-center text-gray-500 p-8">No active dataset selected.</div>;

  const lotSize = getLotSize(activeDataset.symbol);

  return (
    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in duration-500">
      
      {/* LEFT COLUMN: Strategy List */}
      <div className="w-full xl:w-1/3 flex flex-col gap-6">
        <div className="glass-panel p-6 shadow-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <Zap className="text-[#8b5cf6]" /> Institutional Strategies
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {["All", "Calendar", "Bullish", "Bearish", "Neutral", "Vol Expansion"].map(f => (
              <button 
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === f ? 'bg-[#8b5cf6] text-white shadow-md' : 'bg-black/30 text-[var(--text-secondary)] hover:bg-white/10'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 custom-scrollbar overflow-y-auto pr-2" style={{ maxHeight: "700px" }}>
            {filteredStrategies.map((strat, idx) => (
              <div 
                key={strat.id}
                onClick={() => setSelectedStrategyId(strat.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedStrategy?.id === strat.id ? 'bg-[#8b5cf6]/10 border-[#8b5cf6] shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'bg-[#161925]/60 border-white/5 hover:border-[#8b5cf6]/40'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    {strat.name} 
                    {idx === 0 && <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/30 uppercase">Best POP</span>}
                  </h4>
                </div>
                <div className="flex gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${strat.type === 'Bullish' ? 'bg-[#10b981]/20 text-[#10b981]' : strat.type === 'Bearish' ? 'bg-[#ef4444]/20 text-[#ef4444]' : strat.type === 'Calendar' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#3b82f6]/20 text-[#3b82f6]'}`}>
                    {strat.type}
                  </span>
                  {strat.isUnlimitedLoss && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] flex items-center gap-1">
                      <AlertTriangle size={10} /> Unl. Risk
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 text-xs block">Max Profit</span><span className="text-[#10b981] font-semibold">{formatMoney(strat.maxProfit)}</span></div>
                  <div><span className="text-gray-500 text-xs block">Max Loss</span><span className="text-[#ef4444] font-semibold">{formatMoney(strat.maxLoss)}</span></div>
                  <div><span className="text-gray-500 text-xs block">Margin</span><span className="text-white font-semibold">{formatMoney(strat.marginRequired)}</span></div>
                  <div><span className="text-gray-500 text-xs block">Net Premium</span><span className={strat.costType === 'Credit' ? 'text-[#10b981] font-semibold' : 'text-[#ef4444] font-semibold'}>{strat.costType}</span></div>
                </div>
              </div>
            ))}
            {filteredStrategies.length === 0 && (
              <div className="text-sm text-gray-400 p-4 text-center">No strategies found. (If you want Calendar spreads, ensure you have selected a "Compare With" dataset).</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Strategy Details & Payoff */}
      {selectedStrategy && (
        <div className="w-full xl:w-2/3 flex flex-col gap-6">
          <div className="glass-panel p-8 shadow-2xl relative overflow-hidden">
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 border-b border-white/5 pb-6">
              <div>
                <h2 className="text-3xl font-extrabold text-white mb-2">{selectedStrategy.name}</h2>
                <p className="text-[#8b5cf6] font-medium flex items-center gap-2"><BrainCircuit size={16}/> {selectedStrategy.reasoning}</p>
                <div className="mt-3 text-xs bg-black/30 w-fit px-3 py-1 rounded-full text-gray-400 border border-white/5">
                  Lot Size: <strong className="text-white">{lotSize}</strong> ({activeDataset.symbol})
                </div>
              </div>
              <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-right min-w-[200px]">
                <p className="text-xs text-gray-400 mb-1">Estimated Margin</p>
                <p className="text-3xl font-bold text-white">{formatMoney(selectedStrategy.marginRequired)}</p>
                <p className="text-xs text-[#10b981] mt-1">Hedged Benefit Included</p>
              </div>
            </div>

            {selectedStrategy.isUnlimitedLoss && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-4 mb-6 flex items-start gap-4">
                <ShieldAlert size={24} className="text-[#ef4444] mt-1" />
                <div>
                  <h4 className="text-[#ef4444] font-bold text-sm">CRITICAL RISK WARNING</h4>
                  <p className="text-sm text-gray-300 mt-1">This strategy contains exposed naked short legs. It carries <strong className="text-white">unlimited loss potential</strong> if the underlying price moves violently beyond the breakeven points. Strict stop-losses are recommended.</p>
                </div>
              </div>
            )}

            {/* LEGS BREAKDOWN PANEL */}
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Execution Legs & Premium Contribution</h4>
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden mb-8">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#161925] border-b border-white/5 text-gray-400">
                  <tr>
                    <th className="p-4 font-medium">Action</th>
                    <th className="p-4 font-medium">Expiry</th>
                    <th className="p-4 font-medium">Strike</th>
                    <th className="p-4 font-medium">Lots</th>
                    <th className="p-4 font-medium">Qty</th>
                    <th className="p-4 font-medium">Premium</th>
                    <th className="p-4 font-medium text-right">Credit / Debit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStrategy.legs.map((leg, i) => {
                    const totalVal = leg.ltp * leg.lots * lotSize;
                    const isCredit = leg.action === 'Sell';
                    return (
                      <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${leg.action === 'Buy' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                            {leg.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-[#f59e0b]"><Clock size={12} className="inline mr-1"/>{leg.expiryStr}</td>
                        <td className="p-4 font-bold text-white">{leg.strike} {leg.type}</td>
                        <td className="p-4 text-gray-300">{leg.lots}</td>
                        <td className="p-4 text-gray-300">{leg.lots * lotSize}</td>
                        <td className="p-4 font-bold text-gray-300">₹{leg.ltp.toFixed(2)}</td>
                        <td className={`p-4 text-right font-bold ${isCredit ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {isCredit ? '+' : '-'} ₹{totalVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#1a1d2d] border-t border-white/10">
                  <tr>
                    <td colSpan={6} className="p-4 text-right font-bold text-gray-400">Net Execution Premium:</td>
                    <td className={`p-4 text-right font-bold text-lg ${selectedStrategy.netPremium > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {selectedStrategy.netPremium > 0 ? 'Net Credit' : 'Net Debit'}: ₹{Math.abs(selectedStrategy.netPremium).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* GREEKS EXPOSURE */}
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Portfolio Greeks Exposure</h4>
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Net Delta</p>
                <p className={`font-bold text-lg ${selectedStrategy.netGreeks.delta > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{selectedStrategy.netGreeks.delta.toFixed(2)}</p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Net Gamma</p>
                <p className={`font-bold text-lg ${selectedStrategy.netGreeks.gamma > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{selectedStrategy.netGreeks.gamma.toFixed(4)}</p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Net Theta</p>
                <p className={`font-bold text-lg ${selectedStrategy.netGreeks.theta > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{selectedStrategy.netGreeks.theta.toFixed(2)} / day</p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Net Vega</p>
                <p className={`font-bold text-lg ${selectedStrategy.netGreeks.vega > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{selectedStrategy.netGreeks.vega.toFixed(2)} / 1% IV</p>
              </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Probability of Profit</p>
                <div className="flex items-center gap-2">
                  <Percent size={16} className="text-[#3b82f6]" />
                  <p className="font-bold text-xl text-white">{selectedStrategy.pop}%</p>
                </div>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Max Profit</p>
                <p className="font-bold text-xl text-[#10b981]">{formatMoney(selectedStrategy.maxProfit)}</p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Max Loss</p>
                <p className={`font-bold text-xl ${selectedStrategy.isUnlimitedLoss ? 'text-[#ef4444]' : 'text-[#ef4444]'}`}>
                  {formatMoney(selectedStrategy.maxLoss)}
                </p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Risk : Reward</p>
                <p className="font-bold text-xl text-white">
                  {selectedStrategy.isUnlimitedLoss ? 'Undefined' : `1 : ${(selectedStrategy.rr).toFixed(2)}`}
                </p>
              </div>
            </div>

            {/* PAYOFF CHART */}
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Expiry Payoff Chart (Opstra Scale)</h4>
            <div className="h-[400px] w-full bg-black/40 rounded-2xl border border-white/5 p-4 mb-8 relative shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={selectedStrategy.payoffData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="price" 
                    stroke="rgba(255,255,255,0.3)" 
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                    domain={['dataMin', 'dataMax']} 
                    type="number" 
                    tickCount={10}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                    tickFormatter={(val) => `₹${val}`}
                    domain={['auto', 'auto']}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    labelFormatter={(label) => `Spot Price: ₹${label}`}
                    formatter={(value: any) => [<span key="pnl" className={value >= 0 ? "text-[#10b981] font-bold" : "text-[#ef4444] font-bold"}>₹{value}</span>, "Exp P&L"]}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <ReferenceLine x={activeDataset.atm} stroke="#8b5cf6" strokeDasharray="5 5" label={{ value: 'Current Spot', position: 'insideTopLeft', fill: '#8b5cf6', fontSize: 12 }} />
                  
                  {selectedStrategy.breakevens.map((be, i) => (
                    <ReferenceLine key={`be-${i}`} x={be} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `BE: ${be}`, position: 'bottom', fill: '#f59e0b', fontSize: 10 }} />
                  ))}
                  
                  <defs>
                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  
                  <Area 
                    type="linear" 
                    dataKey="pnl" 
                    stroke={selectedStrategy.isUnlimitedLoss ? '#f59e0b' : '#3b82f6'} 
                    strokeWidth={3} 
                    fill="url(#splitColor)" 
                    activeDot={{ r: 6, fill: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
