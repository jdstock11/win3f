import React, { useState } from "react";
import { UploadPanel } from "./upload";
import { AnalyticalCharts } from "./charts";
import { StrikeHeatmap } from "./heatmap";
import { MergedDailyData, ProbabilityResult, SmartMoneyFlow, ScoreEngineResult, AiStrategy, HistoricalSimilarity } from "./types";
import { calculatePCR, identifySmartMoney, calculateMaxPain } from "./analytics";
import { generateProbabilities } from "./prediction";
import { computeScoreEngine, generateAiStrategy, computeHistoricalSimilarity } from "./ai-engine";
import { Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Lightbulb, CheckCircle2, XCircle, BrainCircuit, History } from "lucide-react";
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
  const currentChain = latestDay.chain;
  
  const currentPCR = calculatePCR(currentChain);
  const maxPain = calculateMaxPain(currentChain);
  const smartMoney = identifySmartMoney(currentChain);
  
  // AI Engine Execution
  const scoreResult = computeScoreEngine(currentChain);
  const aiStrategy = generateAiStrategy(currentChain, scoreResult);
  const historicalSim = computeHistoricalSimilarity(data, currentChain);

  let totalCeOI = 0, totalPeOI = 0;
  currentChain.forEach(r => {
    totalCeOI += r.CE?.openInterest || 0;
    totalPeOI += r.PE?.openInterest || 0;
  });

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

  const qualityColor = scoreResult.quality === "Excellent" ? "#22c55e" : scoreResult.quality === "Good" ? "#3b82f6" : scoreResult.quality === "Average" ? "#eab308" : "#ef4444";

  return (
    <div style={{ padding: '1rem' }}>
      
      {/* Disclaimer Banner */}
      <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '2rem' }}>
        <AlertTriangle size={24} />
        <div>
          <strong>DISCLAIMER:</strong> All outputs are analytical probabilities based on historical market behavior and should not be interpreted as guaranteed predictions or investment advice.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BrainCircuit size={32} color="#8b5cf6" /> Weekly Intelligence Lab (AI Engine)
          </h2>
          <p style={{ color: '#9ca3af', margin: 0 }}>Probability-based Market Outlook based on Historical Options Data</p>
        </div>
        <button 
          onClick={() => setData(null)}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Upload New Data
        </button>
      </div>

      {/* Trade Quality & Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <SummaryCard 
          title="Trade Quality Meter" 
          value={scoreResult.quality} 
          subtitle="Based on total AI Score"
          icon={Target} 
          color={qualityColor} 
        />
        
        <SummaryCard 
          title="Market Bias" 
          value={aiStrategy.bias} 
          subtitle={`Score: ${aiStrategy.qualityScore}/100`}
          icon={aiStrategy.bias === "Bullish" ? TrendingUp : aiStrategy.bias === "Bearish" ? TrendingDown : Activity} 
          color={aiStrategy.bias === "Bullish" ? "#22c55e" : aiStrategy.bias === "Bearish" ? "#ef4444" : "#eab308"} 
        />
        
        <SummaryCard 
          title="Expected Range" 
          value={`${aiStrategy.expectedRange.lowerBound} - ${aiStrategy.expectedRange.upperBound}`} 
          subtitle="AI Computed Bounds"
          icon={Target} 
          color="#8b5cf6" 
        />
        
        <SummaryCard 
          title="Max Pain Strike" 
          value={maxPain} 
          subtitle="Theoretical Expiry Level"
          icon={Shield} 
          color="#f97316" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Score Engine Output */}
        <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="#3b82f6" /> AI Score Engine
          </h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{scoreResult.bullishTotal}</div>
              <div style={{ color: '#22c55e', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Bullish Score</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{scoreResult.bearishTotal}</div>
              <div style={{ color: '#ef4444', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Bearish Score</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#eab308' }}>{scoreResult.neutralTotal}</div>
              <div style={{ color: '#eab308', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Neutral Score</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', color: '#d1d5db' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PCR Trend:</span> <strong>{scoreResult.pcrScore}/20</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>OI Build-up:</span> <strong>{scoreResult.oiScore}/20</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Smart Money:</span> <strong>{scoreResult.smartMoneyScore}/15</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Support:</span> <strong>{scoreResult.supportScore}/10</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Resistance:</span> <strong>{scoreResult.resistanceScore}/10</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volume:</span> <strong>{scoreResult.volumeScore}/10</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Historical:</span> <strong>{scoreResult.historicalScore}/15</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Market Structure:</span> <strong>{scoreResult.marketStructureScore}/10</strong></div>
          </div>
        </div>

        {/* AI Strategy Generator & Historical Similarity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', flex: 1 }}>
            <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lightbulb size={18} color="#8b5cf6" /> AI Strategy Generator
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: '#d1d5db', fontSize: '0.9rem' }}>
              <div><strong>Preferred Strategy:</strong> <span style={{ color: '#fff' }}>{aiStrategy.preferredStrategy}</span></div>
              <div><strong>Risk Reward:</strong> <span style={{ color: '#fff' }}>{aiStrategy.riskReward}</span></div>
              <div><strong>Suggested Entry:</strong> <span style={{ color: '#fff' }}>{aiStrategy.suggestedEntry}</span></div>
              <div><strong>Suggested Stop Loss:</strong> <span style={{ color: '#fff' }}>{aiStrategy.suggestedStopLoss}</span></div>
              <div><strong>Target 1:</strong> <span style={{ color: '#22c55e' }}>{aiStrategy.target1}</span></div>
              <div><strong>Target 2:</strong> <span style={{ color: '#22c55e' }}>{aiStrategy.target2}</span></div>
            </div>
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <strong style={{ color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>Reasons behind recommendation:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', fontSize: '0.85rem' }}>
                {aiStrategy.reasons.map((r, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="#f97316" /> Historical Similarity Analysis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
              <div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>Similar Setups</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{historicalSim.matchedOccurrences}</div>
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>Avg Next-Day Move</div>
                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{historicalSim.averageNextDayMove}</div>
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>Historical Success</div>
                <div style={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: 'bold' }}>{historicalSim.historicalSuccessRatio}%</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Visualizations */}
      <AnalyticalCharts data={data} smartMoney={smartMoney} currentChain={currentChain} />
      
      {/* Heatmap */}
      <StrikeHeatmap chain={currentChain} />
    </div>
  );
};

export default WeeklyIntelligenceDashboard;
