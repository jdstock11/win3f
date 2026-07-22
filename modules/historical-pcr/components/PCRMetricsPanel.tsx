import { useState } from "react";
import { DailyPCRRecord } from "../types";
import { getPCRClassification } from "../utils/pcr-engine";

export default function PCRMetricsPanel({ records }: { records: DailyPCRRecord[] }) {
  const [metricType, setMetricType] = useState<'volume' | 'oi'>('volume');
  
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Strong Bullish": return "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30";
      case "Bullish": return "text-green-400 bg-green-400/10 border-green-400/30";
      case "Neutral Bullish": return "text-teal-400 bg-teal-400/10 border-teal-400/30";
      case "Neutral": return "text-gray-400 bg-gray-400/10 border-gray-400/30";
      case "Neutral Bearish": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
      case "Bearish": return "text-red-500 bg-red-500/10 border-red-500/30";
      default: return "text-gray-400 bg-gray-400/10 border-gray-400/30";
    }
  };

  return (
    <div className="bg-[#161925]/50 p-6 rounded-xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Daily PCR Metrics</h3>
        <div className="flex gap-2">
            <button 
               onClick={() => setMetricType('volume')}
               className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${metricType === 'volume' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
            >
                Volume PCR
            </button>
            <button 
               onClick={() => setMetricType('oi')}
               className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${metricType === 'oi' ? 'bg-[#3b82f6] text-white' : 'bg-[#1e2333] text-[var(--text-secondary)] hover:text-white'}`}
            >
                OI PCR
            </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[#1e2333]/50 sticky top-0 backdrop-blur-md">
              <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Date</th>
              {records[0]?.isEquityOrFuture ? (
                 <>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">High</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Low</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Close</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Total Volume</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Vol PCR</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Total OI</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">OI PCR</th>
                 </>
              ) : (
                 <>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Total Call {metricType === 'volume' ? 'Vol' : 'OI'}</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Total Put {metricType === 'volume' ? 'Vol' : 'OI'}</th>
                    <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">PCR</th>
                 </>
              )}
              <th className="p-3 text-sm font-semibold text-[var(--text-secondary)] whitespace-nowrap">Classification</th>
            </tr>
          </thead>
          <tbody>
            {[...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record, i) => {
              const pcr = metricType === 'volume' ? record.volumePCR : record.oiPCR;
              const classification = getPCRClassification(pcr, record.isEquityOrFuture);
              
              return (
                <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[#1e2333]/30 transition-colors">
                  <td className="p-3 text-white text-sm whitespace-nowrap">{record.date}</td>
                  {record.isEquityOrFuture ? (
                     <>
                        <td className="p-3 text-green-400 text-sm whitespace-nowrap">{record.high?.toFixed(2) || '-'}</td>
                        <td className="p-3 text-red-400 text-sm whitespace-nowrap">{record.low?.toFixed(2) || '-'}</td>
                        <td className="p-3 font-bold text-white text-sm whitespace-nowrap">{record.close?.toFixed(2) || '-'}</td>
                        <td className="p-3 text-gray-300 text-sm whitespace-nowrap">{record.callVolume.toLocaleString()}</td>
                        <td className="p-3 font-mono text-[#3b82f6] font-bold text-sm whitespace-nowrap">{record.volumePCR.toFixed(4)}</td>
                        <td className="p-3 text-gray-300 text-sm whitespace-nowrap">{record.callOI.toLocaleString()}</td>
                        <td className="p-3 font-mono text-[#8b5cf6] font-bold text-sm whitespace-nowrap">{record.oiPCR.toFixed(4)}</td>
                     </>
                  ) : (
                     <>
                        <td className="p-3 text-gray-300 text-sm whitespace-nowrap">
                            {metricType === 'volume' ? record.callVolume.toLocaleString() : record.callOI.toLocaleString()}
                        </td>
                        <td className="p-3 text-gray-300 text-sm whitespace-nowrap">
                            {metricType === 'volume' ? record.putVolume.toLocaleString() : record.putOI.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold text-white text-sm whitespace-nowrap">{pcr.toFixed(4)}</td>
                     </>
                  )}
                  <td className="p-3 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${getClassificationColor(classification)}`}>
                         {classification}
                      </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
