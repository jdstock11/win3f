import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area
} from "recharts";
import { MergedDailyData, SmartMoneyFlow, OptionChainRow } from "./types";
import { calculatePCR, calculateSupportResistance, analyzeOIShifts } from "./analytics";
import { formatNumber } from "./utils";
import { BrainCircuit, Info, Target, AlertTriangle } from "lucide-react";

interface ChartsProps {
  data: MergedDailyData[];
  smartMoney: SmartMoneyFlow[];
  currentChain: OptionChainRow[]; // latest day chain
}

export const AnalyticalCharts: React.FC<ChartsProps> = ({ data, smartMoney, currentChain }) => {
  // PCR Trend Data
  const pcrTrendData = data.map(day => ({
    date: day.date,
    pcr: calculatePCR(day.chain).toFixed(2),
  }));

  const currentPCR = calculatePCR(currentChain);
  const pcrBias = currentPCR > 1.2 ? "Bullish" : currentPCR < 0.8 ? "Bearish" : "Neutral";

  // Total OI Trend
  const oiTrendData = data.map(day => {
    let ceOi = 0, peOi = 0;
    day.chain.forEach(r => { ceOi += r.CE?.openInterest || 0; peOi += r.PE?.openInterest || 0; });
    return { date: day.date, Calls: ceOi, Puts: peOi };
  });

  const shifts = analyzeOIShifts(currentChain);
  const levels = calculateSupportResistance(currentChain);
  const support = levels.find(l => l.type === "Support")?.strikePrice || 0;
  const resistance = levels.find(l => l.type === "Resistance")?.strikePrice || Infinity;

  const AiPanel = ({ title, children }: any) => (
    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', margin: '0 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        <BrainCircuit size={16} /> AI Interpretation: {title}
      </h4>
      <div style={{ fontSize: '0.9rem', color: '#d1d5db', lineHeight: '1.5' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
      
      {/* PCR Trend Chart */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Historical PCR Trend</h3>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pcrTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPcr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3142" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#161925', borderColor: '#2d3142', color: '#fff' }} />
              <Area type="monotone" dataKey="pcr" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPcr)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <AiPanel title="PCR Analysis">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><strong>Current PCR:</strong> {currentPCR.toFixed(2)}</div>
            <div><strong>Historical Trend:</strong> {pcrTrendData.length > 1 && parseFloat(pcrTrendData[pcrTrendData.length - 1].pcr) > parseFloat(pcrTrendData[0].pcr) ? "Rising" : "Falling"}</div>
            <div><strong>Inst. Sentiment:</strong> {pcrBias}</div>
            <div><strong>Suggested Action:</strong> {pcrBias === "Bullish" ? "Buy on Dips" : pcrBias === "Bearish" ? "Sell on Rallies" : "Delta Neutral"}</div>
            <div><strong>Risk Level:</strong> {currentPCR > 1.5 || currentPCR < 0.5 ? "High (Reversal Possible)" : "Moderate"}</div>
            <div><strong>Confidence:</strong> 75%</div>
          </div>
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
            <strong>Interpretation:</strong> The Put-Call ratio indicates {pcrBias.toLowerCase()} positioning by option writers.
          </div>
        </AiPanel>
      </div>

      {/* OI Trend Chart */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Total Open Interest Build-up</h3>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={oiTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3142" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis tickFormatter={(val) => formatNumber(val)} stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#161925', borderColor: '#2d3142', color: '#fff' }} formatter={(val: any) => formatNumber(val)} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="Calls" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Puts" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <AiPanel title="OI Shift Breakdown">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><strong>CE Build-up:</strong> {shifts.filter(s => s.type.includes("Call")).length > 0 ? "Active" : "Quiet"}</div>
            <div><strong>PE Build-up:</strong> {shifts.filter(s => s.type.includes("Put")).length > 0 ? "Active" : "Quiet"}</div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {Array.from(new Set(shifts.map(s => s.type))).slice(0, 4).map(t => (
                <span key={t} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
            <strong>Market Impact:</strong> Aggressive build-ups indicate impending volatility.
            <br /><strong>Suggested Trading Bias:</strong> Follow the dominant fresh writing trend.
          </div>
        </AiPanel>
      </div>

      {/* Smart Money Anomalies Detailed Table */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', gridColumn: '1 / -1' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Smart Money Flow (Institutional Activity)</h3>
        
        <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e2130', zIndex: 10 }}>
              <tr>
                {["Strike", "Signal", "OI", "OI Change", "Volume", "Vol Change", "Prem Change", "Confidence", "Suggested Action"].map((col, idx) => (
                  <th key={idx} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #2d3142', color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {smartMoney.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>No significant institutional anomalies detected in the current session.</td>
                </tr>
              )}
              {smartMoney.map((sm, i) => {
                const isBullish = sm.type.includes("Put Writing") || sm.type.includes("Call Buying");
                const color = isBullish ? '#22c55e' : '#ef4444';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', color: '#fff', fontWeight: 'bold' }}>{sm.strikePrice}</td>
                    <td style={{ padding: '0.75rem', color: color, fontWeight: 'bold' }}>{sm.type}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(sm.oi)}</td>
                    <td style={{ padding: '0.75rem', color: sm.oiChange > 0 ? '#22c55e' : '#ef4444' }}>{sm.oiChange > 0 ? '+' : ''}{formatNumber(sm.oiChange)}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(sm.volume)}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{sm.volumeChange === "N/A" ? "N/A" : (sm.volumeChange > 0 ? '+' : '') + formatNumber(sm.volumeChange as number)}</td>
                    <td style={{ padding: '0.75rem', color: sm.premiumChange === "N/A" ? '#d1d5db' : ((sm.premiumChange as number) > 0 ? '#22c55e' : '#ef4444') }}>
                      {sm.premiumChange === "N/A" ? "N/A" : (sm.premiumChange as number).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#8b5cf6' }}>{sm.confidence.toFixed(1)}x Avg</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{sm.suggestedAction}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <AiPanel title="Institutional Flow Analysis">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Institutional Summary:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                {smartMoney.slice(0, 3).map((sm, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    Strike {sm.strikePrice}: {sm.type} ({sm.confidence.toFixed(1)}x Vol)
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Support Zone:</strong> {support > 0 ? support : "Analyzing..."}</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Resistance Zone:</strong> {resistance !== Infinity ? resistance : "Analyzing..."}</div>
              <div><strong>Expected Trading Range:</strong> {support > 0 && resistance !== Infinity ? `${support} - ${resistance}` : "Awaiting more data"}</div>
            </div>
          </div>
        </AiPanel>
      </div>

    </div>
  );
};


