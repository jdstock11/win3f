import React, { useState } from "react";
import { UploadPanel } from "./upload";
import { AnalyticalCharts } from "./charts";
import { StrikeHeatmap } from "./heatmap";
import { MergedDailyData, ProbabilityResult, SmartMoneyFlow, ScoreEngineResult, AiStrategy, HistoricalSimilarity, TopOIRow } from "./types";
import { calculatePCR, identifySmartMoney, calculateMaxPain, getTopOITables, getTopOIAdditionsReductions, calculateVolatilityAndExpectedMove } from "./analytics";
import { generateProbabilities } from "./prediction";
import { computeScoreEngine, generateAiStrategy, computeHistoricalSimilarity } from "./ai-engine";
import { Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Lightbulb, CheckCircle2, XCircle, BrainCircuit, History, Crosshair, BarChart2, Zap, Info, ChevronDown, ChevronUp } from "lucide-react";
import { formatNumber } from "./utils";

export const WeeklyIntelligenceDashboard = () => {
  const [data, setData] = useState<MergedDailyData[] | null>(null);

  if (!data) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <UploadPanel onDataReady={setData} />
      </div>
    );
  }

  // Analytics Engine Execution
  const latestDay = data[data.length - 1];
  const previousDay = data.length > 1 ? data[data.length - 2] : undefined;
  const currentChain = latestDay.chain;
  const previousChain = previousDay?.chain;
  
  const currentPCR = calculatePCR(currentChain);
  const maxPain = calculateMaxPain(currentChain);
  const smartMoney = identifySmartMoney(currentChain, previousChain);
  const topOITables = getTopOITables(currentChain, previousChain);
  const topOIChanges = getTopOIAdditionsReductions(currentChain, previousChain);
  const volatilityMove = calculateVolatilityAndExpectedMove(currentChain);
  const probabilities = generateProbabilities(currentChain);
  
  // AI Engine Execution
  const scoreResult = computeScoreEngine(currentChain, previousChain);
  const aiStrategy = generateAiStrategy(currentChain, scoreResult);
  const historicalSim = computeHistoricalSimilarity(data, currentChain);

  const SummaryCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{title}</p>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.8rem' }}>{value}</h2>
        {subtitle && <p style={{ margin: 0, color, fontSize: '0.8rem', marginTop: '0.5rem' }}>{subtitle}</p>}
      </div>
      <div style={{ backgroundColor: `${color}20`, padding: '0.75rem', borderRadius: '50%' }}>
        <Icon size={24} color={color} />
      </div>
    </div>
  );

  const TableHeader = ({ cols }: { cols: string[] }) => (
    <thead>
      <tr>
        {cols.map((col, idx) => (
          <th key={idx} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #2d3142', color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>{col}</th>
        ))}
        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #2d3142', color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>Explain</th>
      </tr>
    </thead>
  );

  const TopOITable = ({ title, rows, color }: { title: string, rows: TopOIRow[], color: string }) => {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    return (
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
        <h3 style={{ color: color, marginBottom: '1rem', fontSize: '1.1rem' }}>{title}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <TableHeader cols={["Strike", "Current OI", "OI Change", "Volume", "Classification", "Confidence", "Action", "Risk"]} />
            <tbody>
              {rows.map((r, i) => (
                <React.Fragment key={i}>
                  <tr 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: expandedRow === i ? 'rgba(255,255,255,0.02)' : 'transparent', cursor: 'pointer' }}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  >
                    <td style={{ padding: '0.75rem', color: '#fff', fontWeight: 'bold' }}>{r.strike}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(r.oi)}</td>
                    <td style={{ padding: '0.75rem', color: r.oiChange > 0 ? '#22c55e' : '#ef4444' }}>{r.oiChange > 0 ? '+' : ''}{formatNumber(r.oiChange)}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(r.volume)}</td>
                    <td style={{ padding: '0.75rem', color: r.classification.includes("Long Build") || r.classification.includes("Short Covering") ? '#22c55e' : (r.classification.includes("Short Build") || r.classification.includes("Unwinding") ? '#ef4444' : '#eab308') }}>{r.classification}</td>
                    <td style={{ padding: '0.75rem', color: r.confidence === "High" ? '#22c55e' : '#eab308' }}>{r.confidence}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{r.suggestedAction}</td>
                    <td style={{ padding: '0.75rem', color: r.riskLevel === "High" ? '#ef4444' : '#d1d5db' }}>{r.riskLevel}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#8b5cf6' }}>
                      {expandedRow === i ? <ChevronUp size={18} /> : <Info size={18} />}
                    </td>
                  </tr>
                  {expandedRow === i && (
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <td colSpan={9} style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                          <div><strong style={{ color: '#9ca3af' }}>Current OI:</strong> <span style={{ color: '#fff' }}>{formatNumber(r.details.currentOI)}</span></div>
                          <div><strong style={{ color: '#9ca3af' }}>Previous OI:</strong> <span style={{ color: '#fff' }}>{r.details.previousOI === "N/A" ? "N/A" : formatNumber(r.details.previousOI as number)}</span></div>
                          <div><strong style={{ color: '#9ca3af' }}>OI Change:</strong> <span style={{ color: r.details.oiChange > 0 ? '#22c55e' : '#ef4444' }}>{r.details.oiChange > 0 ? '+' : ''}{formatNumber(r.details.oiChange)}</span></div>
                          <div><strong style={{ color: '#9ca3af' }}>Current Prem:</strong> <span style={{ color: '#fff' }}>{r.details.currentPremium.toFixed(2)}</span></div>
                          <div><strong style={{ color: '#9ca3af' }}>Previous Prem:</strong> <span style={{ color: '#fff' }}>{r.details.previousPremium === "N/A" ? "N/A" : (r.details.previousPremium as number).toFixed(2)}</span></div>
                          <div><strong style={{ color: '#9ca3af' }}>Prem Change:</strong> <span style={{ color: r.details.premiumChange === "N/A" ? '#d1d5db' : (r.details.premiumChange as number > 0 ? '#22c55e' : '#ef4444') }}>{r.details.premiumChange === "N/A" ? "N/A" : (r.details.premiumChange as number > 0 ? '+' : '') + (r.details.premiumChange as number).toFixed(2)}</span></div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <div style={{ marginBottom: '0.5rem' }}><strong style={{ color: '#3b82f6' }}>Classification Logic:</strong> <span style={{ color: '#d1d5db', fontFamily: 'monospace', marginLeft: '0.5rem' }}>{r.details.classificationLogic}</span></div>
                          <div><strong style={{ color: '#3b82f6' }}>AI Reasoning:</strong> <span style={{ color: '#d1d5db', marginLeft: '0.5rem' }}>{r.details.reasoning}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const qualityColor = scoreResult.quality === "Excellent" ? "#22c55e" : scoreResult.quality === "Good" ? "#3b82f6" : scoreResult.quality === "Average" ? "#eab308" : "#ef4444";

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Disclaimer Banner */}
      <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '2rem' }}>
        <AlertTriangle size={24} />
        <div>
          <strong>DISCLAIMER:</strong> Institutional outputs are analytical probabilities derived from uploaded historical options data. This is not financial advice.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BrainCircuit size={32} color="#8b5cf6" /> Weekly Intelligence Lab (Institutional Engine)
          </h2>
          <p style={{ color: '#9ca3af', margin: 0 }}>Advanced Probability-based Market Outlook & Decision Engine</p>
        </div>
        <button 
          onClick={() => setData(null)}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
        >
          Upload New Data
        </button>
      </div>

      {/* Trade Quality & Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <SummaryCard 
          title="Trade Quality Meter" 
          value={scoreResult.quality} 
          subtitle="Based on overall AI Confidence"
          icon={Target} 
          color={qualityColor} 
        />
        <SummaryCard 
          title="Market Bias" 
          value={aiStrategy.bias} 
          subtitle={`Confidence: ${aiStrategy.confidence}%`}
          icon={aiStrategy.bias === "Bullish" ? TrendingUp : aiStrategy.bias === "Bearish" ? TrendingDown : Activity} 
          color={aiStrategy.bias === "Bullish" ? "#22c55e" : aiStrategy.bias === "Bearish" ? "#ef4444" : "#eab308"} 
        />
        <SummaryCard 
          title="Probability Meter" 
          value={`${probabilities.bullish}% B / ${probabilities.bearish}% Br`} 
          subtitle={`Sideways: ${probabilities.sideways}%`}
          icon={BarChart2} 
          color="#3b82f6" 
        />
        <SummaryCard 
          title="Max Pain Strike" 
          value={maxPain} 
          subtitle="Theoretical Expiry Level"
          icon={Shield} 
          color="#f97316" 
        />
      </div>

      {/* Volatility & Expected Move */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', marginBottom: '2rem' }}>
        <h3 style={{ color: '#fff', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#f97316" /> Volatility & Expected Move
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div><strong style={{ color: '#9ca3af' }}>ATM Strike:</strong> <span style={{ color: '#fff', fontSize: '1.2rem' }}>{volatilityMove.atmStrike}</span></div>
          <div><strong style={{ color: '#9ca3af' }}>Straddle Premium:</strong> <span style={{ color: '#fff', fontSize: '1.2rem' }}>{volatilityMove.straddlePremium !== "N/A" ? (volatilityMove.straddlePremium as number).toFixed(2) : "N/A"}</span></div>
          <div><strong style={{ color: '#9ca3af' }}>Expected Move:</strong> <span style={{ color: '#fff', fontSize: '1.2rem' }}>{volatilityMove.expectedDailyMove !== "N/A" ? `± ${(volatilityMove.expectedDailyMove as number).toFixed(2)}` : "N/A"}</span></div>
          <div><strong style={{ color: '#9ca3af' }}>Implied Range:</strong> <span style={{ color: '#fff', fontSize: '1.2rem' }}>{volatilityMove.impliedRangeLower !== "N/A" ? `${(volatilityMove.impliedRangeLower as number).toFixed(2)} - ${(volatilityMove.impliedRangeUpper as number).toFixed(2)}` : "N/A"}</span></div>
        </div>
      </div>

      {/* Top 3 CE and PE OI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <TopOITable title="Top 3 CE OI (Resistance Zones)" rows={topOITables.topCE} color="#ef4444" />
        <TopOITable title="Top 3 PE OI (Support Zones)" rows={topOITables.topPE} color="#22c55e" />
      </div>

      {/* Top OI Additions and Reductions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <TopOITable title="Top OI Additions (Calls)" rows={topOIChanges.ceAdditions} color="#ef4444" />
        <TopOITable title="Top OI Additions (Puts)" rows={topOIChanges.peAdditions} color="#22c55e" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <TopOITable title="Top OI Reductions (Calls)" rows={topOIChanges.ceReductions} color="#f97316" />
        <TopOITable title="Top OI Reductions (Puts)" rows={topOIChanges.peReductions} color="#f97316" />
      </div>

      {/* Dynamic AI Score Engine */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', marginBottom: '2rem' }}>
        <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BrainCircuit size={20} color="#3b82f6" /> Dynamic AI Score Engine
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#22c55e' }}>{scoreResult.bullishTotal}</div>
            <div style={{ color: '#22c55e', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Bullish Score</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>{scoreResult.bearishTotal}</div>
            <div style={{ color: '#ef4444', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Bearish Score</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#eab308' }}>{scoreResult.neutralTotal}</div>
            <div style={{ color: '#eab308', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Neutral Score</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#d1d5db' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3142', color: '#9ca3af' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Component</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Score</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Confidence</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>AI Reason</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "PCR Trend", data: scoreResult.pcr },
                { label: "OI Build-up", data: scoreResult.oi },
                { label: "Smart Money", data: scoreResult.smartMoney },
                { label: "Support Proximity", data: scoreResult.support },
                { label: "Resistance Proximity", data: scoreResult.resistance },
                { label: "Volume Skew", data: scoreResult.volume },
                { label: "Historical Context", data: scoreResult.historical },
                { label: "Market Structure", data: scoreResult.marketStructure },
              ].map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#fff' }}>{item.label}</td>
                  <td style={{ padding: '0.75rem', color: '#8b5cf6' }}>{item.data.score}</td>
                  <td style={{ padding: '0.75rem' }}>{item.data.confidence}%</td>
                  <td style={{ padding: '0.75rem' }}>{item.data.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Trade Execution Plan */}
        <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Crosshair size={18} color="#8b5cf6" /> Trade Execution Plan
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: '#d1d5db', fontSize: '0.9rem' }}>
            <div><strong>Market Bias:</strong> <span style={{ color: aiStrategy.bias === 'Bullish' ? '#22c55e' : aiStrategy.bias === 'Bearish' ? '#ef4444' : '#eab308' }}>{aiStrategy.bias}</span></div>
            <div><strong>Confidence:</strong> <span style={{ color: '#fff' }}>{aiStrategy.confidence}%</span></div>
            <div><strong>Suggested Entry:</strong> <span style={{ color: '#fff' }}>{aiStrategy.suggestedEntry}</span></div>
            <div><strong>Confirmation Rule:</strong> <span style={{ color: '#3b82f6' }}>{aiStrategy.confirmationRule}</span></div>
            <div><strong>Target 1:</strong> <span style={{ color: '#22c55e' }}>{aiStrategy.target1}</span></div>
            <div><strong>Target 2:</strong> <span style={{ color: '#22c55e' }}>{aiStrategy.target2}</span></div>
            <div><strong>Stop Loss:</strong> <span style={{ color: '#ef4444' }}>{aiStrategy.suggestedStopLoss}</span></div>
            <div><strong>Risk / Reward:</strong> <span style={{ color: '#fff' }}>{aiStrategy.riskReward}</span></div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Risk:</strong> {aiStrategy.risk}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Reward:</strong> {aiStrategy.reward}</div>
          </div>
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <strong style={{ color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>Execution Rationale:</strong>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', fontSize: '0.85rem' }}>
              {aiStrategy.reasons.map((r, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>)}
            </ul>
          </div>
        </div>

        {/* Avoid Trade Zone & Historical Similarity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h3 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={18} /> Avoid Trade Zone
            </h3>
            <div style={{ color: '#d1d5db', fontSize: '0.95rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                {aiStrategy.avoidTradeZone.lowerBound.toFixed(2)} - {aiStrategy.avoidTradeZone.upperBound.toFixed(2)}
              </div>
              <p style={{ margin: 0 }}><strong>Why?</strong> {aiStrategy.avoidTradeZone.reason}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', flex: 1 }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="#f97316" /> Historical Similarity Engine
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div><strong style={{ color: '#9ca3af' }}>Similar Setups:</strong> <span style={{ color: '#fff' }}>{historicalSim.matchedOccurrences}</span></div>
              <div><strong style={{ color: '#9ca3af' }}>Avg Next-Day:</strong> <span style={{ color: '#fff' }}>{historicalSim.averageNextDayMove}</span></div>
              <div><strong style={{ color: '#9ca3af' }}>Best Outcome:</strong> <span style={{ color: '#22c55e' }}>{historicalSim.bestOutcome}</span></div>
              <div><strong style={{ color: '#9ca3af' }}>Worst Outcome:</strong> <span style={{ color: '#ef4444' }}>{historicalSim.worstOutcome}</span></div>
              <div><strong style={{ color: '#9ca3af' }}>Success Ratio:</strong> <span style={{ color: '#3b82f6' }}>{historicalSim.historicalSuccessRatio}%</span></div>
              <div><strong style={{ color: '#9ca3af' }}>Confidence:</strong> <span style={{ color: '#8b5cf6' }}>{historicalSim.confidenceScore}%</span></div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#d1d5db' }}>
              <strong>Breakdown:</strong> {historicalSim.breakdown.bullish} Bullish / {historicalSim.breakdown.bearish} Bearish / {historicalSim.breakdown.neutral} Neutral
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#d1d5db' }}>
              <strong>Top Matching Dates:</strong> {historicalSim.topMatches.join(", ")}
            </div>
          </div>
          
        </div>
      </div>

      {/* Daily PCR Table */}
      <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', marginBottom: '2rem' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Historical PCR & Sentiment Log</h3>
        <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <TableHeader cols={["Date", "CE OI", "PE OI", "PCR", "Daily Change", "AI Interpretation"]} />
            <tbody>
              {[...data].reverse().map((day, idx, arr) => {
                const dayPcr = calculatePCR(day.chain);
                let ceOI = 0; let peOI = 0;
                day.chain.forEach(r => { ceOI += r.CE?.openInterest || 0; peOI += r.PE?.openInterest || 0; });
                
                const prevDay = arr[idx + 1];
                let prevPcr = prevDay ? calculatePCR(prevDay.chain) : null;
                let dailyChange: number | "N/A" = prevPcr !== null ? dayPcr - prevPcr : "N/A";
                
                let interpretation = "Neutral base";
                if (dayPcr > 1.2) interpretation = "Oversold / Bullish Support";
                else if (dayPcr < 0.8) interpretation = "Overbought / Bearish Resistance";
                if (dailyChange !== "N/A" && typeof dailyChange === "number") {
                  if (dailyChange > 0.1) interpretation += " (Rising Support)";
                  if (dailyChange < -0.1) interpretation += " (Rising Resistance)";
                }

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', color: '#fff' }}>{day.date}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(ceOI)}</td>
                    <td style={{ padding: '0.75rem', color: '#d1d5db' }}>{formatNumber(peOI)}</td>
                    <td style={{ padding: '0.75rem', color: dayPcr > 1 ? '#22c55e' : dayPcr < 0.9 ? '#ef4444' : '#d1d5db' }}>{dayPcr.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', color: dailyChange === "N/A" ? '#d1d5db' : (dailyChange > 0 ? '#22c55e' : '#ef4444') }}>
                      {dailyChange === "N/A" ? "N/A" : (dailyChange > 0 ? '+' : '') + dailyChange.toFixed(3)}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#9ca3af' }}>{interpretation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visualizations (Chart / Heatmap) */}
      <AnalyticalCharts data={data} smartMoney={smartMoney} currentChain={currentChain} />
      <StrikeHeatmap chain={currentChain} />

      {/* Final AI Institutional Conclusion */}
      <div style={{ backgroundColor: '#1e2130', padding: '2rem', borderRadius: '12px', border: '1px solid #3b82f6', marginTop: '2rem' }}>
        <h3 style={{ color: '#3b82f6', margin: '0 0 1.5rem 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Zap size={24} /> AI Institutional Conclusion
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#9ca3af', display: 'block', fontSize: '0.9rem', textTransform: 'uppercase' }}>Market Bias</strong>
              <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>{aiStrategy.institutionalConclusion.marketBias}</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#9ca3af', display: 'block', fontSize: '0.9rem', textTransform: 'uppercase' }}>System Confidence</strong>
              <div style={{ fontSize: '1.5rem', color: '#8b5cf6', fontWeight: 'bold' }}>{aiStrategy.institutionalConclusion.confidence}%</div>
            </div>
            <div>
              <strong style={{ color: '#9ca3af', display: 'block', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Key Drivers</strong>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', fontSize: '0.95rem' }}>
                {aiStrategy.institutionalConclusion.keyReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '0.25rem' }}>Best Overall Strategy</strong>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>{aiStrategy.institutionalConclusion.bestStrategy}</div>
            </div>
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <strong style={{ color: '#22c55e', display: 'block', marginBottom: '0.25rem' }}>Conservative Approach</strong>
              <div style={{ color: '#fff' }}>{aiStrategy.institutionalConclusion.conservativeApproach}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>Aggressive Approach</strong>
              <div style={{ color: '#fff' }}>{aiStrategy.institutionalConclusion.aggressiveApproach}</div>
            </div>
          </div>
        </div>
        <div style={{ backgroundColor: '#161925', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2d3142' }}>
          <strong style={{ color: '#fff', display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem' }}>AI Explanation (Why)</strong>
          <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
            {aiStrategy.institutionalConclusion.explanation}
          </p>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={16} /> Risk Warnings
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#9ca3af', fontSize: '0.9rem' }}>
              {aiStrategy.institutionalConclusion.riskWarnings.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyIntelligenceDashboard;
