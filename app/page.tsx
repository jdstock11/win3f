"use client";

import { useState } from "react";
import OptionAnalyzer from "@/components/OptionAnalyzer";
import MarketActivityScanner from "@/components/MarketActivityScanner";

export default function Home() {
  const [activeWorkflow, setActiveWorkflow] = useState<"institutional" | "market-activity">("institutional");

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
        <div className="flex justify-center gap-4 mb-4">
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
        </div>
      </header>
      
      {activeWorkflow === "institutional" ? <OptionAnalyzer /> : <MarketActivityScanner />}
    </main>
  );
}
