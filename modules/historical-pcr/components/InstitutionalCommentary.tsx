import { DailyPCRRecord } from "../types";
import { scanForRecoveries, calculateRecoveryStats } from "../utils/pcr-engine";
import { useMemo } from "react";

export default function InstitutionalCommentary({ records }: { records: DailyPCRRecord[] }) {
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const events = useMemo(() => scanForRecoveries(records, 0.60, 1.00, 1.30, 'volume'), [records]);
  const stats = useMemo(() => calculateRecoveryStats(events), [events]);

  if (!latestRecord) return null;

  const generateCommentary = () => {
    let pcrCondition = "Neutral";
    if (latestRecord.volumePCR < 0.60) pcrCondition = "Extreme Bullish Zone";
    else if (latestRecord.volumePCR > 1.60) pcrCondition = "Extreme Bearish Zone";

    return (
      <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
        <p>
          The current Volume PCR stands at <strong className="text-white">{latestRecord.volumePCR.toFixed(3)}</strong>, 
          placing the market in a <strong className={latestRecord.volumePCR < 0.60 ? "text-[#10b981]" : "text-white"}>{pcrCondition}</strong>.
        </p>
        
        <p>
          Historically, our intelligence lab has identified <strong className="text-white">{stats.totalSignals}</strong> similar occurrences 
          where the PCR dipped into extreme zones below the 0.60 threshold. Out of these, <strong className="text-white">{stats.successfulRecoveries}</strong> recovered 
          to the neutral zone (1.00 - 1.30), reflecting a historical success rate of <strong className="text-[#10b981]">{stats.successRate.toFixed(1)}%</strong>.
        </p>

        <p>
          The data suggests an average recovery duration of <strong className="text-white">{stats.averageDays.toFixed(1)} trading sessions</strong>, 
          with the fastest recovery taking just <strong className="text-white">{stats.minDays} session(s)</strong>.
        </p>

        <div className="bg-[#1e2333]/50 border border-[var(--border-color)] p-4 rounded-xl mt-6 relative overflow-hidden">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6]"></div>
           <h4 className="text-white font-bold mb-2">Institutional AI Verdict</h4>
           <p className="text-sm">
             Given the current setup and a success rate of {stats.successRate.toFixed(1)}%, the recommended holding period for reversion strategies is 
             <strong className="text-white ml-1">{stats.medianDays} to {Math.ceil(stats.averageDays)} sessions</strong>. 
             Confidence in mean reversion is <strong className={stats.successRate > 75 ? "text-[#10b981]" : "text-orange-400"}>
               {stats.successRate > 75 ? "HIGH" : "MODERATE"}
             </strong>.
           </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#161925]/50 p-8 rounded-xl border border-[var(--border-color)] relative">
       <div className="absolute top-6 right-6 opacity-20">
           <svg className="w-24 h-24 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
           </svg>
       </div>
       <h3 className="text-2xl font-bold text-white mb-6">Institutional AI Commentary</h3>
       {generateCommentary()}
    </div>
  );
}
