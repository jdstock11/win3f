"use client";

import React, { useMemo } from 'react';
import { Activity, Clock, TrendingUp, TrendingDown, BrainCircuit, Target, Shield, Percent, BarChart2, Crosshair, Map, Anchor } from 'lucide-react';
import { Dataset, OptionRow } from './StrategyEngine';

interface Props {
  previousUpload: { timestamp: string; dataset: Dataset } | null;
  currentUpload: { timestamp: string; dataset: Dataset } | null;
  currentSymbol: string;
}

export default function IntradayInstitutionalComparisonEngine({ previousUpload, currentUpload, currentSymbol }: Props) {
  const analysis = useMemo(() => {
    if (!previousUpload || !currentUpload || previousUpload.dataset.symbol !== currentUpload.dataset.symbol) {
      return null;
    }

    const pData = previousUpload.dataset.data;
    const cData = currentUpload.dataset.data;

    // Use union of strikes
    const strikes = Array.from(new Set([...pData.map(d => d.strike), ...cData.map(d => d.strike)])).sort((a, b) => a - b);

    const diffRows = strikes.map(strike => {
      const p = pData.find(d => d.strike === strike) || { callVol: 0, putVol: 0, callOI: 0, putOI: 0, callLTP: 0, putLTP: 0, callIV: 0, putIV: 0 } as OptionRow;
      const c = cData.find(d => d.strike === strike) || { callVol: 0, putVol: 0, callOI: 0, putOI: 0, callLTP: 0, putLTP: 0, callIV: 0, putIV: 0 } as OptionRow;

      const ceVolDiff = c.callVol - p.callVol;
      const peVolDiff = c.putVol - p.putVol;
      
      const ceOIDiff = c.callOI - p.callOI;
      const peOIDiff = c.putOI - p.putOI;
      
      const ceLtpDiff = c.callLTP - p.callLTP;
      const peLtpDiff = c.putLTP - p.putLTP;

      const ceIvDiff = c.callIV - p.callIV;
      const peIvDiff = c.putIV - p.putIV;

      // AI Classification logic
      let ceClass = "Neutral";
      let ceWhy = "-";
      if (ceOIDiff > 0 && ceLtpDiff < 0) { ceClass = "Fresh Call Writing"; ceWhy = "OI rose while premium dropped."; }
      else if (ceOIDiff > 0 && ceLtpDiff > 0) { ceClass = "Call Buying"; ceWhy = "OI rose and premium expanded."; }
      else if (ceOIDiff < 0 && ceLtpDiff > 0) { ceClass = "Short Covering"; ceWhy = "OI dropped but premium spiked."; }
      else if (ceOIDiff < 0 && ceLtpDiff < 0) { ceClass = "Long Unwinding"; ceWhy = "OI dropped and premium decayed."; }

      let peClass = "Neutral";
      let peWhy = "-";
      if (peOIDiff > 0 && peLtpDiff < 0) { peClass = "Fresh Put Writing"; peWhy = "OI rose while premium dropped."; }
      else if (peOIDiff > 0 && peLtpDiff > 0) { peClass = "Put Buying"; peWhy = "OI rose and premium expanded."; }
      else if (peOIDiff < 0 && peLtpDiff > 0) { peClass = "Short Covering"; peWhy = "OI dropped but premium spiked."; }
      else if (peOIDiff < 0 && peLtpDiff < 0) { peClass = "Long Unwinding"; peWhy = "OI dropped and premium decayed."; }

      return { 
        strike, p, c, ceVolDiff, peVolDiff, ceOIDiff, peOIDiff, ceLtpDiff, peLtpDiff, ceIvDiff, peIvDiff, ceClass, ceWhy, peClass, peWhy 
      };
    });

    const topCEVol = [...diffRows].sort((a,b) => b.ceVolDiff - a.ceVolDiff).slice(0, 3);
    const topPEVol = [...diffRows].sort((a,b) => b.peVolDiff - a.peVolDiff).slice(0, 3);
    const topCEOIAdd = [...diffRows].sort((a,b) => b.ceOIDiff - a.ceOIDiff).slice(0, 3);
    const topPEOIAdd = [...diffRows].sort((a,b) => b.peOIDiff - a.peOIDiff).slice(0, 3);
    const topCEOIExit = [...diffRows].sort((a,b) => a.ceOIDiff - b.ceOIDiff).slice(0, 3);
    const topPEOIExit = [...diffRows].sort((a,b) => a.peOIDiff - b.peOIDiff).slice(0, 3);
    const topCEPremExp = [...diffRows].sort((a,b) => b.ceLtpDiff - a.ceLtpDiff).slice(0, 3);
    const topPEPremExp = [...diffRows].sort((a,b) => b.peLtpDiff - a.peLtpDiff).slice(0, 3);
    const topCEPremDec = [...diffRows].sort((a,b) => a.ceLtpDiff - b.ceLtpDiff).slice(0, 3);
    const topPEPremDec = [...diffRows].sort((a,b) => a.peLtpDiff - b.peLtpDiff).slice(0, 3);

    const mostAggCEWrite = topCEOIAdd[0]?.ceClass === "Fresh Call Writing" ? topCEOIAdd[0] : [...diffRows].filter(r=>r.ceClass === "Fresh Call Writing").sort((a,b)=>b.ceOIDiff - a.ceOIDiff)[0];
    const mostAggPEWrite = topPEOIAdd[0]?.peClass === "Fresh Put Writing" ? topPEOIAdd[0] : [...diffRows].filter(r=>r.peClass === "Fresh Put Writing").sort((a,b)=>b.peOIDiff - a.peOIDiff)[0];
    
    const mostAggCEBuy = [...diffRows].filter(r=>r.ceClass === "Call Buying").sort((a,b)=>b.ceOIDiff - a.ceOIDiff)[0];
    const mostAggPEBuy = [...diffRows].filter(r=>r.peClass === "Put Buying").sort((a,b)=>b.peOIDiff - a.peOIDiff)[0];

    const prevMaxCE = [...pData].sort((a,b) => b.callOI - a.callOI)[0];
    const currMaxCE = [...cData].sort((a,b) => b.callOI - a.callOI)[0];
    const resShift = prevMaxCE?.strike === currMaxCE?.strike ? "Unchanged" : `${prevMaxCE?.strike} ➡️ ${currMaxCE?.strike}`;

    const prevMaxPE = [...pData].sort((a,b) => b.putOI - a.putOI)[0];
    const currMaxPE = [...cData].sort((a,b) => b.putOI - a.putOI)[0];
    const supShift = prevMaxPE?.strike === currMaxPE?.strike ? "Unchanged" : `${prevMaxPE?.strike} ➡️ ${currMaxPE?.strike}`;

    const totalCEAdded = diffRows.reduce((acc, r) => acc + (r.ceOIDiff > 0 ? r.ceOIDiff : 0), 0);
    const totalPEAdded = diffRows.reduce((acc, r) => acc + (r.peOIDiff > 0 ? r.peOIDiff : 0), 0);
    
    const marketBias = totalPEAdded > totalCEAdded * 1.2 ? "Bullish" : (totalCEAdded > totalPEAdded * 1.2 ? "Bearish" : "Sideways / Range-bound");
    
    const support = currMaxPE?.strike || 0;
    const resistance = currMaxCE?.strike || 0;
    const bestBuyZone = `${support} to ${support + 50}`;
    const bestSellZone = `${resistance - 50} to ${resistance}`;
    
    const stopLoss = marketBias === "Bullish" ? support - 50 : (marketBias === "Bearish" ? resistance + 50 : support - 50);
    const target1 = marketBias === "Bullish" ? resistance - 50 : (marketBias === "Bearish" ? support + 50 : resistance);
    const target2 = marketBias === "Bullish" ? resistance + 50 : (marketBias === "Bearish" ? support - 50 : "N/A");
    const riskReward = "1:2.5+";
    const confidence = Math.abs(totalPEAdded - totalCEAdded) > 100000 ? "High" : "Medium";
    
    const reason = marketBias === "Bullish" 
      ? `Strong PE writing observed at ${mostAggPEWrite?.strike || support} anchoring the base. CE unwinding validates upward pressure.`
      : marketBias === "Bearish"
      ? `Aggressive CE writing at ${mostAggCEWrite?.strike || resistance} acting as a firm ceiling. Lack of PE support validates bearish flow.`
      : `Equal pressure from buyers and writers. Premiums likely to decay inside the ${support}-${resistance} corridor.`;

    const formatTimeDiff = (t1: string, t2: string) => {
      const d1 = new Date(t1);
      const d2 = new Date(t2);
      const diffMins = Math.round(Math.abs(d2.getTime() - d1.getTime()) / 60000);
      if (diffMins < 60) return `${diffMins} Minutes`;
      return `${(diffMins / 60).toFixed(1)} Hours`;
    };

    return {
       diffRows: diffRows.filter(r => r.ceVolDiff !== 0 || r.peVolDiff !== 0 || r.ceOIDiff !== 0 || r.peOIDiff !== 0),
       topCEVol, topPEVol, topCEOIAdd, topPEOIAdd, topCEOIExit, topPEOIExit, topCEPremExp, topPEPremExp, topCEPremDec, topPEPremDec,
       mostAggCEWrite, mostAggPEWrite, mostAggCEBuy, mostAggPEBuy, resShift, supShift,
       tradeBook: { marketBias, support, resistance, bestBuyZone, bestSellZone, stopLoss, target1, target2, riskReward, confidence, reason },
       timeDiff: formatTimeDiff(previousUpload.timestamp, currentUpload.timestamp)
    };
  }, [previousUpload, currentUpload, currentSymbol]);

  const formatNum = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  if (!previousUpload && currentUpload) {
    return (
      <div className="w-full mt-12 bg-black/40 border-2 border-dashed border-[#8b5cf6]/50 rounded-2xl p-10 text-center animate-in fade-in duration-700 shadow-[0_0_50px_rgba(139,92,246,0.1)]">
        <h2 className="text-4xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] tracking-tight">
          INTRADAY INSTITUTIONAL COMPARISON ENGINE
        </h2>
        <p className="text-xl text-gray-400 mb-2">First dataset loaded for {currentSymbol}.</p>
        <p className="text-gray-500">Upload a second dataset for the same underlying to unlock the comparison engine.</p>
      </div>
    );
  }

  if (!analysis) return null;

  const {
    diffRows, topCEVol, topPEVol, topCEOIAdd, topPEOIAdd, topCEOIExit, topPEOIExit, topCEPremExp, topPEPremExp, topCEPremDec, topPEPremDec,
    mostAggCEWrite, mostAggPEWrite, mostAggCEBuy, mostAggPEBuy, resShift, supShift, tradeBook, timeDiff
  } = analysis;

  const prevTime = new Date(previousUpload!.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const currTime = new Date(currentUpload!.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const TableCard = ({ title, data, type, isExit }: { title: string, data: any[], type: 'CE' | 'PE', isExit?: boolean }) => (
    <div className="bg-[#161925]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 shadow-xl hover:border-white/10 transition-all">
      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">{title}</h4>
      <div className="flex flex-col gap-3">
        {data.map((r, i) => (
           <div key={i} className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
             <span className="font-bold text-lg text-white">{formatNum(r.strike)}</span>
             <span className={`font-semibold ${type === 'CE' ? 'text-red-400' : 'text-emerald-400'} ${isExit ? 'opacity-70' : ''}`}>
                {isExit ? formatNum(type === 'CE' ? r.ceOIDiff : r.peOIDiff) : '+' + formatNum(type === 'CE' ? r.ceOIDiff : r.peOIDiff)}
             </span>
           </div>
        ))}
        {data.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No significant data</p>}
      </div>
    </div>
  );

  return (
    <div className="w-full mt-16 animate-in slide-in-from-bottom-8 duration-700 pb-10">
      
      {/* Title Header */}
      <div className="bg-gradient-to-r from-[#1a1d2d] to-[#0f111a] border-t-4 border-t-[#8b5cf6] border border-white/10 rounded-t-3xl p-8 relative overflow-hidden shadow-[0_-10px_40px_rgba(139,92,246,0.15)]">
         <div className="absolute top-[-50px] right-[-20px] opacity-10 blur-sm pointer-events-none transform rotate-12">
            <Activity size={300} color="#8b5cf6" />
         </div>
         <h2 className="text-4xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#ec4899] tracking-tighter relative z-10">
           INTRADAY INSTITUTIONAL COMPARISON ENGINE
         </h2>
         <div className="flex flex-wrap items-center gap-6 relative z-10">
            <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full border border-white/10">
               <span className="text-xs text-gray-500 uppercase tracking-widest">Symbol</span>
               <span className="font-bold text-white">{currentSymbol}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full border border-white/10">
               <span className="text-xs text-gray-500 uppercase tracking-widest">Window</span>
               <span className="font-bold text-amber-400">{timeDiff}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full border border-white/10">
               <span className="text-xs text-gray-500 uppercase tracking-widest">Time</span>
               <span className="font-bold text-gray-300">{prevTime} <TrendingUp size={14} className="inline text-[#8b5cf6] mx-1"/> {currTime}</span>
            </div>
         </div>
      </div>

      {/* Main Body */}
      <div className="bg-[#0f111a]/95 border-x border-b border-white/10 rounded-b-3xl p-8 shadow-2xl space-y-12 backdrop-blur-xl">

        {/* 1. AI Intraday Trade Book */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
             <Target className="text-[#ec4899]" size={28} /> AI Intraday Trade Book
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Left: Summary */}
             <div className="lg:col-span-1 bg-gradient-to-br from-[#161925] to-[#1a1d2d] rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                <BrainCircuit className="absolute bottom-[-20px] right-[-20px] text-white/5" size={120} />
                <div className="relative z-10">
                   <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Market Bias</p>
                   <p className={`text-4xl font-black mb-6 ${tradeBook.marketBias === 'Bullish' ? 'text-emerald-400' : tradeBook.marketBias === 'Bearish' ? 'text-red-400' : 'text-amber-400'}`}>
                      {tradeBook.marketBias}
                   </p>
                   <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">AI Confidence</p>
                   <p className="text-xl font-bold text-white mb-6">{tradeBook.confidence}</p>
                   
                   <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                      <p className="text-xs text-[#8b5cf6] uppercase tracking-widest mb-2">Reason</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{tradeBook.reason}</p>
                   </div>
                </div>
             </div>
             
             {/* Right: Levels */}
             <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#161925] p-5 rounded-2xl border border-white/5">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Resistance</p>
                   <p className="text-2xl font-bold text-red-400">{formatNum(tradeBook.resistance)}</p>
                </div>
                <div className="bg-[#161925] p-5 rounded-2xl border border-white/5">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Support</p>
                   <p className="text-2xl font-bold text-emerald-400">{formatNum(tradeBook.support)}</p>
                </div>
                <div className="bg-[#161925] p-5 rounded-2xl border border-emerald-500/20">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Best Buy Zone</p>
                   <p className="text-xl font-bold text-emerald-400">{tradeBook.bestBuyZone}</p>
                </div>
                <div className="bg-[#161925] p-5 rounded-2xl border border-red-500/20">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Best Sell Zone</p>
                   <p className="text-xl font-bold text-red-400">{tradeBook.bestSellZone}</p>
                </div>
                <div className="bg-[#161925] p-5 rounded-2xl border border-amber-500/20">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Shield size={12}/> Stop Loss</p>
                   <p className="text-xl font-bold text-amber-400">{formatNum(tradeBook.stopLoss as number)}</p>
                </div>
                <div className="bg-[#161925] p-5 rounded-2xl border border-[#3b82f6]/20">
                   <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Target 1 & 2</p>
                   <p className="text-xl font-bold text-[#3b82f6]">{formatNum(tradeBook.target1 as number)} / {tradeBook.target2 === 'N/A' ? 'N/A' : formatNum(tradeBook.target2 as number)}</p>
                </div>
             </div>
          </div>
        </div>

        {/* 2. Smart Money Summary */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
             <Anchor className="text-[#3b82f6]" size={28} /> Smart Money Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <div className="bg-[#161925] p-5 rounded-xl border border-white/5 shadow-md">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Most Aggressive Writing</p>
                <div className="flex justify-between items-center mb-3">
                   <span className="text-sm text-gray-300">Call (Resistance)</span>
                   <span className="font-bold text-red-400 text-lg">{mostAggCEWrite ? formatNum(mostAggCEWrite.strike) : 'None'}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-sm text-gray-300">Put (Support)</span>
                   <span className="font-bold text-emerald-400 text-lg">{mostAggPEWrite ? formatNum(mostAggPEWrite.strike) : 'None'}</span>
                </div>
             </div>
             <div className="bg-[#161925] p-5 rounded-xl border border-white/5 shadow-md">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Most Aggressive Buying</p>
                <div className="flex justify-between items-center mb-3">
                   <span className="text-sm text-gray-300">Call Buying</span>
                   <span className="font-bold text-emerald-400 text-lg">{mostAggCEBuy ? formatNum(mostAggCEBuy.strike) : 'None'}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-sm text-gray-300">Put Buying</span>
                   <span className="font-bold text-red-400 text-lg">{mostAggPEBuy ? formatNum(mostAggPEBuy.strike) : 'None'}</span>
                </div>
             </div>
             <div className="bg-[#161925] p-5 rounded-xl border border-white/5 shadow-md">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Key Level Shifts</p>
                <div className="flex justify-between items-center mb-3">
                   <span className="text-sm text-gray-300">Resistance Shift</span>
                   <span className="font-bold text-white bg-black/40 px-2 py-1 rounded text-sm">{resShift}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-sm text-gray-300">Support Shift</span>
                   <span className="font-bold text-white bg-black/40 px-2 py-1 rounded text-sm">{supShift}</span>
                </div>
             </div>
          </div>
        </div>

        {/* 3. Top Action Tables */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
             <BarChart2 className="text-[#10b981]" size={28} /> Activity Heatmap
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <TableCard title="Top CE Vol Added" data={topCEVol.map(r=>({strike:r.strike, ceOIDiff:r.ceVolDiff}))} type="CE" />
             <TableCard title="Top PE Vol Added" data={topPEVol.map(r=>({strike:r.strike, peOIDiff:r.peVolDiff}))} type="PE" />
             <TableCard title="Top CE OI Added" data={topCEOIAdd} type="CE" />
             <TableCard title="Top PE OI Added" data={topPEOIAdd} type="PE" />
             <TableCard title="Top CE OI Exit" data={topCEOIExit} type="CE" isExit />
             <TableCard title="Top PE OI Exit" data={topPEOIExit} type="PE" isExit />
             
             {/* Premium Expansion/Decay */}
             <div className="bg-[#161925]/80 backdrop-blur-md rounded-xl border border-white/5 p-4 shadow-xl col-span-2">
                 <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Premium Expansion & Decay</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-xs text-emerald-400 mb-2 font-bold">Top Premium Expansion</p>
                       {topCEPremExp.slice(0,2).map((r,i) => <div key={i} className="flex justify-between text-sm bg-emerald-500/10 p-2 rounded mb-1 text-emerald-400"><span>{formatNum(r.strike)} CE</span><span>+{r.ceLtpDiff.toFixed(1)}</span></div>)}
                       {topPEPremExp.slice(0,2).map((r,i) => <div key={i} className="flex justify-between text-sm bg-emerald-500/10 p-2 rounded mb-1 text-emerald-400"><span>{formatNum(r.strike)} PE</span><span>+{r.peLtpDiff.toFixed(1)}</span></div>)}
                    </div>
                    <div>
                       <p className="text-xs text-red-400 mb-2 font-bold">Top Premium Decay</p>
                       {topCEPremDec.slice(0,2).map((r,i) => <div key={i} className="flex justify-between text-sm bg-red-500/10 p-2 rounded mb-1 text-red-400"><span>{formatNum(r.strike)} CE</span><span>{r.ceLtpDiff.toFixed(1)}</span></div>)}
                       {topPEPremDec.slice(0,2).map((r,i) => <div key={i} className="flex justify-between text-sm bg-red-500/10 p-2 rounded mb-1 text-red-400"><span>{formatNum(r.strike)} PE</span><span>{r.peLtpDiff.toFixed(1)}</span></div>)}
                    </div>
                 </div>
             </div>
          </div>
        </div>

        {/* 4. AI Classification Table */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
             <Crosshair className="text-amber-400" size={28} /> AI Strike Classification
          </h3>
          <div className="overflow-x-auto custom-scrollbar bg-[#0a0c12]/50 rounded-2xl border border-white/5 shadow-inner">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#161925] border-b border-white/10 text-gray-400">
                   <tr>
                      <th className="p-4 font-semibold sticky left-0 bg-[#161925] z-10 w-24">Strike</th>
                      <th className="p-4 font-semibold text-center border-l border-white/5" colSpan={3}>CALL OPTIONS (CE)</th>
                      <th className="p-4 font-semibold text-center border-l border-white/5" colSpan={3}>PUT OPTIONS (PE)</th>
                   </tr>
                   <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                      <th className="p-3 sticky left-0 bg-[#161925] z-10"></th>
                      <th className="p-3 border-l border-white/5">OI Diff / Vol Diff</th>
                      <th className="p-3">AI Classification</th>
                      <th className="p-3 border-r border-white/5">Reason (Why)</th>
                      <th className="p-3 border-l border-white/5">OI Diff / Vol Diff</th>
                      <th className="p-3">AI Classification</th>
                      <th className="p-3">Reason (Why)</th>
                   </tr>
                </thead>
                <tbody>
                   {diffRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                         <td className="p-3 font-black text-white sticky left-0 bg-[#0f111a] border-r border-white/5">{formatNum(r.strike)}</td>
                         
                         {/* CALL SIDE */}
                         <td className="p-3 border-l border-white/5">
                           <div className="flex flex-col text-xs font-medium">
                              <span className={r.ceOIDiff > 0 ? "text-red-400" : "text-gray-400"}>OI: {r.ceOIDiff > 0 ? '+' : ''}{formatNum(r.ceOIDiff)}</span>
                              <span className="text-gray-500">Vol: {r.ceVolDiff > 0 ? '+' : ''}{formatNum(r.ceVolDiff)}</span>
                           </div>
                         </td>
                         <td className="p-3">
                           <span className={`px-2 py-1 rounded text-xs font-bold ${
                             r.ceClass.includes('Writing') ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                             r.ceClass.includes('Covering') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                             r.ceClass.includes('Buying') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                             'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                           }`}>
                             {r.ceClass}
                           </span>
                         </td>
                         <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate border-r border-white/5" title={r.ceWhy}>{r.ceWhy}</td>

                         {/* PUT SIDE */}
                         <td className="p-3 border-l border-white/5">
                           <div className="flex flex-col text-xs font-medium">
                              <span className={r.peOIDiff > 0 ? "text-emerald-400" : "text-gray-400"}>OI: {r.peOIDiff > 0 ? '+' : ''}{formatNum(r.peOIDiff)}</span>
                              <span className="text-gray-500">Vol: {r.peVolDiff > 0 ? '+' : ''}{formatNum(r.peVolDiff)}</span>
                           </div>
                         </td>
                         <td className="p-3">
                           <span className={`px-2 py-1 rounded text-xs font-bold ${
                             r.peClass.includes('Writing') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                             r.peClass.includes('Covering') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                             r.peClass.includes('Buying') ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                             'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                           }`}>
                             {r.peClass}
                           </span>
                         </td>
                         <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate" title={r.peWhy}>{r.peWhy}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
             {diffRows.length > 20 && <div className="text-center p-3 text-xs text-gray-500 bg-[#161925] border-t border-white/5">Showing top 20 active strikes</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
