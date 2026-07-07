"use client";

import React, { useMemo } from "react";
import { OptionRow, Dataset } from "./StrategyEngine";
import { generateInstitutionalData, generateDecisionEngine, TopSignalRow, OptionMatrixRow } from "./institutional-analytics";
import { BrainCircuit, Activity, BarChart2, ShieldAlert, Target, Info, CheckCircle2, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  dataset: Dataset;
}

const TableRow = ({ row, type }: { row: TopSignalRow, type: 'bull' | 'bear' }) => (
  <tr className="border-b border-[var(--border-color)] hover:bg-[#1e2233] transition-colors">
    <td className="p-3 font-bold text-white">{row.strike}</td>
    <td className="p-3 text-gray-300">{row.oi.toLocaleString()}</td>
    <td className={`p-3 font-medium ${row.oiChange === "N/A" ? 'text-gray-500' : (row.oiChange > 0 ? 'text-[#10b981]' : 'text-[#ef4444]')}`}>{row.oiChange}</td>
    <td className="p-3 text-gray-300">{row.vol.toLocaleString()}</td>
    <td className="p-3 text-gray-500">{row.volChange}</td>
    <td className={`p-3 font-medium ${row.premChange === "N/A" ? 'text-gray-500' : ((row.premChange as number) > 0 ? 'text-[#10b981]' : 'text-[#ef4444]')}`}>{row.premChange}</td>
    <td className="p-3"><div className="w-full bg-[#161925] rounded-full h-2"><div className="bg-[#8b5cf6] h-2 rounded-full" style={{ width: `${row.confidence}%` }}></div></div></td>
    <td className={`p-3 text-sm ${type === 'bull' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{row.action}</td>
  </tr>
);

export default function InstitutionalDecisionEngine({ dataset }: Props) {
  const { data, atm } = dataset;
  
  const analytics = useMemo(() => generateInstitutionalData(data), [data]);
  const decision = useMemo(() => generateDecisionEngine(data, atm), [data, atm]);

  return (
    <div className="mt-12">
      <h2 className="text-4xl font-bold mb-8 gradient-text tracking-tight border-t border-[var(--border-color)] pt-8">
        Institutional Decision Engine (Live)
      </h2>

      {/* Module 6: Live PCR Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-[#1a1d2d]/80 border border-[var(--border-color)] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Current PCR</div>
          <div className="text-3xl font-extrabold text-blue-400">{decision.pcr.toFixed(3)}</div>
        </div>
        <div className="bg-[#1a1d2d]/80 border border-[var(--border-color)] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Previous PCR</div>
          <div className="text-lg font-bold text-gray-500">{decision.previousPcr}</div>
        </div>
        <div className="bg-[#1a1d2d]/80 border border-[var(--border-color)] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">PCR Momentum</div>
          <div className="text-lg font-bold text-gray-500">{decision.pcrMomentum}</div>
        </div>
        <div className="bg-[#1a1d2d]/80 border border-[var(--border-color)] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Interpretation</div>
          <div className="text-lg font-bold text-amber-400 text-center">{decision.pcrInterpretation}</div>
        </div>
        <div className="bg-[#1a1d2d]/80 border border-[var(--border-color)] p-5 rounded-xl shadow-lg flex flex-col justify-center items-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Suggested Action</div>
          <div className="text-lg font-bold text-emerald-400 text-center">{decision.pcrSuggestedAction}</div>
        </div>
      </div>

      {/* Module 8: Institutional Summary */}
      <div className="bg-[#1a1d2d] border-l-4 border-l-[#8b5cf6] p-6 rounded-r-xl shadow-xl mb-8 flex gap-4 items-start">
        <BrainCircuit size={32} className="text-[#8b5cf6] shrink-0" />
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Institutional Summary</h3>
          <p className="text-gray-300 text-lg leading-relaxed">{decision.institutionalSummary}</p>
        </div>
      </div>

      {/* Module 3: Institutional Positioning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="glass-panel p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#ef4444]">
            <TrendingDown size={20} /> Calls Positioning
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Writing</div>
              <div className="text-2xl font-bold text-red-400">{analytics.positioning.calls.writing.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Buying</div>
              <div className="text-2xl font-bold text-green-400">{analytics.positioning.calls.buying.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Unwinding</div>
              <div className="text-2xl font-bold text-orange-400">{analytics.positioning.calls.unwinding.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Covering</div>
              <div className="text-2xl font-bold text-blue-400">{analytics.positioning.calls.covering.toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#10b981]">
            <TrendingUp size={20} /> Puts Positioning
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Writing</div>
              <div className="text-2xl font-bold text-green-400">{analytics.positioning.puts.writing.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Buying</div>
              <div className="text-2xl font-bold text-red-400">{analytics.positioning.puts.buying.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Unwinding</div>
              <div className="text-2xl font-bold text-orange-400">{analytics.positioning.puts.unwinding.toFixed(1)}%</div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Covering</div>
              <div className="text-2xl font-bold text-blue-400">{analytics.positioning.puts.covering.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Module 1: Top 5 Categories */}
      <div className="space-y-8 mb-8">
        {[
          { title: "Top 5 Call Writing (Bearish / Resistance)", data: analytics.topCeWriting, type: 'bear' as const },
          { title: "Top 5 Put Writing (Bullish / Support)", data: analytics.topPeWriting, type: 'bull' as const },
          { title: "Top 5 Call Buying (Bullish Momentum)", data: analytics.topCeBuying, type: 'bull' as const },
          { title: "Top 5 Put Buying (Bearish Momentum)", data: analytics.topPeBuying, type: 'bear' as const },
          { title: "Top 5 Call Unwinding (Bulls Exiting)", data: analytics.topCeUnwinding, type: 'bear' as const },
          { title: "Top 5 Put Unwinding (Bears Exiting)", data: analytics.topPeUnwinding, type: 'bull' as const },
        ].map((section, idx) => (
          <div key={idx} className="glass-panel p-6 overflow-hidden">
            <h3 className={`text-lg font-bold mb-4 ${section.type === 'bull' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{section.title}</h3>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#161925] text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-3 rounded-tl-lg">Strike</th>
                    <th className="p-3">Current OI</th>
                    <th className="p-3">OI Change</th>
                    <th className="p-3">Volume</th>
                    <th className="p-3">Vol Change</th>
                    <th className="p-3">Prem Change</th>
                    <th className="p-3">Confidence</th>
                    <th className="p-3 rounded-tr-lg">Suggested Action</th>
                  </tr>
                </thead>
                <tbody>
                  {section.data.length > 0 ? (
                    section.data.map((row, i) => <TableRow key={i} row={row} type={section.type} />)
                  ) : (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">No data matched or insufficient data to classify</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Module 2: OI Shift Dashboard (Explanation) */}
      <div className="glass-panel p-6 mb-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Activity className="text-blue-400" /> OI Shift Dashboard
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#161925] p-5 rounded-lg border border-[var(--border-color)]">
            <h4 className="text-lg font-bold text-red-400 mb-2">Fresh Call Writing Detected</h4>
            <p className="text-gray-300 text-sm">
              <strong>Why?</strong> The logic explicitly tracks strikes where Premium decreases (Premium ↓) and Open Interest increases (OI ↑). This directly confirms new supply hitting the market capping the upside.
            </p>
          </div>
          <div className="bg-[#161925] p-5 rounded-lg border border-[var(--border-color)]">
            <h4 className="text-lg font-bold text-green-400 mb-2">Fresh Put Writing Detected</h4>
            <p className="text-gray-300 text-sm">
              <strong>Why?</strong> Detected strictly when Premium decreases (Premium ↓) and Open Interest increases (OI ↑) on the Put side. This confirms institutional participants are collecting premium and creating a strong support base.
            </p>
          </div>
          <div className="bg-[#161925] p-5 rounded-lg border border-[var(--border-color)]">
            <h4 className="text-lg font-bold text-orange-400 mb-2">Long Unwinding Detected</h4>
            <p className="text-gray-300 text-sm">
              <strong>Why?</strong> Tracked when both Premium (Premium ↓) and Open Interest (OI ↓) fall. This signifies existing buyers liquidating their positions and booking profits or stopping out.
            </p>
          </div>
          <div className="bg-[#161925] p-5 rounded-lg border border-[var(--border-color)]">
            <h4 className="text-lg font-bold text-blue-400 mb-2">Short Covering Detected</h4>
            <p className="text-gray-300 text-sm">
              <strong>Why?</strong> Tracked when Premium increases (Premium ↑) but Open Interest decreases (OI ↓). Sellers are forcefully buying back their short positions, indicating a potential squeeze.
            </p>
          </div>
        </div>
      </div>

      {/* Module 5: OI Heatmap */}
      <div className="glass-panel p-6 mb-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BarChart2 className="text-orange-400" /> OI Heatmap
        </h3>
        <div className="h-[400px] w-full bg-[#0a0c12] rounded-xl p-4 border border-[var(--border-color)]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={analytics.matrix.filter(d => Math.abs(d.strike - atm) <= 1000)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
              <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Bar dataKey="peOIChange" fill="#10b981" name="Put OI Change" stackId="change" />
              <Bar dataKey="ceOIChange" fill="#ef4444" name="Call OI Change" stackId="change" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module 4: Option Matrix */}
      <div className="glass-panel p-6 mb-8 overflow-hidden">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
          <Activity className="text-purple-400" /> Options Matrix
        </h3>
        <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-[#0f111a] z-10 shadow-md">
              <tr className="text-gray-400 uppercase tracking-wider text-xs">
                <th className="p-3 border-b border-[var(--border-color)]">CE Classification</th>
                <th className="p-3 border-b border-[var(--border-color)]">CE LTP Chg</th>
                <th className="p-3 border-b border-[var(--border-color)]">CE OI Chg</th>
                <th className="p-3 border-b border-[var(--border-color)]">CE OI</th>
                <th className="p-3 border-b border-[var(--border-color)] bg-[#1a1d2d] text-white text-center rounded-t-lg">STRIKE</th>
                <th className="p-3 border-b border-[var(--border-color)]">PE OI</th>
                <th className="p-3 border-b border-[var(--border-color)]">PE OI Chg</th>
                <th className="p-3 border-b border-[var(--border-color)]">PE LTP Chg</th>
                <th className="p-3 border-b border-[var(--border-color)]">PE Classification</th>
              </tr>
            </thead>
            <tbody>
              {analytics.matrix.map((row, i) => (
                <tr key={i} className={`border-b border-[var(--border-color)] hover:bg-[#1e2233] transition-colors ${row.strike === atm ? 'bg-blue-900/20' : ''}`}>
                  <td className={`p-3 font-medium ${row.ceSignal.includes('Build-up') ? (row.ceSignal.includes('Long') ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>{row.ceSignal}</td>
                  <td className="p-3">{row.ceLTPChange}</td>
                  <td className="p-3">{row.ceOIChange}</td>
                  <td className="p-3 text-red-300">{row.ceOI.toLocaleString()}</td>
                  <td className="p-3 font-bold text-white bg-[#161925] text-center border-l border-r border-[var(--border-color)]">{row.strike}</td>
                  <td className="p-3 text-green-300">{row.peOI.toLocaleString()}</td>
                  <td className="p-3">{row.peOIChange}</td>
                  <td className="p-3">{row.peLTPChange}</td>
                  <td className={`p-3 font-medium ${row.peSignal.includes('Build-up') ? (row.peSignal.includes('Long') ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>{row.peSignal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Module 7, 9, 10: Intraday Score, Trade Trigger & Final Decision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Module 9: Intraday Score Engine */}
        <div className="glass-panel p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
            <Target className="text-yellow-400" /> Intraday Score Engine
          </h3>
          <div className="space-y-4">
            {Object.entries(decision.intradayScore).map(([key, val], i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="uppercase text-xs text-gray-400 font-bold w-32">{key.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex-1 mx-4 bg-[#161925] rounded-full h-3 overflow-hidden border border-[var(--border-color)]">
                  <div className={`h-full rounded-full ${(val as number) > 60 ? 'bg-green-500' : (val as number) < 40 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${val}%` }}></div>
                </div>
                <span className="font-bold text-white w-8 text-right">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Module 7: Trade Trigger Dashboard */}
        <div className="glass-panel p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
            <CheckCircle2 className="text-emerald-400" /> Trade Trigger Dashboard
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.2)] p-4 rounded-xl">
              <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2"><TrendingUp size={16}/> Long Trade</h4>
              <div className="text-sm text-gray-300 space-y-2">
                <div><span className="text-gray-500">Trigger:</span> <strong className="text-white">{decision.tradeTrigger.longTrigger}</strong></div>
                <div><span className="text-gray-500">Confirm:</span> {decision.tradeTrigger.longConfirmation}</div>
                <div><span className="text-gray-500">Stop:</span> <span className="text-red-400">{decision.tradeTrigger.longStop}</span></div>
                <div><span className="text-gray-500">Target:</span> <span className="text-green-400">{decision.tradeTrigger.longTarget}</span></div>
              </div>
            </div>
            <div className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)] p-4 rounded-xl">
              <h4 className="text-red-400 font-bold mb-3 flex items-center gap-2"><TrendingDown size={16}/> Short Trade</h4>
              <div className="text-sm text-gray-300 space-y-2">
                <div><span className="text-gray-500">Trigger:</span> <strong className="text-white">{decision.tradeTrigger.shortTrigger}</strong></div>
                <div><span className="text-gray-500">Confirm:</span> {decision.tradeTrigger.shortConfirmation}</div>
                <div><span className="text-gray-500">Stop:</span> <span className="text-red-400">{decision.tradeTrigger.shortStop}</span></div>
                <div><span className="text-gray-500">Target:</span> <span className="text-green-400">{decision.tradeTrigger.shortTarget}</span></div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-between bg-[#1a1d2d] p-3 rounded-lg border border-[var(--border-color)]">
            <div className="text-sm"><span className="text-gray-400 block text-xs">Expected Range</span><strong className="text-white">{decision.tradeTrigger.expectedRange}</strong></div>
            <div className="text-sm text-right"><span className="text-gray-400 block text-xs">Dynamic Avoid Zone</span><strong className="text-amber-400">{decision.tradeTrigger.avoidZone}</strong></div>
          </div>
        </div>
      </div>

      {/* Module 10: Final Trading Decision */}
      <div className="glass-panel p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#8b5cf6]"></div>
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
          <BrainCircuit className="text-[#8b5cf6]" size={28} /> Final Trading Decision
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Market Bias</div>
              <div className={`text-2xl font-bold ${decision.finalDecision.bias === 'Bullish' ? 'text-green-400' : decision.finalDecision.bias === 'Bearish' ? 'text-red-400' : 'text-yellow-400'}`}>
                {decision.finalDecision.bias} ({decision.finalDecision.probability}%)
              </div>
            </div>
            <div className="bg-[#161925] p-4 rounded-lg">
              <div className="text-gray-400 text-xs uppercase mb-1">Best Strategy</div>
              <div className="text-xl font-bold text-white">{decision.finalDecision.bestStrategy}</div>
            </div>
          </div>
          <div className="bg-[#161925] p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="text-gray-400 text-xs uppercase mb-2">Trade Logic Checklist</div>
              <ul className="space-y-2 text-sm">
                {decision.finalDecision.tradeChecklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.1)]">
              <div className="text-gray-400 text-xs uppercase mb-1">Risk Warning</div>
              <div className="text-xs text-red-400 flex items-start gap-1">
                <ShieldAlert size={14} className="shrink-0 mt-0.5"/> {decision.finalDecision.riskWarning}
              </div>
            </div>
          </div>
          <div className="bg-[#161925] p-4 rounded-lg space-y-4">
            <div>
              <div className="text-gray-400 text-xs uppercase mb-1">Conservative Plan</div>
              <div className="text-sm font-medium text-blue-300 bg-blue-900/30 p-2 rounded">{decision.finalDecision.conservativePlan}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase mb-1">Aggressive Plan</div>
              <div className="text-sm font-medium text-orange-300 bg-orange-900/30 p-2 rounded">{decision.finalDecision.aggressivePlan}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase mb-1">Invalidation (SL)</div>
              <div className="text-sm font-medium text-red-400">{decision.finalDecision.invalidation}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
