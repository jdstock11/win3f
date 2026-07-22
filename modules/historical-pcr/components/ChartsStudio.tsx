import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from "recharts";
import { DailyPCRRecord } from "../types";

export default function ChartsStudio({ records }: { records: DailyPCRRecord[] }) {
  const [metric, setMetric] = useState<'volume' | 'oi'>('volume');
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(Math.min(records.length, 30)); // Show last 30 days default
  
  const data = records.map(r => ({
     date: r.date,
     pcr: metric === 'volume' ? r.volumePCR : r.oiPCR
  })).slice(-zoomEnd);

  const maxPcr = Math.max(...data.map(d => d.pcr));
  const minPcr = Math.min(...data.map(d => d.pcr));

  return (
    <div className="bg-[#161925]/50 p-6 rounded-xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Historical Rolling Trend</h3>
        
        <div className="flex gap-4">
            <div className="flex gap-2">
                <button 
                   onClick={() => setMetric('volume')}
                   className={`px-3 py-1 rounded text-xs transition-colors ${metric === 'volume' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
                >
                    Volume PCR
                </button>
                <button 
                   onClick={() => setMetric('oi')}
                   className={`px-3 py-1 rounded text-xs transition-colors ${metric === 'oi' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
                >
                    OI PCR
                </button>
            </div>
            <select 
               value={zoomEnd}
               onChange={(e) => setZoomEnd(Number(e.target.value))}
               className="bg-[#1e2333] border border-[var(--border-color)] text-white text-xs px-2 py-1 rounded"
            >
               <option value={10}>Last 10 Days</option>
               <option value={30}>Last 30 Days</option>
               <option value={90}>Last 90 Days</option>
               <option value={records.length}>All Time</option>
            </select>
        </div>
      </div>

      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" vertical={false} />
            <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tickMargin={10}
                minTickGap={30}
            />
            <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                domain={[Math.max(0, minPcr - 0.2), maxPcr + 0.2]} 
                tickFormatter={(val) => val.toFixed(2)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e2333', borderColor: '#2a2e3d', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />
            <Legend />
            
            <ReferenceLine y={1.60} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Extreme Bearish', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={1.30} stroke="#f97316" strokeDasharray="3 3" />
            <ReferenceLine y={1.00} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'Neutral Zone', fill: '#94a3b8', fontSize: 10 }} />
            <ReferenceLine y={0.60} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'bottom', value: 'Extreme Bullish', fill: '#10b981', fontSize: 10 }} />
            
            <Line 
               type="monotone" 
               dataKey="pcr" 
               name={metric === 'volume' ? 'Volume PCR' : 'OI PCR'}
               stroke="#3b82f6" 
               strokeWidth={3}
               dot={{ r: 4, fill: '#161925', strokeWidth: 2 }}
               activeDot={{ r: 6, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
