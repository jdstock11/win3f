"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Zap, AlertTriangle, ShieldAlert, Percent, Copy, Target } from "lucide-react";
import { 
  ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer, Area
} from "recharts";
import { Dataset, Leg, getLotSize, analyzeStrategy } from "./StrategyEngine";

export default function CustomStrategyBuilder({ activeDataset }: { activeDataset: Dataset | null }) {
  const [legs, setLegs] = useState<Leg[]>([]);
  
  // Form State
  const [action, setAction] = useState<'Buy' | 'Sell'>('Buy');
  const [type, setType] = useState<'CE' | 'PE'>('CE');
  const [strike, setStrike] = useState<number | ''>('');
  const [lots, setLots] = useState<number>(1);
  const [ltp, setLtp] = useState<number | ''>('');

  // Auto-fill LTP when Strike/Type changes
  useEffect(() => {
    if (activeDataset && strike !== '') {
      const row = activeDataset.data.find(d => d.strike === Number(strike));
      if (row) {
        setLtp(type === 'CE' ? row.callLTP : row.putLTP);
      }
    }
  }, [strike, type, activeDataset]);

  const addLeg = () => {
    if (strike === '' || ltp === '' || lots <= 0) return;
    const newLeg: Leg = {
      strike: Number(strike),
      type,
      action,
      lots,
      ltp: Number(ltp)
    };
    setLegs([...legs, newLeg]);
    // Reset form partially
    setStrike('');
    setLtp('');
  };

  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  const duplicateLeg = (index: number) => {
    setLegs([...legs, { ...legs[index] }]);
  };

  const clearStrategy = () => {
    setLegs([]);
  };

  const spotPrice = activeDataset?.atm || (legs.length > 0 ? legs[0].strike : 22000); // Fallback to first strike
  const lotSize = activeDataset ? getLotSize(activeDataset.symbol) : 50;

  const analytics = useMemo(() => {
    if (legs.length === 0) return null;
    return analyzeStrategy(legs, spotPrice, lotSize);
  }, [legs, spotPrice, lotSize]);

  const formatMoney = (n: number | string) => {
    if (n === 'Unlimited') return 'Unlimited';
    return `₹${new Intl.NumberFormat('en-IN').format(Number(n))}`;
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in duration-500">
      
      {/* LEFT COLUMN: Strategy Builder Panel */}
      <div className="w-full xl:w-1/3 flex flex-col gap-6">
        <div className="glass-panel p-6 shadow-xl relative overflow-hidden">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
            <Zap className="text-[#8b5cf6]" /> Strategy Lab Editor
          </h3>

          {/* Builder Form */}
          <div className="bg-[#161925] border border-white/5 rounded-xl p-4 mb-6 shadow-inner">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Action</label>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                  <button 
                    onClick={() => setAction('Buy')}
                    className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${action === 'Buy' ? 'bg-[#3b82f6] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >B</button>
                  <button 
                    onClick={() => setAction('Sell')}
                    className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${action === 'Sell' ? 'bg-[#ef4444] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >S</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                  <button 
                    onClick={() => setType('CE')}
                    className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${type === 'CE' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >CE</button>
                  <button 
                    onClick={() => setType('PE')}
                    className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${type === 'PE' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >PE</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Strike</label>
                {activeDataset ? (
                  <select 
                    className="w-full bg-black/40 text-white rounded-lg p-2.5 text-sm border border-white/5 focus:border-[#3b82f6] outline-none"
                    value={strike}
                    onChange={(e) => setStrike(Number(e.target.value))}
                  >
                    <option value="">Select...</option>
                    {activeDataset.data.filter(d => Math.abs(d.strike - activeDataset.atm) <= 2000).map(d => (
                      <option key={d.strike} value={d.strike}>{d.strike}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="number" 
                    className="w-full bg-black/40 text-white rounded-lg p-2 text-sm border border-white/5 focus:border-[#3b82f6] outline-none" 
                    value={strike} onChange={e => setStrike(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 22000"
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Lots</label>
                <input 
                  type="number" min="1"
                  className="w-full bg-black/40 text-white rounded-lg p-2 text-sm border border-white/5 focus:border-[#3b82f6] outline-none" 
                  value={lots} onChange={e => setLots(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Premium (LTP)</label>
              <input 
                type="number" step="0.05"
                className="w-full bg-black/40 text-white rounded-lg p-2 text-sm border border-white/5 focus:border-[#3b82f6] outline-none" 
                value={ltp} onChange={e => setLtp(e.target.value ? Number(e.target.value) : '')} placeholder="Auto-filled or manual..."
              />
            </div>

            <button 
              onClick={addLeg}
              disabled={strike === '' || ltp === ''}
              className="w-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-bold py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              <Plus size={18} /> Add Leg
            </button>
          </div>

          {/* Active Legs List */}
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active Legs ({legs.length})</h4>
            {legs.length > 0 && (
              <button onClick={clearStrategy} className="text-xs text-[#ef4444] hover:text-red-400 font-bold transition-colors">Clear All</button>
            )}
          </div>
          
          <div className="flex flex-col gap-2 custom-scrollbar overflow-y-auto" style={{ maxHeight: "400px" }}>
            {legs.length === 0 ? (
              <div className="text-center p-8 bg-black/20 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm">
                Add legs above to build a strategy.
              </div>
            ) : (
              legs.map((leg, i) => (
                <div key={i} className={`p-3 rounded-xl border flex flex-col gap-2 ${leg.action === 'Buy' ? 'bg-[#3b82f6]/5 border-[#3b82f6]/20' : 'bg-[#ef4444]/5 border-[#ef4444]/20'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${leg.action === 'Buy' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                        {leg.action}
                      </span>
                      <span className="font-bold text-white">{leg.strike} {leg.type}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => duplicateLeg(i)} className="text-gray-400 hover:text-white transition-colors" title="Duplicate Leg"><Copy size={14}/></button>
                      <button onClick={() => removeLeg(i)} className="text-gray-400 hover:text-[#ef4444] transition-colors" title="Remove Leg"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 pl-1">
                    <span>{leg.lots} Lot{leg.lots > 1 ? 's' : ''} ({leg.lots * lotSize} Qty)</span>
                    <span className="font-bold text-gray-200">₹{leg.ltp.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Payoff & Analytics */}
      <div className="w-full xl:w-2/3 flex flex-col gap-6">
        {analytics ? (
          <div className="glass-panel p-8 shadow-2xl relative overflow-hidden">
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 border-b border-white/5 pb-6">
              <div>
                <h2 className="text-3xl font-extrabold text-white mb-2">Custom Setup</h2>
                <div className="mt-2 text-xs bg-black/30 w-fit px-3 py-1 rounded-full text-gray-400 border border-white/5">
                  Spot Ref: <strong className="text-white">{spotPrice}</strong> | Lot Size: <strong className="text-white">{lotSize}</strong>
                </div>
              </div>
              <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-right min-w-[200px]">
                <p className="text-xs text-gray-400 mb-1">Estimated Margin</p>
                <p className="text-3xl font-bold text-white">{formatMoney(analytics.marginRequired)}</p>
                <p className="text-xs text-[#10b981] mt-1">Approximate Requirement</p>
              </div>
            </div>

            {analytics.isUnlimitedLoss && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-4 mb-6 flex items-start gap-4">
                <ShieldAlert size={24} className="text-[#ef4444] mt-1" />
                <div>
                  <h4 className="text-[#ef4444] font-bold text-sm">CRITICAL RISK WARNING</h4>
                  <p className="text-sm text-gray-300 mt-1">This custom strategy contains naked short exposure resulting in <strong className="text-white">unlimited loss potential</strong>. Trade with strict stop-losses.</p>
                </div>
              </div>
            )}

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Max Profit</p>
                <p className="font-bold text-lg text-[#10b981] truncate">{formatMoney(analytics.maxProfit)}</p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Max Loss</p>
                <p className={`font-bold text-lg truncate ${analytics.isUnlimitedLoss ? 'text-[#ef4444]' : 'text-[#ef4444]'}`}>
                  {formatMoney(analytics.maxLoss)}
                </p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Net Premium</p>
                <p className={`font-bold text-lg truncate ${analytics.netPremium > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {analytics.costType}
                </p>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">POP</p>
                <div className="flex items-center gap-1">
                  <Percent size={14} className="text-[#3b82f6]" />
                  <p className="font-bold text-lg text-white">{analytics.pop}%</p>
                </div>
              </div>
              <div className="bg-[#161925] p-4 rounded-xl border border-[var(--border-color)]">
                <p className="text-xs text-gray-500 mb-1">Risk : Reward</p>
                <p className="font-bold text-lg text-white">
                  {analytics.isUnlimitedLoss ? 'Undefined' : `1 : ${(analytics.rr).toFixed(2)}`}
                </p>
              </div>
            </div>

            {/* PAYOFF CHART */}
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Expiry Payoff Chart</h4>
            <div className="h-[450px] w-full bg-black/40 rounded-2xl border border-white/5 p-4 relative shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.payoffData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                    formatter={(value: number) => [<span key="pnl" className={value >= 0 ? "text-[#10b981] font-bold" : "text-[#ef4444] font-bold"}>₹{value}</span>, "Exp P&L"]}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <ReferenceLine x={spotPrice} stroke="#8b5cf6" strokeDasharray="5 5" label={{ value: 'Spot', position: 'insideTopLeft', fill: '#8b5cf6', fontSize: 12 }} />
                  
                  {analytics.breakevens.map((be, i) => (
                    <ReferenceLine key={`be-${i}`} x={be} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `BE`, position: 'bottom', fill: '#f59e0b', fontSize: 10 }} />
                  ))}
                  
                  <defs>
                    <linearGradient id="splitColorCustom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  
                  <Area 
                    type="linear" 
                    dataKey="pnl" 
                    stroke={analytics.isUnlimitedLoss ? '#f59e0b' : '#3b82f6'} 
                    strokeWidth={3} 
                    fill="url(#splitColorCustom)" 
                    activeDot={{ r: 6, fill: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

          </div>
        ) : (
          <div className="glass-panel p-16 shadow-2xl flex flex-col items-center justify-center text-center h-full border border-dashed border-white/10">
            <Target size={64} className="text-gray-600 mb-6" />
            <h3 className="text-2xl font-bold text-gray-300 mb-2">Strategy Lab Empty</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Use the builder panel on the left to manually add option legs. The mathematical payoff engine will generate instant simulations of your custom strategy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
