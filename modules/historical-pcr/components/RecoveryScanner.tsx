import { useState, useMemo } from "react";
import { DailyPCRRecord, RecoveryEvent } from "../types";
import { scanForRecoveries, calculateRecoveryStats } from "../utils/pcr-engine";

export default function RecoveryScanner({ records }: { records: DailyPCRRecord[] }) {
  const [metricType, setMetricType] = useState<'volume' | 'oi'>('volume');
  const [threshold, setThreshold] = useState(records[0]?.isEquityOrFuture ? 0.55 : 0.60);
  
  const events = useMemo(() => scanForRecoveries(records, threshold, 1.00, 1.30, metricType), [records, threshold, metricType]);
  const stats = useMemo(() => calculateRecoveryStats(events), [events]);

  return (
    <div className="space-y-6">
       <div className="bg-[#161925]/50 p-6 rounded-xl border border-[var(--border-color)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
             <div>
                <h3 className="text-xl font-bold text-white mb-1">Historical Recovery Scanner</h3>
                <p className="text-[var(--text-secondary)] text-sm">Scan historical data for extreme zones and calculate recovery metrics.</p>
             </div>
             
             <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                   <label className="text-xs text-[var(--text-secondary)]">Extreme Threshold</label>
                   <input 
                      type="number" 
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className="bg-[#1e2333] border border-[var(--border-color)] text-white px-3 py-1.5 rounded-lg text-sm w-24"
                   />
                </div>
                <div className="flex gap-2 self-end">
                    <button 
                       onClick={() => setMetricType('volume')}
                       className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${metricType === 'volume' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
                    >
                        Volume
                    </button>
                    <button 
                       onClick={() => setMetricType('oi')}
                       className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${metricType === 'oi' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
                    >
                        OI
                    </button>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
             <div className="bg-[#1e2333]/50 p-4 rounded-xl border border-[var(--border-color)]">
                <div className="text-[var(--text-secondary)] text-xs mb-1">Avg Recovery Days</div>
                <div className="text-xl font-bold text-white">{stats.averageDays.toFixed(1)}</div>
             </div>
             <div className="bg-[#1e2333]/50 p-4 rounded-xl border border-[var(--border-color)]">
                <div className="text-[var(--text-secondary)] text-xs mb-1">Median / Min / Max</div>
                <div className="text-xl font-bold text-white">{stats.medianDays} / {stats.minDays} / {stats.maxDays}</div>
             </div>
             <div className="bg-[#1e2333]/50 p-4 rounded-xl border border-[var(--border-color)]">
                <div className="text-[var(--text-secondary)] text-xs mb-1">Total Signals</div>
                <div className="text-xl font-bold text-[#3b82f6]">{stats.totalSignals}</div>
             </div>
             <div className="bg-[#1e2333]/50 p-4 rounded-xl border border-[var(--border-color)]">
                <div className="text-[var(--text-secondary)] text-xs mb-1">Success Rate</div>
                <div className="text-xl font-bold text-[#10b981]">{stats.successRate.toFixed(1)}%</div>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-[var(--border-color)] bg-[#1e2333]/30">
                   <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Entry Date</th>
                   <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Max Deviation</th>
                   <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Recovery Date</th>
                   <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Sessions Taken</th>
                   <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Status</th>
                 </tr>
               </thead>
               <tbody>
                 {events.map((event, i) => (
                   <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[#1e2333]/30">
                     <td className="p-3 text-white text-sm whitespace-nowrap">{event.entryDate} <span className="text-xs text-red-400 ml-2">({event.entryPCR.toFixed(3)})</span></td>
                     <td className="p-3 text-white text-sm whitespace-nowrap font-mono">{event.maxDeviationPCR.toFixed(3)}</td>
                     <td className="p-3 text-white text-sm whitespace-nowrap">
                        {event.recoveryDate ? (
                            <>{event.recoveryDate} <span className="text-xs text-[#10b981] ml-2">({event.recoveryPCR?.toFixed(3)})</span></>
                        ) : '-'}
                     </td>
                     <td className="p-3 text-white text-sm whitespace-nowrap">{event.sessionsTaken !== null ? event.sessionsTaken : '-'}</td>
                     <td className="p-3 whitespace-nowrap text-sm">
                        {event.status === 'Recovered' && <span className="text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded text-xs font-bold">Recovered</span>}
                        {event.status === 'Failed' && <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded text-xs font-bold">Failed</span>}
                        {event.status === 'In Progress' && <span className="text-orange-400 bg-orange-400/10 px-2 py-1 rounded text-xs font-bold">In Progress</span>}
                     </td>
                   </tr>
                 ))}
                 {events.length === 0 && (
                   <tr>
                      <td colSpan={5} className="p-4 text-center text-[var(--text-secondary)]">No extreme zones found with current threshold.</td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
       </div>
    </div>
  );
}
