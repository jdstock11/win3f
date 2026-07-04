"use client";

import React, { useState, useMemo, useRef } from 'react';
import { parseMarketActivityData, groupMarketDataBySymbol } from '@/lib/marketActivityParser';
import { calculateAnalytics } from '@/lib/marketActivityAnalytics';
import { MostActiveOptionRow, GroupedMarketData } from '@/lib/marketActivityTypes';
import { Activity, ShieldAlert, ShieldCheck, TrendingUp, TrendingDown, Target, BrainCircuit, BarChart3, ChevronDown, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function MarketActivityScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, GroupedMarketData> | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const file = files[0];
      const parsedRows = await parseMarketActivityData(file);
      const grouped = groupMarketDataBySymbol(parsedRows);
      
      const enrichedData: Record<string, GroupedMarketData> = {};
      Object.keys(grouped).forEach(symbol => {
        const records = grouped[symbol];
        const analytics = calculateAnalytics(records);
        enrichedData[symbol] = { symbol, records, analytics };
      });

      setData(enrichedData);
      
      const symbols = Object.keys(enrichedData).sort();
      if (symbols.length > 0) {
        setSelectedSymbol(symbols[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentData = selectedSymbol && data ? data[selectedSymbol] : null;
  const symbols = useMemo(() => data ? Object.keys(data).sort() : [], [data]);

  const formatNum = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  if (!data) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col justify-center items-center h-[60vh]">
        <div
          className="glass-panel hover:border-[#8b5cf6] transition-all duration-500 w-full"
          style={{ padding: "6rem 2rem", textAlign: "center", borderStyle: "dashed", cursor: "pointer", borderWidth: "2px" }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="bg-[#8b5cf6]/10 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
            <Activity size={56} color="#8b5cf6" />
          </div>
          <h2 className="text-4xl font-bold mb-4 gradient-text tracking-tight">Market Activity Scanner</h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto text-lg leading-relaxed">
            Upload NSE "Most Active Contracts" CSV or Excel to scan for Institutional Activity and Smart Money Bias.
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30 px-8 py-4 text-lg rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.2)] flex items-center gap-2 hover:bg-[#8b5cf6]/30 transition-colors">
              <Upload size={20} /> Select CSV / Excel
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".csv, .xlsx, .xls" style={{ display: "none" }} />
          {loading && <p className="mt-6 text-[#8b5cf6] animate-pulse font-medium">Parsing Data...</p>}
          {error && <p className="mt-6 text-red-500 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
        </div>
      </div>
    );
  }

  if (!currentData) return null;

  const { analytics, records } = currentData;

  // Chart Logic
  const byStrike: Record<number, any> = {};
  records.forEach(r => {
    if (!byStrike[r.strikePrice]) {
      byStrike[r.strikePrice] = { 
        strike: r.strikePrice, 
        'CE OI': 0, 'PE OI': 0,
        'CE Vol': 0, 'PE Vol': 0
      };
    }
    if (r.optionType === 'CE') {
      byStrike[r.strikePrice]['CE OI'] += r.openInterest;
      byStrike[r.strikePrice]['CE Vol'] += r.volume;
    } else {
      byStrike[r.strikePrice]['PE OI'] += r.openInterest;
      byStrike[r.strikePrice]['PE Vol'] += r.volume;
    }
  });
  const chartData = Object.values(byStrike).sort((a, b) => a.strike - b.strike);

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-[#161925]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6 w-full md:w-auto">
             <div className="bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] p-3 rounded-xl shadow-lg">
                <Activity color="#fff" size={28} />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                  Market Activity Scanner
                </h1>
                <p className="text-[var(--text-secondary)] text-sm">Most Active Contracts Analysis</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative">
                <select 
                   value={selectedSymbol || ''} 
                   onChange={e => setSelectedSymbol(e.target.value)}
                   className="input-glass bg-[#1a1d2d]/80 py-2 pl-4 pr-10 appearance-none font-semibold cursor-pointer text-white"
                >
                   {symbols.map(s => <option key={s} value={s} style={{ color: '#000', backgroundColor: '#fff' }}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
             </div>
             <button onClick={() => setData(null)} className="btn-primary py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 shadow-none">
                Reset
             </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="glass-panel p-8 relative overflow-hidden group shadow-xl">
          <p className="text-[var(--text-secondary)] font-medium mb-2 tracking-wide uppercase text-sm flex items-center gap-2">
             <Target size={16} className="text-[#3b82f6]"/> Center of Gravity
          </p>
          <h2 className="text-5xl font-extrabold text-white mb-2">{formatNum(analytics.centerOfGravity)}</h2>
          <div className="text-sm font-bold text-[#3b82f6] bg-[#3b82f6]/10 w-fit px-3 py-1 rounded-full border border-[#3b82f6]/20">Weighted Avg Strike</div>
        </div>

        <div className="glass-panel p-8 border-b-4 border-b-[#ef4444] relative overflow-hidden shadow-xl">
          <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
             Resistance <ShieldAlert size={16} color="#ef4444" />
          </p>
          <h2 className="text-5xl font-extrabold text-[#ef4444] mb-2">{formatNum(analytics.resistance)}</h2>
          <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">
            {analytics.highestCEOI.oi > 0 
              ? `${(analytics.highestCEOI.oi/100000).toFixed(1)}L CE OI`
              : `${(analytics.highestCEVolume.vol/100000).toFixed(1)}L CE Vol`}
          </div>
        </div>

        <div className="glass-panel p-8 border-b-4 border-b-[#10b981] relative overflow-hidden shadow-xl">
          <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
             Support <ShieldCheck size={16} color="#10b981" />
          </p>
          <h2 className="text-5xl font-extrabold text-[#10b981] mb-2">{formatNum(analytics.support)}</h2>
          <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">
            {analytics.highestPEOI.oi > 0 
              ? `${(analytics.highestPEOI.oi/100000).toFixed(1)}L PE OI`
              : `${(analytics.highestPEVolume.vol/100000).toFixed(1)}L PE Vol`}
          </div>
        </div>

        <div className="glass-panel p-8 relative overflow-hidden shadow-xl" style={{ borderBottom: `4px solid ${analytics.marketBias === 'Bullish' ? '#10b981' : analytics.marketBias === 'Bearish' ? '#ef4444' : '#f59e0b'}` }}>
          <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
             Bias <BarChart3 size={16} color={analytics.marketBias === 'Bullish' ? '#10b981' : analytics.marketBias === 'Bearish' ? '#ef4444' : '#f59e0b'} />
          </p>
          <h2 className="text-5xl font-extrabold mb-2" style={{ color: analytics.marketBias === 'Bullish' ? '#10b981' : analytics.marketBias === 'Bearish' ? '#ef4444' : '#f59e0b' }}>
             {analytics.marketBias}
          </h2>
          <div className="text-sm font-bold bg-black/30 w-fit px-3 py-1 rounded-full text-gray-300">
             {analytics.totalCEOI === 0 && analytics.totalPEOI === 0 ? 'Vol PCR' : 'PCR'}: {analytics.pcr}
          </div>
        </div>
      </div>

      {/* Analytics Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gradient-to-b from-[#1a1d2d] to-[#0f111a] rounded-2xl border border-[#8b5cf6]/40 p-8 relative overflow-hidden shadow-2xl">
           <div className="absolute top-[-30px] right-[-30px] opacity-10"><BrainCircuit size={150} color="#8b5cf6" /></div>
           <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#8b5cf6]">
             Smart Money Analysis
           </h3>
           <div className="space-y-4 relative z-10 bg-black/20 p-6 rounded-xl border border-white/5 grid grid-cols-2 gap-4">
              <div>
                 <div className="text-gray-400 text-sm mb-1">Call Activity</div>
                 <div className={`text-xl font-bold ${analytics.callActivity.includes('Writing') ? 'text-red-400' : 'text-emerald-400'}`}>{analytics.callActivity}</div>
              </div>
              <div>
                 <div className="text-gray-400 text-sm mb-1">Put Activity</div>
                 <div className={`text-xl font-bold ${analytics.putActivity.includes('Writing') ? 'text-emerald-400' : 'text-red-400'}`}>{analytics.putActivity}</div>
              </div>
              <div className="col-span-2 mt-4 pt-4 border-t border-white/5">
                 <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Bearish</span>
                    <span className="font-bold text-white">Bullish Ranking: {analytics.bullishBearishRanking}/100</span>
                    <span>Bullish</span>
                 </div>
                 <div className="w-full bg-black/50 h-3 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" style={{ width: `${analytics.bullishBearishRanking}%` }}></div>
                 </div>
              </div>
           </div>
        </div>

        <div className="glass-panel p-8 relative overflow-hidden shadow-2xl">
           <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-amber-400">
             <Activity size={28} /> Volume Footprint
           </h3>
           <div className="grid grid-cols-2 gap-6 bg-black/20 p-6 rounded-xl border border-white/5">
              <div>
                 <p className="text-sm text-gray-400 mb-1">Highest CE Volume</p>
                 <p className="font-bold text-2xl text-red-400">{formatNum(analytics.highestCEVolume.strike)}</p>
                 <p className="text-xs text-gray-500 mt-1">{(analytics.highestCEVolume.vol/100000).toFixed(1)}L Contracts</p>
              </div>
              <div>
                 <p className="text-sm text-gray-400 mb-1">Highest PE Volume</p>
                 <p className="font-bold text-2xl text-emerald-400">{formatNum(analytics.highestPEVolume.strike)}</p>
                 <p className="text-xs text-gray-500 mt-1">{(analytics.highestPEVolume.vol/100000).toFixed(1)}L Contracts</p>
              </div>
              <div className="col-span-2 mt-2">
                 <p className="text-sm text-gray-400 mb-1">Institutional Activity Score</p>
                 <p className="font-bold text-4xl text-[#3b82f6]">{analytics.institutionalActivityScore}</p>
                 <p className="text-xs text-gray-500 mt-1">Velocity and intensity of volume turnover (0-100)</p>
              </div>
           </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="glass-panel p-8 shadow-xl">
           <h3 className="text-xl font-bold mb-6 text-white">Open Interest Build Up</h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                 <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                 <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
                 <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                 <Legend />
                 <ReferenceLine x={analytics.support} stroke="#10b981" strokeDasharray="3 3" />
                 <ReferenceLine x={analytics.resistance} stroke="#ef4444" strokeDasharray="3 3" />
                 <Bar dataKey="PE OI" fill="#10b981" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="CE OI" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
         <div className="glass-panel p-8 shadow-xl">
           <h3 className="text-xl font-bold mb-6 text-white">Volume Build Up</h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                 <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                 <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
                 <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                 <Legend />
                 <Bar dataKey="PE Vol" fill="#10b981" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="CE Vol" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
      </div>

    </div>
  );
}
