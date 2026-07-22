"use client";

import { useState } from "react";
import OptionAnalyzer from "@/components/OptionAnalyzer";
import MarketActivityScanner from "@/components/MarketActivityScanner";
import WeeklyIntelligenceDashboard from "@/modules/weekly-intelligence/dashboard";
import RolloverAnalyzer from "@/components/RolloverAnalyzer";
import IntradayComparisonStudio from "@/components/IntradayComparisonStudio";
import HistoricalPCRLab from "@/modules/historical-pcr";

export default function Home() {
  const [activeWorkflow, setActiveWorkflow] = useState<"institutional" | "market-activity" | "weekly-intelligence" | "rollover" | "intraday-studio" | "historical-pcr">("institutional");

  return (
    <main style={{ padding: "2rem", maxWidth: "1600px", margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
          Institutional Derivatives Analytics
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "2rem" }}>
          Advanced Options Rollover, Calendar Spread Engine & Smart Money Positioning
        </p>

        {/* High-Level Workflow Tabs */}
        <div className="flex justify-center flex-wrap gap-4 mb-4">
          <button
            onClick={() => setActiveWorkflow("institutional")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "institutional"
                ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Institutional Terminal
          </button>
          <button
            onClick={() => setActiveWorkflow("market-activity")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "market-activity"
                ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Market Activity Scanner
          </button>
          <button
            onClick={() => setActiveWorkflow("weekly-intelligence")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "weekly-intelligence"
                ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Weekly Intelligence Lab
          </button>
          <button
            onClick={() => setActiveWorkflow("rollover")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "rollover"
                ? "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Rollover Analysis
          </button>
          <button
            onClick={() => setActiveWorkflow("intraday-studio")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "intraday-studio"
                ? "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Intraday Comparison Studio
          </button>
          <button
            onClick={() => setActiveWorkflow("historical-pcr")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeWorkflow === "historical-pcr"
                ? "bg-gradient-to-r from-[#10b981] to-[#3b82f6] text-white shadow-lg shadow-green-500/20"
                : "bg-[#161925]/50 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
            }`}
          >
            Historical PCR Intelligence Lab
          </button>
        </div>
      </header>
      
      {activeWorkflow === "institutional" && <OptionAnalyzer />}
      {activeWorkflow === "market-activity" && <MarketActivityScanner />}
      {activeWorkflow === "weekly-intelligence" && <WeeklyIntelligenceDashboard />}
      {activeWorkflow === "rollover" && <RolloverAnalyzer />}
      {activeWorkflow === "intraday-studio" && <IntradayComparisonStudio />}
      {activeWorkflow === "historical-pcr" && <HistoricalPCRLab />}
    </main>
  );
}
