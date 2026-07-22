"use client";

import { useState } from "react";
import { DailyPCRRecord, RecoveryEvent, RecoveryStats } from "./types";
import { parseOptionChainCSV } from "./utils/csv-parser";
import { scanForRecoveries, calculateRecoveryStats } from "./utils/pcr-engine";

// Import components (to be created next)
import DataUploader from "./components/DataUploader";
import DatasetOverview from "./components/DatasetOverview";
import PCRMetricsPanel from "./components/PCRMetricsPanel";
import RecoveryScanner from "./components/RecoveryScanner";
import ChartsStudio from "./components/ChartsStudio";
import InstitutionalCommentary from "./components/InstitutionalCommentary";
import ProbabilityEngine from "./components/ProbabilityEngine";

export default function HistoricalPCRLab() {
  const [records, setRecords] = useState<DailyPCRRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "metrics" | "recovery" | "charts" | "ai">("overview");

  const handleFileUpload = async (files: FileList) => {
    setIsProcessing(true);
    const newRecords: DailyPCRRecord[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.csv')) {
        const parsedRecords = await parseOptionChainCSV(file);
        if (parsedRecords && parsedRecords.length > 0) {
          newRecords.push(...parsedRecords);
        }
      }
    }
    
    setRecords(prev => {
        const combined = [...prev, ...newRecords];
        // Remove duplicates by date
        const unique = Array.from(new Map(combined.map(item => [item.date, item])).values());
        return unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-[#161925]/80 p-6 rounded-2xl border border-[var(--border-color)]">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            Historical PCR Intelligence Lab
          </h2>
          <p className="text-[var(--text-secondary)]">Analyze historical Option Chain data, Volume PCR, OI PCR, and recovery probabilities.</p>
        </div>
        <DataUploader onUpload={handleFileUpload} onReset={() => setRecords([])} isProcessing={isProcessing} />
      </div>

      {records.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-1 flex flex-col gap-4">
             <div className="bg-[#161925]/50 p-4 rounded-xl border border-[var(--border-color)]">
                <nav className="flex flex-col gap-2">
                   {['overview', 'metrics', 'recovery', 'charts', 'ai'].map(tab => (
                       <button 
                         key={tab}
                         onClick={() => setActiveTab(tab as any)}
                         className={`text-left px-4 py-3 rounded-lg transition-all ${
                             activeTab === tab 
                             ? "bg-gradient-to-r from-[#10b981]/20 to-[#3b82f6]/20 border border-[#3b82f6]/50 text-white" 
                             : "hover:bg-[#161925] text-[var(--text-secondary)] hover:text-white"
                         }`}
                       >
                         {tab.charAt(0).toUpperCase() + tab.slice(1)} Dashboard
                       </button>
                   ))}
                </nav>
             </div>
             
             {/* Render Dataset Overview on the side */}
             <DatasetOverview records={records} />
          </div>

          <div className="xl:col-span-3">
             {activeTab === 'overview' && (
                <div className="bg-[#161925]/50 p-6 rounded-xl border border-[var(--border-color)] h-full flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#10b981]/20 to-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4 border border-[#3b82f6]/50">
                            <svg className="w-8 h-8 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Dataset Loaded Successfully</h3>
                        <p className="text-[var(--text-secondary)]">Navigate through the tabs on the left to explore PCR metrics, historical recoveries, and AI commentary.</p>
                    </div>
                </div>
             )}
             {activeTab === 'metrics' && <PCRMetricsPanel records={records} />}
             {activeTab === 'recovery' && (
                <div className="space-y-6">
                    <RecoveryScanner records={records} />
                    <ProbabilityEngine records={records} />
                </div>
             )}
             {activeTab === 'charts' && <ChartsStudio records={records} />}
             {activeTab === 'ai' && <InstitutionalCommentary records={records} />}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-[#161925]/30 rounded-2xl border border-dashed border-[var(--border-color)]">
           <svg className="w-16 h-16 text-[var(--text-secondary)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
           </svg>
           <h3 className="text-xl font-bold text-white mb-2">No Dataset Uploaded</h3>
           <p className="text-[var(--text-secondary)] text-center max-w-md">
              Upload historical Option Chain CSV files (single, multiple, or a complete folder) using the button above to begin analysis.
           </p>
        </div>
      )}
    </div>
  );
}
