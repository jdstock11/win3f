"use client";

import React, { useState, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, ReferenceDot, AreaChart, Area, ComposedChart, Bar
} from "recharts";
import { Upload, Download, TrendingUp, TrendingDown, ArrowRight, Activity, ShieldAlert, BarChart2, Filter, ChevronDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Add autotable to jsPDF
// @ts-ignore
jsPDF.API.autotable = autoTable;

// --- Interfaces ---
interface BhavData {
  symbol: string;
  date: string;
  expiry: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

interface RolloverDayData {
  date: string;
  currentClose: number;
  nextClose: number;
  currentVolume: number;
  nextVolume: number;
  currentOI: number;
  nextOI: number;
  rollover: boolean; // Next Vol > Cur Vol
  buildup: "Long Build-up" | "Short Build-up" | "Short Covering" | "Long Unwinding" | "Neutral";
  sentiment: string; // Aggressive Bullish, etc.
  high: number;
  low: number;
  close: number;
  
  // Percentages
  RolloverPct: number;
  volMigrationPct: number;
  priceChangePct: number;
  oiChangePct: number;
  volChangePct: number;
  
  // Scoring
  TrendStrength: number;
  strengthCategory: "Weak" | "Moderate" | "Strong" | "Aggressive";
  Prediction: string;
  expiryPhase: string;
  IsShiftDate: boolean;
  
  // Reference
  DateObj: Date; 
}

export default function RolloverAnalyzer() {
  const [currentData, setCurrentData] = useState<BhavData[]>([]);
  const [nextData, setNextData] = useState<BhavData[]>([]);
  const [analysisData, setAnalysisData] = useState<RolloverDayData[]>([]);

  const [currentFile, setCurrentFile] = useState<string>("");
  const [nextFile, setNextFile] = useState<string>("");
  
  const [symbolFilter, setSymbolFilter] = useState<string>("NIFTY");
  const [volThreshold, setVolThreshold] = useState<number>(0);
  const [oiThreshold, setOiThreshold] = useState<number>(0);

  // Debugging state
  const [debugLog, setDebugLog] = useState<any>(null);
  
  // Handlers
  const parseCSV = (file: File, type: "current" | "next") => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          console.error("CSV Empty");
          setDebugLog({ error: "CSV parsed but got 0 rows. Is it empty?" });
          return;
        }

        const rawSample = results.data[0];
        setDebugLog({
          type,
          totalRows: results.data.length,
          headers: Object.keys(rawSample || {}),
          sampleRow: rawSample
        });

        processData(results.data as any[], type);
      },
      error: (error) => {
        setDebugLog({ error: error.message });
      }
    });
  };

  const processData = (rows: any[], type: "current" | "next") => {
    const cleaned = rows.map((row) => {
      const findKey = (searchKeys: string[]) => {
        const rowKeys = Object.keys(row);
        const match = rowKeys.find(k => searchKeys.includes(String(k).toUpperCase().trim()));
        return match ? row[match] : null;
      };

      const rawSym = findKey(["SYMBOL"]) || "NIFTY"; 
      const rawDate = findKey(["TIMESTAMP", "DATE", "TRADEDATE", "DATE "]);
      const rawExp = findKey(["EXPIRY_DT", "EXPIRY_DATE", "EXPIRY", "EXPIRY DATE", "EXPIRY DATE "]);
      
      const cleanNum = (val: any) => {
        if (val === null || val === undefined || val === "-") return 0;
        if (typeof val === "number") return val;
        return Number(String(val).replace(/,/g, "").trim()) || 0;
      };

      return {
        symbol: String(rawSym),
        date: String(rawDate),
        expiry: String(rawExp || ""),
        open: cleanNum(findKey(["OPEN", "OPEN_PRIC", "OPEN PRICE", "OPEN "])),
        high: cleanNum(findKey(["HIGH", "HIGH_PRICE", "HIGH PRICE", "HIGH "])),
        low: cleanNum(findKey(["LOW", "LOW_PRICE", "LOW PRICE", "LOW "])),
        close: cleanNum(findKey(["CLOSE", "CLOSE_PRICE", "CLOSE PRICE", "CLOSE ", "SETTLE PRICE", "SETTLE PRICE "])),
        volume: cleanNum(findKey(["CONTRACTS", "TOTTRDQTY", "VOLUME", "TRADED_QTY", "NO. OF CONTRACTS", "NO. OF CONTRACTS ", "TURN OVER IN LACS"])),
        oi: cleanNum(findKey(["OPEN_INT", "OI", "OPEN INT", "OPEN INT ", "OPENINTEREST", "OPEN INTEREST", "CHG_IN_OI", "CHANGE IN OI"]))
      };
    });
    
    let validData = cleaned.filter(d => d.close > 0);
    
    if (validData.length === 0 && cleaned.length > 0) {
       validData = cleaned.filter(d => d.date && d.date !== "null");
    }

    if (type === "current") {
      setCurrentData(validData);
    } else {
      setNextData(validData);
    }
  };

  const handleCurrentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentFile(file.name);
    parseCSV(file, "current");
  };

  const handleNextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNextFile(file.name);
    parseCSV(file, "next");
  };

  // Auto Run Analysis
  useEffect(() => {
    if (currentData.length > 0 && nextData.length > 0) {
      console.log("Running Rollover Analysis automatically...");
      runRolloverAnalysis();
    }
  }, [currentData, nextData, symbolFilter, volThreshold, oiThreshold]);

  const runRolloverAnalysis = () => {
    const cData = currentData.filter(d => d.symbol.toUpperCase().includes(symbolFilter.toUpperCase()));
    const nData = nextData.filter(d => d.symbol.toUpperCase().includes(symbolFilter.toUpperCase()));

    const formatDate = (rawDate: string) => {
      const cleanTs = rawDate.trim();
      let d = new Date(cleanTs);
      if (isNaN(d.getTime())) {
        const parts = cleanTs.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          d = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
        }
      }
      return isNaN(d.getTime()) ? cleanTs : d.toISOString().split("T")[0];
    };

    const cMap = new Map();
    cData.forEach(c => {
       cMap.set(formatDate(c.date), c);
    });

    let shiftFound = false;

    const merged = nData.map((next, i) => {
      const normalizedDate = formatDate(next.date);
      const curr = cMap.get(normalizedDate);

      if (!curr) return null;

      const prevNext = i > 0 ? nData[i - 1] : null;

      const rollover = next.volume > curr.volume;
      let isShiftDate = false;
      
      if (rollover && !shiftFound) {
        shiftFound = true;
        isShiftDate = true;
      }

      // Delta Calculations
      const priceChangePct = prevNext && prevNext.close ? ((next.close - prevNext.close) / prevNext.close) * 100 : 0;
      const oiChangePct = prevNext && prevNext.oi ? ((next.oi - prevNext.oi) / prevNext.oi) * 100 : 0;
      const volChangePct = prevNext && prevNext.volume ? ((next.volume - prevNext.volume) / prevNext.volume) * 100 : 0;

      const priceUp = prevNext ? next.close > prevNext.close : next.close > next.open;
      const priceDown = prevNext ? next.close < prevNext.close : next.close < next.open;
      const oiUp = prevNext ? next.oi > prevNext.oi : next.oi > 0;
      const oiDown = prevNext ? next.oi < prevNext.oi : next.oi < 0;

      // 1. OI + Price Matrix Engine
      let buildup: RolloverDayData["buildup"] = "Neutral";
      if (priceUp && oiUp) buildup = "Long Build-up";
      else if (priceDown && oiUp) buildup = "Short Build-up";
      else if (priceUp && oiDown) buildup = "Short Covering";
      else if (priceDown && oiDown) buildup = "Long Unwinding";

      let sentiment = "Neutral";
      let prediction = "Sideways Expiry";

      if (rollover && buildup === "Long Build-up") {
        sentiment = "Strong Long Rollover";
        prediction = "Bullish Continuation";
      } else if (rollover && buildup === "Short Build-up") {
        sentiment = "Strong Short Rollover";
        prediction = "Bearish Continuation";
      } else if (buildup === "Long Unwinding") {
        sentiment = "Long Unwinding";
        prediction = "Volatile / Weak Pullback";
      } else if (buildup === "Short Covering") {
        sentiment = "Short Covering";
        prediction = "Volatile / Relief Rally";
      }

      // Vol Migration
      const totalVol = curr.volume + next.volume;
      const volMigrationPct = totalVol ? (next.volume / totalVol) * 100 : 0;

      // Strength Score
      let trendScore = 50;
      if (buildup === "Long Build-up" || buildup === "Short Build-up") trendScore += 20;
      else if (buildup === "Short Covering" || buildup === "Long Unwinding") trendScore += 10;
      
      if (volMigrationPct > 50) trendScore += 20;
      else if (volMigrationPct > 30) trendScore += 10;
      
      if (Math.abs(priceChangePct) > 1) trendScore += 20;
      else if (Math.abs(priceChangePct) > 0.5) trendScore += 10;
      
      trendScore = Math.max(0, Math.min(100, trendScore));

      let strengthCategory: RolloverDayData["strengthCategory"] = "Weak";
      if (trendScore >= 75) strengthCategory = "Aggressive";
      else if (trendScore >= 50) strengthCategory = "Strong";
      else if (trendScore >= 25) strengthCategory = "Moderate";

      // Phase Classification
      let phase = "Early Rollover";
      if (volMigrationPct > 80) phase = "Final Settlement";
      else if (volMigrationPct > 60) phase = "Aggressive Rollover";
      else if (volMigrationPct > 40) phase = "Mid Rollover";

      if (next.volume < volThreshold || next.oi < oiThreshold) return null;

      const totalOI = curr.oi + next.oi;

      let dateObj = new Date(next.date);
      if (isNaN(dateObj.getTime())) {
        const parts = next.date.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          dateObj = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
        }
      }

      return {
        date: next.date,
        DateObj: dateObj,
        currentClose: curr.close,
        nextClose: next.close,
        currentVolume: curr.volume,
        nextVolume: next.volume,
        currentOI: curr.oi,
        nextOI: next.oi,
        rollover,
        buildup,
        sentiment,
        high: next.high,
        low: next.low,
        close: next.close,
        RolloverPct: totalOI ? (next.oi / totalOI) * 100 : 0,
        volMigrationPct,
        priceChangePct,
        oiChangePct,
        volChangePct,
        VolumeDiffPct: curr.volume ? ((next.volume - curr.volume) / curr.volume) * 100 : 0,
        OIDiffPct: prevNext && prevNext.oi ? ((next.oi - prevNext.oi) / prevNext.oi) * 100 : 0,
        TrendStrength: trendScore,
        strengthCategory,
        Prediction: prediction,
        expiryPhase: phase,
        IsShiftDate: isShiftDate
      };
    }).filter(Boolean) as RolloverDayData[];

    merged.sort((a, b) => a.DateObj.getTime() - b.DateObj.getTime());
    setAnalysisData(merged);
  };

  const latestData = analysisData.length > 0 ? analysisData[analysisData.length - 1] : null;
  const shiftDates = analysisData.filter(a => a.IsShiftDate);

  // Insights Logic
  const insights = useMemo(() => {
    if (!analysisData.length) return [];
    const messages = [];
    const recent = analysisData[analysisData.length - 1];
    
    if (recent.sentiment === "Strong Long Rollover") {
      messages.push("Aggressive Long Carry Forward: Institutional buying evident.");
    } else if (recent.sentiment === "Strong Short Rollover") {
      messages.push("Aggressive Short Carry Forward: Institutional selling pressure.");
    } else if (recent.sentiment === "Short Covering") {
      messages.push("Institutional Hedging Zone: Shorts are being covered.");
    } else if (recent.sentiment === "Long Unwinding") {
      messages.push("Liquidation Phase: Long positions are exiting.");
    }

    if (recent.RolloverPct > 70) {
      messages.push("High conviction rollover: Majority positions shifted.");
    } else if (recent.RolloverPct < 30) {
      messages.push("Weak Rollover Participation: Low conviction in next expiry.");
    }

    if (shiftDates.length > 0) {
      messages.push(`Expiry Pressure Zone from Shift Date (${shiftDates[0].date}). Pivot: ${shiftDates[0].close}`);
      messages.push(`Strong Support Created: ${shiftDates[0].low}`);
      messages.push(`Strong Resistance Created: ${shiftDates[0].high}`);
    }

    return messages;
  }, [analysisData, shiftDates]);

  // Exports
  const exportCSV = () => {
    if (!analysisData.length) return;
    const ws = XLSX.utils.json_to_sheet(analysisData.map(a => ({
      ...a,
      DateObj: undefined
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rollover");
    XLSX.writeFile(wb, "rollover_analysis.xlsx");
  };

  const exportPDF = () => {
    if (!analysisData.length) return;
    const doc = new jsPDF();
    doc.text("Rollover Analysis Report", 14, 15);
    
    const tableColumn = ["Date", "Status", "Roll %", "Next OI", "Next Vol"];
    const tableRows = analysisData.map(a => [
      a.date, a.sentiment, a.RolloverPct.toFixed(2) + "%", a.nextOI, a.nextVolume
    ]);

    // @ts-ignore
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20
    });
    doc.save("rollover_report.pdf");
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as RolloverDayData;
      return (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-sm font-medium">
          <p className="text-white font-bold mb-2 pb-2 border-b border-slate-700">{label}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <p className="text-slate-400">Next Close:</p>
            <p className="text-indigo-400 text-right">{data.nextClose.toLocaleString()}</p>
            <p className="text-slate-400">Next Vol:</p>
            <p className="text-right text-emerald-400">{data.nextVolume.toLocaleString()}</p>
            <p className="text-slate-400">Cur Vol:</p>
            <p className="text-right text-rose-400">{data.currentVolume.toLocaleString()}</p>
            <p className="text-slate-400">Rollover %:</p>
            <p className="text-right text-amber-400">{data.RolloverPct.toFixed(1)}%</p>
            <p className="text-slate-400">Status:</p>
            <p className={`text-right ${
              data.sentiment === "Long Rollover" || data.sentiment === "Short Covering" 
              ? "text-emerald-400" 
              : data.sentiment === "Short Rollover" || data.sentiment === "Long Unwinding"
              ? "text-rose-400"
              : "text-slate-300"
            }`}>{data.sentiment}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
              <Activity className="text-indigo-400" />
              Expiry Rollover Analysis
            </h1>
            <p className="text-slate-400 mt-1">Institutional-grade rollover detection and derivatives analytics</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={exportCSV} disabled={!analysisData.length} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition-colors border border-slate-700">
              <Download size={16} /> Excel
            </button>
            <button onClick={exportPDF} disabled={!analysisData.length} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition-colors border border-slate-700">
              <Download size={16} /> PDF
            </button>
          </div>
        </div>

        {/* Filters & Import */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl col-span-1 lg:col-span-2 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
              <Upload size={18} className="text-indigo-400"/> Data Import
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-dashed border-slate-700 p-4 rounded-xl hover:border-indigo-500 transition-colors bg-slate-950">
                <label className="block text-sm text-slate-400 mb-2 font-medium">Current Month Expiry (CSV)</label>
                <div className="relative">
                  <input type="file" accept=".csv" onChange={handleCurrentUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex items-center justify-center gap-2 bg-slate-800 py-2 px-4 rounded-lg text-sm">
                    {currentFile ? <CheckCircle2 className="text-emerald-400" size={16} /> : <Upload size={16} />}
                    <span className="truncate">{currentFile || "Upload Current Expiry"}</span>
                  </div>
                </div>
              </div>
              <div className="border border-dashed border-slate-700 p-4 rounded-xl hover:border-indigo-500 transition-colors bg-slate-950">
                <label className="block text-sm text-slate-400 mb-2 font-medium">Next Month Expiry (CSV)</label>
                <div className="relative">
                  <input type="file" accept=".csv" onChange={handleNextUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex items-center justify-center gap-2 bg-slate-800 py-2 px-4 rounded-lg text-sm">
                    {nextFile ? <CheckCircle2 className="text-emerald-400" size={16} /> : <Upload size={16} />}
                    <span className="truncate">{nextFile || "Upload Next Expiry"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl col-span-1 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Filter size={18} className="text-indigo-400" /> Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Symbol</label>
                  <input type="text" value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="e.g. NIFTY" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Min Volume</label>
                    <input type="number" value={volThreshold} onChange={e => setVolThreshold(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Min OI</label>
                    <input type="number" value={oiThreshold} onChange={e => setOiThreshold(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-400 mb-3 flex flex-col gap-1">
                <span>Loaded Current: <strong className={currentData.length ? "text-emerald-400" : "text-slate-500"}>{currentData.length} rows</strong></span>
                <span>Loaded Next: <strong className={nextData.length ? "text-emerald-400" : "text-slate-500"}>{nextData.length} rows</strong></span>
              </div>
              <button 
                onClick={runRolloverAnalysis}
                disabled={!currentData.length || !nextData.length}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 disabled:shadow-none flex justify-center items-center gap-2"
              >
                <BarChart2 size={18} /> Analyze Rollover
              </button>
            </div>
          </div>
        </div>

        {/* Main Advanced Institutional Dashboard */}
        {analysisData.length > 0 ? (
          <div className="space-y-6">
            
            {/* Top Stat Row - Matrix & Build-up */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              
              {/* Build-up Matrix */}
              <div className="bg-[#12141c] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden col-span-2">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Activity size={64} />
                </div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider flex justify-between">
                  <span>Institutional Build-Up</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    latestData?.strengthCategory === "Aggressive" ? "bg-red-500/20 text-red-400" :
                    latestData?.strengthCategory === "Strong" ? "bg-orange-500/20 text-orange-400" :
                    latestData?.strengthCategory === "Moderate" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-slate-700/50 text-slate-400"
                  }`}>
                    {latestData?.strengthCategory} Signal
                  </span>
                </p>
                <div className={`mt-2 flex items-center gap-3 text-2xl font-bold leading-tight ${
                    latestData?.buildup === "Long Build-up" ? "text-emerald-400" : 
                    latestData?.buildup === "Short Build-up" ? "text-rose-500" : 
                    latestData?.buildup === "Short Covering" ? "text-blue-400" :
                    latestData?.buildup === "Long Unwinding" ? "text-orange-400" :
                    "text-slate-300"
                  }`}>
                  {latestData?.buildup === "Long Build-up" ? <TrendingUp size={24} /> : 
                   latestData?.buildup === "Short Build-up" ? <TrendingDown size={24} /> : 
                   latestData?.buildup === "Short Covering" ? <ArrowRight size={24} className="rotate-[-45deg]" /> :
                   latestData?.buildup === "Long Unwinding" ? <ArrowRight size={24} className="rotate-[45deg]" /> :
                   <Activity size={24} />}
                  <span>{latestData?.buildup}</span>
                </div>
                <div className="mt-3 flex gap-4 text-xs">
                  <div className="flex flex-col">
                    <span className="text-slate-500">Price Δ</span>
                    <span className={latestData?.priceChangePct && latestData.priceChangePct > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {latestData?.priceChangePct > 0 ? "+" : ""}{latestData?.priceChangePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500">OI Δ</span>
                    <span className={latestData?.oiChangePct && latestData.oiChangePct > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {latestData?.oiChangePct > 0 ? "+" : ""}{latestData?.oiChangePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Volume Migration */}
              <div className="bg-[#12141c] border border-slate-800 p-4 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-colors col-span-2 md:col-span-1">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider flex justify-between">
                  <span>Vol Migration</span>
                  <span className="text-indigo-400">{latestData?.expiryPhase}</span>
                </p>
                <div className="mt-2 flex items-baseline gap-2 text-2xl font-bold text-white">
                  {latestData?.volMigrationPct.toFixed(1)}%
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(latestData?.volMigrationPct || 0, 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>Cur: {(latestData?.currentVolume || 0).toLocaleString()}</span>
                  <span>Next: {(latestData?.nextVolume || 0).toLocaleString()}</span>
                </p>
              </div>

              {/* Trend Strength & Prediction */}
              <div className="bg-[#12141c] border border-slate-800 p-4 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-colors col-span-2 md:col-span-1">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Prediction Engine</p>
                <div className={`mt-2 flex items-baseline gap-2 text-lg font-bold ${latestData?.Prediction.includes("Bullish") ? "text-emerald-400" : latestData?.Prediction.includes("Bearish") ? "text-rose-400" : "text-amber-400"}`}>
                  {latestData?.Prediction}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 flex">
                  <div className="bg-rose-500 h-full" style={{ width: '33%' }}></div>
                  <div className="bg-amber-500 h-full" style={{ width: '33%' }}></div>
                  <div className="bg-emerald-500 h-full" style={{ width: '34%' }}></div>
                  <div className="absolute h-3 w-1 bg-white rounded-full -mt-[3px] transition-all duration-500 shadow-[0_0_10px_white]" style={{ left: `calc(${latestData?.TrendStrength}% - 2px)` }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>Score: {latestData?.TrendStrength}/100</span>
                </p>
              </div>

              {/* Shift Levels */}
              <div className="bg-[#12141c] border border-slate-800 p-4 rounded-2xl shadow-lg col-span-2 lg:col-span-2 hover:border-indigo-500/50 transition-colors">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Institutional Key Zones</p>
                {shiftDates.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between items-center bg-rose-500/10 px-2 py-1 rounded">
                      <span className="text-slate-400 text-xs">Resistance:</span>
                      <span className="text-rose-400 font-bold">{shiftDates[0].high.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-500/10 px-2 py-1 rounded">
                      <span className="text-slate-400 text-xs">Support:</span>
                      <span className="text-emerald-400 font-bold">{shiftDates[0].low.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-indigo-500/10 px-2 py-1 rounded col-span-2">
                      <span className="text-slate-400 text-xs">Pivot (Shift Date {shiftDates[0].date}):</span>
                      <span className="text-indigo-400 font-bold">{shiftDates[0].close.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-500 flex items-center justify-center gap-2 h-full pb-4">
                    <ShieldAlert size={16} /> No Volume Shift Detected
                  </div>
                )}
              </div>
            </motion.div>

            {/* Questions Answered Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#12141c] border border-slate-800 p-5 rounded-2xl shadow-lg">
               <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Smart Money Direction</p>
                  <p className={`font-medium text-sm ${latestData?.buildup.includes("Long") || latestData?.buildup === "Short Covering" ? "text-emerald-400" : "text-rose-400"}`}>
                    {latestData?.buildup.includes("Long") || latestData?.buildup === "Short Covering" ? "Bullish Biased" : "Bearish Biased"}
                  </p>
               </div>
               <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Position Status</p>
                  <p className="font-medium text-sm text-indigo-300">
                    {latestData?.buildup.includes("Build-up") ? "Carrying Fresh Positions" : "Exiting/Hedging Positions"}
                  </p>
               </div>
               <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Rollover Conviction</p>
                  <p className={`font-medium text-sm ${latestData?.strengthCategory === "Aggressive" || latestData?.strengthCategory === "Strong" ? "text-emerald-400" : "text-amber-400"}`}>

                    {latestData?.strengthCategory} ({latestData?.RolloverPct.toFixed(0)}%)
                  </p>
               </div>
               <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Next Expiry Participation</p>
                  <p className={`font-medium text-sm ${(latestData?.volMigrationPct || 0) > 50 ? "text-emerald-400" : "text-amber-400"}`}>
                    {(latestData?.volMigrationPct || 0) > 50 ? "Gaining Dominance" : "Still Building"}
                  </p>
               </div>
            </div>
          </div>
        ) : null}

        {/* Charts & Analytics */}
        {analysisData.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Main TradingView Style Chart */}
            <div className="bg-[#12141c] border border-slate-800 rounded-2xl shadow-lg p-5 col-span-1 xl:col-span-2 relative overflow-hidden">
              {/* Heatmap Background Simulation based on trend score of latest */}
              <div className={`absolute inset-0 opacity-[0.03] pointer-events-none transition-colors duration-1000 ${
                latestData?.TrendStrength && latestData.TrendStrength > 60 ? "bg-emerald-500" : 
                latestData?.TrendStrength && latestData.TrendStrength < 40 ? "bg-rose-500" : 
                "bg-amber-500"
              }`}></div>
              
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                Institutional Shift Matrix
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analysisData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volNext" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} minTickGap={30} />
                    <YAxis yAxisId="price" domain={['auto', 'auto']} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                    <YAxis yAxisId="volume" orientation="right" hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {/* Institutional Levels */}
                    {shiftDates.length > 0 && (
                      <>
                        <ReferenceLine yAxisId="price" y={shiftDates[0].high} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} label={{ position: 'insideTopLeft', value: 'Inst. Resistance', fill: '#ef4444', fontSize: 11 }} />
                        <ReferenceLine yAxisId="price" y={shiftDates[0].low} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} label={{ position: 'insideBottomLeft', value: 'Inst. Support', fill: '#10b981', fontSize: 11 }} />
                        <ReferenceLine yAxisId="price" x={shiftDates[0].date} stroke="#8b5cf6" strokeWidth={2} label={{ position: 'top', value: 'Shift Date', fill: '#8b5cf6', fontSize: 11 }} />
                      </>
                    )}

                    <Bar yAxisId="volume" dataKey="currentVolume" fill="#334155" opacity={0.6} name="Current Vol" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="volume" dataKey="nextVolume" fill="url(#volNext)" stroke="#8b5cf6" name="Next Vol" radius={[4, 4, 0, 0]} />
                    
                    <Line yAxisId="price" type="monotone" dataKey="currentClose" stroke="#64748b" strokeWidth={2} dot={false} name="Current Price" />
                    <Line yAxisId="price" type="monotone" dataKey="nextClose" stroke="#fff" strokeWidth={3} dot={false} name="Next Price" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Side Panels */}
            <div className="flex flex-col gap-6 col-span-1">
              {/* OI Migration Trend */}
              <div className="bg-[#12141c] border border-slate-800 rounded-2xl shadow-lg p-5 flex-1">
                <h3 className="text-sm font-bold text-white mb-4">Migration Trajectory</h3>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analysisData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="migGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `${val}%`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="volMigrationPct" stroke="#3b82f6" fill="url(#migGradient)" name="Vol Migration %" strokeWidth={2} />
                      <Area type="monotone" dataKey="RolloverPct" stroke="#10b981" fill="none" name="OI Rollover %" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Smart Insights Panel */}
              <div className="bg-[#12141c] border border-slate-800 rounded-2xl shadow-lg p-5 flex-1">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" /> Smart Insights
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-[180px] pr-2 custom-scrollbar">
                  {insights.map((insight, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border border-slate-800/50 text-xs leading-relaxed font-medium flex gap-2 ${
                        insight.includes("Aggressive Long") || insight.includes("Support") || insight.includes("Bullish") ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10" :
                        insight.includes("Aggressive Short") || insight.includes("Resistance") || insight.includes("Bearish") ? "bg-rose-500/5 text-rose-400 border-rose-500/10" :
                        insight.includes("Hedging") || insight.includes("Covering") ? "bg-blue-500/5 text-blue-400 border-blue-500/10" :
                        "bg-slate-800/20 text-slate-300"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                         {insight.includes("Long") || insight.includes("Bullish") ? <TrendingUp size={14}/> : insight.includes("Short") || insight.includes("Bearish") ? <TrendingDown size={14}/> : <Info size={14}/>}
                      </div>
                      <p>{insight}</p>
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <div className="text-center py-4 text-slate-500">
                      No active insights detected.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {analysisData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl">
            <BarChart2 size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-400">Awaiting Data</p>
            <p className="text-sm">Upload both current and next expiry files and check the console logs to see parsing status.</p>
            
            {debugLog && (
              <div className="mt-8 p-4 bg-slate-950 border border-red-500/30 rounded-xl max-w-4xl w-full text-left overflow-x-auto text-xs text-slate-300">
                <p className="text-red-400 font-bold mb-2">Debug Info: Why is it 0 rows?</p>
                <pre>{JSON.stringify(debugLog, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper icon
function Info(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  );
}
