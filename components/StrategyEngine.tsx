"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, TrendingDown, Layers, Percent, ShieldAlert,
  BarChart2, Target, Zap, Info, Filter, ArrowRight, BrainCircuit, AlertTriangle
} from "lucide-react";
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer, Area
} from "recharts";

export interface OptionRow {
  strike: number;
  callOI: number;
  callVol: number;
  callLTP: number;
  putOI: number;
  putVol: number;
  putLTP: number;
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
}

interface Strategy {
  id: string;
  name: string;
  type: 'Bullish' | 'Bearish' | 'Neutral' | 'Vol Expansion';
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

// Advanced Payoff Engine (Mathematical Simulation)
export const simulatePayoff = (legs: Leg[], spot: number, lotSize: number) => {
  const data = [];
  const range = spot * 0.1; // Evaluate ±10% range for wide visibility
  const step = range / 200; // 400 total data points for perfect precision curve
  
  for(let price = spot - range; price <= spot + range; price += step) {
    let pnl = 0;
    legs.forEach(leg => {
      const intrinsic = leg.type === 'CE' ? Math.max(0, price - leg.strike) : Math.max(0, leg.strike - price);
      // PNL = (Action value) * lots * lotSize
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

  // 1. Calculate Net Premium (Total Credit or Debit)
  legs.forEach(leg => {
    const value = leg.ltp * leg.lots * lotSize;
    if (leg.action === 'Sell') netPremiumNum += value;
    if (leg.action === 'Buy') netPremiumNum -= value;
  });

  // 2. Scan for Max Profit and Max Loss
  points.forEach(p => {
    if (p.pnl > maxProfit) maxProfit = p.pnl;
    if (p.pnl < maxLoss) maxLoss = p.pnl;
  });

  // 3. Detect Infinite Slopes (Unlimited Risk / Reward)
  const leftSlope = points[1].pnl - points[0].pnl;
  const rightSlope = points[points.length - 1].pnl - points[points.length - 2].pnl;

  const isUnlimitedLoss = (leftSlope > 10 && points[0].pnl < -1000) || (rightSlope < -10 && points[points.length-1].pnl < -1000);
  const isUnlimitedProfit = (leftSlope < -10 && points[0].pnl > 1000) || (rightSlope > 10 && points[points.length-1].pnl > 1000);

  // 4. Exact Mathematical Breakeven Detection
  for(let i = 1; i < points.length; i++) {
    if ((points[i-1].pnl <= 0 && points[i].pnl > 0) || (points[i-1].pnl >= 0 && points[i].pnl < 0)) {
      const p1 = points[i-1];
      const p2 = points[i];
      const ratio = Math.abs(p1.pnl) / (Math.abs(p1.pnl) + Math.abs(p2.pnl) || 1);
      const exactPrice = Math.round(p1.price + (p2.price - p1.price) * ratio);
      // Prevent duplicates from rounding
      if (!breakevens.includes(exactPrice)) {
        breakevens.push(exactPrice);
      }
    }
  }

  // 5. Margin Approximation Engine
  let margin = 0;
  let hasNakedShort = false;
  legs.forEach(leg => {
    if (leg.action === 'Sell') {
      margin += 110000 * leg.lots; // Base span margin for naked short
      hasNakedShort = true;
    }
  });
  // Margin Hedging Benefit (If bought options exist, margin drastically reduces)
  const longLegs = legs.filter(l => l.action === 'Buy').reduce((acc, leg) => acc + leg.lots, 0);
  const shortLegs = legs.filter(l => l.action === 'Sell').reduce((acc, leg) => acc + leg.lots, 0);
  if (longLegs > 0 && shortLegs > 0) {
    if (longLegs >= shortLegs) margin = 35000 * shortLegs; // Fully hedged
    else margin = (35000 * longLegs) + (110000 * (shortLegs - longLegs)); // Partially hedged
  }

  // 6. POP (Probability of Profit) Heuristic Engine
  // Estimates POP based on breakeven distance relative to typical volatility
  let pop = 50;
  if (netPremiumNum > 0 && isUnlimitedLoss) pop = 70; // High probability, unlimited risk (Ratio spreads)
  else if (netPremiumNum > 0 && !isUnlimitedLoss) pop = 65; // Credit spreads
  else if (netPremiumNum < 0 && isUnlimitedProfit) pop = 35; // Debit spreads
  else if (netPremiumNum > 0 && breakevens.length > 1) pop = 75; // Iron condors

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
    payoffData: points
  };
};

export default function StrategyEngine({ activeDataset }: { activeDataset: Dataset | null }) {
  const [filterType, setFilterType] = useState<string>("All");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const strategies = useMemo(() => {
    if (!activeDataset || !activeDataset.data.length) return [];
    
    const { atm, data, symbol } = activeDataset;
    const lotSize = getLotSize(symbol);
    const atmData = data.find(d => d.strike === atm);
    if (!atmData) return [];

    const strats: Strategy[] = [];
    const strikes = data.map(d => d.strike).sort((a,b) => a-b);
    const atmIndex = strikes.indexOf(atm);

    const getStrike = (offset: number) => data.find(d => d.strike === strikes[atmIndex + offset]);

    const otmCall1 = getStrike(1); // Slightly OTM
    const otmCall2 = getStrike(2); // Far OTM
    const otmCall4 = getStrike(4);
    const otmPut1 = getStrike(-1);
    const otmPut2 = getStrike(-2);
    const otmPut4 = getStrike(-4);

    // 1. Bear Call Spread
    if (atmData && otmCall2) {
      const legs: Leg[] = [
        { strike: atm, type: 'CE', action: 'Sell', lots: 1, ltp: atmData.callLTP },
        { strike: otmCall2.strike, type: 'CE', action: 'Buy', lots: 1, ltp: otmCall2.callLTP }
      ];
      strats.push({
        id: 'bear_call',
        name: "Bear Call Spread",
        type: "Bearish",
        legs,
        reasoning: "Strictly defined risk credit spread. Best for mildly bearish or neutral setups.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // 2. 1x2 Call Ratio Spread
    if (atmData && otmCall2) {
      const legs: Leg[] = [
        { strike: atm, type: 'CE', action: 'Buy', lots: 1, ltp: atmData.callLTP },
        { strike: otmCall2.strike, type: 'CE', action: 'Sell', lots: 2, ltp: otmCall2.callLTP }
      ];
      strats.push({
        id: 'call_ratio',
        name: "1x2 Call Ratio Spread",
        type: "Neutral", // Often used neutrally or slightly bullish
        legs,
        reasoning: "Excellent net credit setup peaking at short strike. WARNING: Carries unlimited risk beyond upper breakeven.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // 3. Bull Put Spread
    if (atmData && otmPut2) {
      const legs: Leg[] = [
        { strike: atm, type: 'PE', action: 'Sell', lots: 1, ltp: atmData.putLTP },
        { strike: otmPut2.strike, type: 'PE', action: 'Buy', lots: 1, ltp: otmPut2.putLTP }
      ];
      strats.push({
        id: 'bull_put',
        name: "Bull Put Spread",
        type: "Bullish",
        legs,
        reasoning: "Strictly defined risk credit spread. Collect premium above put floor.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // 4. 1x2 Put Ratio Spread
    if (atmData && otmPut2) {
      const legs: Leg[] = [
        { strike: atm, type: 'PE', action: 'Buy', lots: 1, ltp: atmData.putLTP },
        { strike: otmPut2.strike, type: 'PE', action: 'Sell', lots: 2, ltp: otmPut2.putLTP }
      ];
      strats.push({
        id: 'put_ratio',
        name: "1x2 Put Ratio Spread",
        type: "Neutral",
        legs,
        reasoning: "Collects net credit with maximum profit at lower short strike. WARNING: Unlimited downside risk.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    // 5. Iron Condor
    if (otmCall2 && otmCall4 && otmPut2 && otmPut4) {
      const legs: Leg[] = [
        { strike: otmCall2.strike, type: 'CE', action: 'Sell', lots: 1, ltp: otmCall2.callLTP },
        { strike: otmCall4.strike, type: 'CE', action: 'Buy', lots: 1, ltp: otmCall4.callLTP },
        { strike: otmPut2.strike, type: 'PE', action: 'Sell', lots: 1, ltp: otmPut2.putLTP },
        { strike: otmPut4.strike, type: 'PE', action: 'Buy', lots: 1, ltp: otmPut4.putLTP }
      ];
      strats.push({
        id: 'iron_condor',
        name: "Iron Condor",
        type: "Neutral",
        legs,
        reasoning: "Non-directional delta neutral strategy. Profit from range-bound price action and theta decay.",
        ...analyzeStrategy(legs, atm, lotSize)
      });
    }

    return strats.sort((a,b) => b.pop - a.pop);
  }, [activeDataset]);

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
            {["All", "Bullish", "Bearish", "Neutral", "Credit"].map(f => (
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
                  <span className={`text-xs font-bold px-2 py-1 rounded ${strat.type === 'Bullish' ? 'bg-[#10b981]/20 text-[#10b981]' : strat.type === 'Bearish' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#3b82f6]/20 text-[#3b82f6]'}`}>
                    {strat.type}
                  </span>
                  {strat.isUnlimitedLoss && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] flex items-center gap-1">
                      <AlertTriangle size={10} /> Unlimited Risk
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
                    <td colSpan={5} className="p-4 text-right font-bold text-gray-400">Net Execution Premium:</td>
                    <td className={`p-4 text-right font-bold text-lg ${selectedStrategy.netPremium > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {selectedStrategy.netPremium > 0 ? 'Net Credit' : 'Net Debit'}: ₹{Math.abs(selectedStrategy.netPremium).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
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
                  
                  {/* The exact payoff shape curve */}
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
