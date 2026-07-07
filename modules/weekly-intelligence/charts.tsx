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

  // Smart Money Scatter/Bar Data
  const smartMoneyData = smartMoney.map(sm => ({
    strike: sm.strikePrice,
    confidence: sm.confidence.toFixed(1),
    type: sm.type,
    color: sm.type.includes("Writing") ? (sm.type.includes("Call") ? "#ef4444" : "#22c55e") : (sm.type.includes("Call") ? "#22c55e" : "#ef4444")
  })).slice(0, 10); // Top 10 anomalies

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

      {/* Smart Money Anomalies */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', gridColumn: '1 / -1' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Smart Money Flow Anomalies (Top 10)</h3>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={smartMoneyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3142" vertical={false} />
              <XAxis dataKey="strike" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} label={{ value: 'Volume Multiplier', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div style={{ backgroundColor: '#161925', padding: '10px', border: '1px solid #2d3142', borderRadius: '8px' }}>
                        <p style={{ margin: 0, color: '#fff', fontWeight: 'bold' }}>Strike: {data.strike}</p>
                        <p style={{ margin: 0, color: data.color }}>{data.type}</p>
                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>Intensity: {data.confidence}x Avg Vol</p>
                      </div>
                    );
                  }
                  return null;
                }} 
              />
              <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                {smartMoneyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <AiPanel title="Institutional Flow Analysis">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Institutional Summary:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                {smartMoneyData.slice(0, 3).map((sm, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    Strike {sm.strike}: {sm.type} {'★'.repeat(Math.min(5, Math.ceil(parseFloat(sm.confidence))))}
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

