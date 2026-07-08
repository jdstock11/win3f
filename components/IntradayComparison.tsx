"use client";

import React, { useMemo } from 'react';
import { Activity, Clock, TrendingUp, TrendingDown, BrainCircuit } from 'lucide-react';
import { Dataset, OptionRow } from './StrategyEngine';

interface IntradayComparisonProps {
  previousUpload: { timestamp: string; dataset: Dataset } | null;
  currentUpload: { timestamp: string; dataset: Dataset } | null;
  currentSymbol: string;
}

export default function IntradayComparison({ previousUpload, currentUpload, currentSymbol }: IntradayComparisonProps) {
  const comparisonData = useMemo(() => {
    if (!previousUpload || !currentUpload || previousUpload.dataset.symbol !== currentUpload.dataset.symbol) {
      return null;
    }

    const prevData = previousUpload.dataset.data;
    const currData = currentUpload.dataset.data;

    const strikes = new Set([...prevData.map(d => d.strike), ...currData.map(d => d.strike)]);
    const sortedStrikes = Array.from(strikes).sort((a, b) => a - b);

    const rows = sortedStrikes.map(strike => {
      const p = prevData.find(d => d.strike === strike) || { callVol: 0, putVol: 0, callOI: 0, putOI: 0 } as OptionRow;
      const c = currData.find(d => d.strike === strike) || { callVol: 0, putVol: 0, callOI: 0, putOI: 0 } as OptionRow;

      const ceVolDiff = c.callVol - p.callVol;
      const peVolDiff = c.putVol - p.putVol;
      const ceOIDiff = c.callOI - p.callOI;
      const peOIDiff = c.putOI - p.putOI;

      const ceVolPct = p.callVol > 0 ? (ceVolDiff / p.callVol) * 100 : 0;
      const peVolPct = p.putVol > 0 ? (peVolDiff / p.putVol) * 100 : 0;
      const ceOIPct = p.callOI > 0 ? (ceOIDiff / p.callOI) * 100 : 0;
      const peOIPct = p.putOI > 0 ? (peOIDiff / p.putOI) * 100 : 0;

      // Basic Interpretation logic
      let interpretation = 'Neutral';
      let suggestedAction = 'Wait and Watch';
      let confidence = 'Low';

      if (ceOIDiff > 0 && ceVolDiff > 0 && peOIDiff <= 0) {
        interpretation = 'Call Writing (Resistance building)';
        suggestedAction = 'Bearish bias below this strike';
        confidence = 'High';
      } else if (peOIDiff > 0 && peVolDiff > 0 && ceOIDiff <= 0) {
        interpretation = 'Put Writing (Support building)';
        suggestedAction = 'Bullish bias above this strike';
        confidence = 'High';
      } else if (ceOIDiff < 0 && ceVolDiff > 0) {
        interpretation = 'Short Covering (Calls)';
        suggestedAction = 'Expect upward momentum';
        confidence = 'Medium';
      } else if (peOIDiff < 0 && peVolDiff > 0) {
        interpretation = 'Long Unwinding (Puts)';
        suggestedAction = 'Expect downward momentum';
        confidence = 'Medium';
      }

      return {
        strike,
        prev: p,
        curr: c,
        ceVolDiff, peVolDiff, ceOIDiff, peOIDiff,
        ceVolPct, peVolPct, ceOIPct, peOIPct,
        interpretation,
        suggestedAction,
        confidence
      };
    });

    let topCEVolInc = rows[0], topPEVolInc = rows[0];
    let topCEVolDec = rows[0], topPEVolDec = rows[0];
    let topCEOIInc = rows[0], topPEOIInc = rows[0];
    let topCEOIDec = rows[0], topPEOIDec = rows[0];

    rows.forEach(r => {
      if (r.ceVolDiff > topCEVolInc.ceVolDiff) topCEVolInc = r;
      if (r.peVolDiff > topPEVolInc.peVolDiff) topPEVolInc = r;
      if (r.ceVolDiff < topCEVolDec.ceVolDiff) topCEVolDec = r;
      if (r.peVolDiff < topPEVolDec.peVolDiff) topPEVolDec = r;

      if (r.ceOIDiff > topCEOIInc.ceOIDiff) topCEOIInc = r;
      if (r.peOIDiff > topPEOIInc.peOIDiff) topPEOIInc = r;
      if (r.ceOIDiff < topCEOIDec.ceOIDiff) topCEOIDec = r;
      if (r.peOIDiff < topPEOIDec.peOIDiff) topPEOIDec = r;
    });

    const formatTimeDiff = (t1: string, t2: string) => {
      const d1 = new Date(t1);
      const d2 = new Date(t2);
      const diffMins = Math.round(Math.abs(d2.getTime() - d1.getTime()) / 60000);
      if (diffMins < 60) return `${diffMins} Minutes`;
      return `${(diffMins / 60).toFixed(1)} Hours`;
    };

    return {
      rows: rows.filter(r => r.ceVolDiff !== 0 || r.peVolDiff !== 0 || r.ceOIDiff !== 0 || r.peOIDiff !== 0), // filter out completely unchanged rows
      timeDiff: formatTimeDiff(previousUpload.timestamp, currentUpload.timestamp),
      topCEVolInc, topPEVolInc, topCEVolDec, topPEVolDec,
      topCEOIInc, topPEOIInc, topCEOIDec, topPEOIDec
    };
  }, [previousUpload, currentUpload]);

  const formatNum = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  if (!previousUpload && currentUpload) {
    return (
      <div className="glass-panel p-8 shadow-xl mt-8 animate-in fade-in duration-500 border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 text-center">
         <h3 className="text-2xl font-bold mb-2 text-[#8b5cf6] flex justify-center items-center gap-2">
            <Activity size={24} /> Intraday Change Analysis
         </h3>
         <p className="text-lg text-gray-300">
           This is the first upload for <strong className="text-white">{currentSymbol}</strong>. Upload the next Option Chain file for the same underlying to enable intraday comparison.
         </p>
      </div>
    );
  }

  if (!comparisonData || !previousUpload || !currentUpload) {
    return null;
  }

  const { rows, timeDiff, topCEVolInc, topPEVolInc, topCEVolDec, topPEVolDec, topCEOIInc, topPEOIInc, topCEOIDec, topPEOIDec } = comparisonData;

  const prevTime = new Date(previousUpload.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const currTime = new Date(currentUpload.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="glass-panel p-8 shadow-2xl mt-8 border border-white/10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-extrabold flex items-center gap-3 text-white">
            📈 Intraday Change Analysis
          </h2>
          <p className="text-[var(--text-secondary)] mt-2 font-medium">Tracking real-time shifts in Smart Money positioning.</p>
        </div>
        
        <div className="flex gap-4 bg-black/30 p-4 rounded-xl border border-white/5">
           <div className="text-center px-4 border-r border-white/10">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Underlying</p>
              <p className="font-bold text-xl text-white">{currentSymbol}</p>
           </div>
           <div className="text-center px-4 border-r border-white/10">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1 justify-center"><Clock size={12}/> Window</p>
              <p className="font-bold text-xl text-amber-400">{timeDiff}</p>
           </div>
           <div className="text-center px-4">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Timeline</p>
              <p className="font-bold text-sm text-gray-300">{prevTime} <TrendingUp size={14} className="inline text-[#8b5cf6] mx-1"/> {currTime}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top CE Volume Increase</p>
            <p className="text-2xl font-bold text-red-400">{formatNum(topCEVolInc.strike)}</p>
            <p className="text-xs text-red-400/70 mt-1">+{formatNum(topCEVolInc.ceVolDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top PE Volume Increase</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(topPEVolInc.strike)}</p>
            <p className="text-xs text-emerald-400/70 mt-1">+{formatNum(topPEVolInc.peVolDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top CE OI Increase</p>
            <p className="text-2xl font-bold text-red-400">{formatNum(topCEOIInc.strike)}</p>
            <p className="text-xs text-red-400/70 mt-1">+{formatNum(topCEOIInc.ceOIDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top PE OI Increase</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(topPEOIInc.strike)}</p>
            <p className="text-xs text-emerald-400/70 mt-1">+{formatNum(topPEOIInc.peOIDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top CE Volume Reduction</p>
            <p className="text-2xl font-bold text-red-400">{formatNum(topCEVolDec.strike)}</p>
            <p className="text-xs text-red-400/70 mt-1">{formatNum(topCEVolDec.ceVolDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top PE Volume Reduction</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(topPEVolDec.strike)}</p>
            <p className="text-xs text-emerald-400/70 mt-1">{formatNum(topPEVolDec.peVolDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top CE OI Reduction</p>
            <p className="text-2xl font-bold text-red-400">{formatNum(topCEOIDec.strike)}</p>
            <p className="text-xs text-red-400/70 mt-1">{formatNum(topCEOIDec.ceOIDiff)}</p>
         </div>
         <div className="bg-[#161925]/60 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top PE OI Reduction</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(topPEOIDec.strike)}</p>
            <p className="text-xs text-emerald-400/70 mt-1">{formatNum(topPEOIDec.peOIDiff)}</p>
         </div>
      </div>

      <div className="bg-gradient-to-r from-[#8b5cf6]/10 to-[#ec4899]/10 border border-[#8b5cf6]/20 p-6 rounded-xl mb-8 flex gap-4 items-start">
         <BrainCircuit size={32} className="text-[#8b5cf6] shrink-0 mt-1"/>
         <div>
            <h4 className="font-bold text-white mb-2 flex items-center gap-2">AI Flow Summary for {currentSymbol}</h4>
            <p className="text-gray-300 leading-relaxed text-sm">
              Over the last {timeDiff}, the dominant flow at strike {topCEOIInc.strike} CE (+{formatNum(topCEOIInc.ceOIDiff)} OI) indicates fresh resistance formation. 
              Simultaneously, PE writing is focused around {topPEOIInc.strike} (+{formatNum(topPEOIInc.peOIDiff)} OI), providing a strong floor. 
              {topCEOIDec.ceOIDiff < 0 ? ` Note the unwinding at ${topCEOIDec.strike} CE, which suggests short covering.` : ''}
              Overall intraday positioning points towards a {topPEOIInc.peOIDiff > topCEOIInc.ceOIDiff ? 'bullish' : 'bearish to neutral'} bias in this time window.
            </p>
         </div>
      </div>

      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Strike-by-Strike Breakdown</h4>
      <div className="overflow-x-auto custom-scrollbar bg-[#0f111a]/50 rounded-xl border border-white/5">
         <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#161925] border-b border-white/10 text-gray-400">
               <tr>
                  <th className="p-3 font-semibold sticky left-0 bg-[#161925]">Strike</th>
                  <th className="p-3 font-semibold text-center text-gray-300 border-l border-white/5" colSpan={4}>Volume Shifts</th>
                  <th className="p-3 font-semibold text-center text-gray-300 border-l border-white/5" colSpan={3}>OI Shifts</th>
                  <th className="p-3 font-semibold border-l border-white/5" colSpan={3}>Intraday Inference</th>
               </tr>
               <tr className="border-b border-white/10 text-xs">
                  <th className="p-2 font-medium sticky left-0 bg-[#161925]"></th>
                  <th className="p-2 font-medium text-gray-500 border-l border-white/5">Prev Vol (CE|PE)</th>
                  <th className="p-2 font-medium text-gray-500">Curr Vol (CE|PE)</th>
                  <th className="p-2 font-medium text-gray-500">Vol Diff</th>
                  <th className="p-2 font-medium text-gray-500">% Chg</th>
                  <th className="p-2 font-medium text-gray-500 border-l border-white/5">Prev OI</th>
                  <th className="p-2 font-medium text-gray-500">Curr OI</th>
                  <th className="p-2 font-medium text-gray-500">OI Diff</th>
                  <th className="p-2 font-medium text-gray-500 border-l border-white/5">Interpretation</th>
                  <th className="p-2 font-medium text-gray-500">Confidence</th>
                  <th className="p-2 font-medium text-gray-500">Suggested Action</th>
               </tr>
            </thead>
            <tbody>
               {rows.map(r => (
                  <tr key={r.strike} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                     <td className="p-2 font-bold text-white sticky left-0 bg-[#0f111a] border-r border-white/5">{formatNum(r.strike)}</td>
                     
                     <td className="p-2 text-gray-400"><span className="text-red-400/50">{formatNum(r.prev.callVol)}</span> | <span className="text-emerald-400/50">{formatNum(r.prev.putVol)}</span></td>
                     <td className="p-2 text-gray-300"><span className="text-red-400">{formatNum(r.curr.callVol)}</span> | <span className="text-emerald-400">{formatNum(r.curr.putVol)}</span></td>
                     <td className="p-2 font-medium text-gray-300">
                        <span className={r.ceVolDiff > 0 ? "text-red-400" : "text-gray-500"}>{r.ceVolDiff > 0 ? '+' : ''}{formatNum(r.ceVolDiff)}</span> |{' '}
                        <span className={r.peVolDiff > 0 ? "text-emerald-400" : "text-gray-500"}>{r.peVolDiff > 0 ? '+' : ''}{formatNum(r.peVolDiff)}</span>
                     </td>
                     <td className="p-2 font-medium text-gray-300">
                        <span className={r.ceVolPct > 0 ? "text-red-400" : "text-gray-500"}>{r.ceVolPct.toFixed(1)}%</span> |{' '}
                        <span className={r.peVolPct > 0 ? "text-emerald-400" : "text-gray-500"}>{r.peVolPct.toFixed(1)}%</span>
                     </td>

                     <td className="p-2 text-gray-400 border-l border-white/5"><span className="text-red-400/50">{formatNum(r.prev.callOI)}</span> | <span className="text-emerald-400/50">{formatNum(r.prev.putOI)}</span></td>
                     <td className="p-2 text-gray-300"><span className="text-red-400">{formatNum(r.curr.callOI)}</span> | <span className="text-emerald-400">{formatNum(r.curr.putOI)}</span></td>
                     <td className="p-2 font-bold">
                        <span className={r.ceOIDiff > 0 ? "text-red-400" : r.ceOIDiff < 0 ? "text-red-400" : "text-gray-500"}>{r.ceOIDiff > 0 ? '+' : ''}{formatNum(r.ceOIDiff)}</span> |{' '}
                        <span className={r.peOIDiff > 0 ? "text-emerald-400" : r.peOIDiff < 0 ? "text-emerald-400" : "text-gray-500"}>{r.peOIDiff > 0 ? '+' : ''}{formatNum(r.peOIDiff)}</span>
                     </td>

                     <td className="p-2 border-l border-white/5">
                       <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.interpretation.includes('Call') || r.interpretation.includes('Short Covering') ? 'bg-red-500/20 text-red-400' : r.interpretation.includes('Put') || r.interpretation.includes('Long') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                         {r.interpretation}
                       </span>
                     </td>
                     <td className="p-2">
                        <span className={`text-xs font-bold ${r.confidence === 'High' ? 'text-amber-400' : r.confidence === 'Medium' ? 'text-blue-400' : 'text-gray-500'}`}>{r.confidence}</span>
                     </td>
                     <td className="p-2 text-gray-300 text-xs font-medium">{r.suggestedAction}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

    </div>
  );
}
