import { DailyPCRRecord } from "../types";

export default function DatasetOverview({ records }: { records: DailyPCRRecord[] }) {
  if (records.length === 0) return null;

  const underlyings = Array.from(new Set(records.map(r => r.underlying)));
  const startDate = records[0].date;
  const endDate = records[records.length - 1].date;

  return (
    <div className="bg-[#161925]/50 p-5 rounded-xl border border-[var(--border-color)]">
      <h3 className="text-lg font-bold mb-4 text-white">Dataset Overview</h3>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
          <span className="text-[var(--text-secondary)]">Underlying(s)</span>
          <span className="font-semibold text-[#3b82f6]">
            {underlyings.length > 1 ? "Multiple" : underlyings[0] || "Unknown"}
          </span>
        </div>
        
        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
          <span className="text-[var(--text-secondary)]">Total Sessions</span>
          <span className="font-semibold text-white">{records.length}</span>
        </div>

        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
          <span className="text-[var(--text-secondary)]">Date Range</span>
          <span className="font-semibold text-white text-sm">
            {startDate} to {endDate}
          </span>
        </div>

        <div className="flex justify-between items-center pb-2">
          <span className="text-[var(--text-secondary)]">Avg Volume PCR</span>
          <span className="font-semibold text-[#10b981]">
            {(records.reduce((acc, curr) => acc + curr.volumePCR, 0) / records.length).toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}
