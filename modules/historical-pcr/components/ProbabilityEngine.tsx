import { useMemo } from "react";
import { DailyPCRRecord } from "../types";
import { scanForRecoveries, calculateProbabilities, calculateRecoveryStats } from "../utils/pcr-engine";

export default function ProbabilityEngine({ records }: { records: DailyPCRRecord[] }) {
  const events = useMemo(() => scanForRecoveries(records, 0.60, 1.00, 1.30, 'volume'), [records]);
  const probabilities = useMemo(() => calculateProbabilities(events), [events]);
  const stats = useMemo(() => calculateRecoveryStats(events), [events]);
  
  if (probabilities.length === 0) return null;
  
  // Calculate recommended holding period (e.g. at least 80% probability)
  const recommendation = probabilities.find(p => p.probability >= 0.80) || probabilities[probabilities.length - 1];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       <div className="bg-[#161925]/50 p-6 rounded-xl border border-[var(--border-color)]">
          <h3 className="text-xl font-bold text-white mb-4">Recovery Probability Table</h3>
          
          <div className="space-y-3">
             {probabilities.map((prob, i) => (
                <div key={i} className="flex items-center justify-between">
                   <div className="text-[var(--text-secondary)]">Recovered Within {prob.days} Days</div>
                   <div className="flex items-center gap-3 w-1/2">
                      <div className="flex-1 bg-[#1e2333] h-2.5 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]" 
                            style={{ width: `${prob.probability * 100}%` }}
                         />
                      </div>
                      <span className="font-bold text-white min-w-[50px] text-right">
                         {(prob.probability * 100).toFixed(1)}%
                      </span>
                   </div>
                </div>
             ))}
          </div>
       </div>
       
       <div className="bg-gradient-to-br from-[#10b981]/10 to-[#3b82f6]/10 p-6 rounded-xl border border-[#10b981]/30 flex flex-col justify-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg className="w-32 h-32 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
           </div>
           
           <h3 className="text-lg font-bold text-[#10b981] mb-2 uppercase tracking-wider text-sm">Holding Period Recommendation</h3>
           <div className="text-4xl font-black text-white mb-4">
               {recommendation?.days || stats.medianDays} <span className="text-xl text-[var(--text-secondary)] font-normal">Trading Days</span>
           </div>
           
           <p className="text-[var(--text-secondary)] mb-4">
              Based on historical data, <strong>{recommendation ? (recommendation.probability * 100).toFixed(1) : 0}%</strong> of similar cases recovered within this timeframe.
           </p>
           
           <div className="flex items-center gap-2 mt-auto">
               <span className="text-xs uppercase font-bold text-[var(--text-secondary)]">Confidence</span>
               <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                   recommendation && recommendation.probability >= 0.80 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
               }`}>
                   {recommendation && recommendation.probability >= 0.80 ? 'HIGH' : 'MEDIUM'}
               </span>
           </div>
       </div>
    </div>
  );
}
