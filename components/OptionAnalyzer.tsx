"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { 
  Upload, TrendingUp, TrendingDown, ArrowRight, Activity, 
  Crosshair, Download, BrainCircuit, Search, Percent, 
  BarChart2, Lightbulb, Camera, Database, FileSpreadsheet,
  Calendar, Layers, Clock, Settings, Maximize2, RefreshCw, X, FolderOpen, CloudLightning
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, ComposedChart, Line
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import StrategyEngine from "./StrategyEngine";
import CustomStrategyBuilder from "./CustomStrategyBuilder";

// --- Interfaces ---

interface OptionRow {
  strike: number;
  callOI: number;
  callVol: number;
  callLTP: number;
  putOI: number;
  putVol: number;
  putLTP: number;
}

interface Dataset {
  id: string;
  filename: string;
  symbol: string;
  expiry: string;
  uploadTime: number;
  data: OptionRow[];
  atm: number;
  totalCallOI: number;
  totalPutOI: number;
}

// --- Helper Components ---

const CustomSelect = ({ options, value, onChange, placeholder, label, icon: Icon }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o: any) => o.label.toString().toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative w-full">
      {label && <label className="block mb-2 text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">{Icon && <Icon size={14}/>} {label}</label>}
      <div 
        className="input-glass w-full cursor-pointer flex justify-between items-center bg-[#1a1d2d]/80 hover:bg-[#1a1d2d] py-3 px-4 transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate font-semibold">{value ? options.find((o: any) => o.value === value)?.label : placeholder}</span>
        <span className="text-xs ml-2 text-[var(--text-secondary)]">▼</span>
      </div>
      {isOpen && (
        <div className="absolute z-[999] w-full mt-2 bg-[#0f111a] border border-[var(--border-color)] rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col backdrop-blur-xl">
          {options.length > 8 && (
            <div className="p-3 border-b border-[var(--border-color)] bg-[#161925] sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-[var(--text-secondary)]" size={16} />
                <input 
                  type="text" 
                  className="w-full bg-black/40 text-white rounded-lg p-2 pl-10 text-sm outline-none border border-[var(--border-color)] focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto custom-scrollbar p-2">
            {filtered.map((opt: any) => (
              <div 
                key={opt.value}
                className={`p-3 my-1 rounded-lg hover:bg-[var(--accent-blue)]/80 hover:text-white cursor-pointer text-sm transition-all ${value === opt.value ? 'bg-[var(--accent-blue)] text-white font-medium shadow-md' : 'text-[var(--text-primary)]'}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {opt.label}
              </div>
            ))}
            {filtered.length === 0 && <div className="p-4 text-sm text-[var(--text-secondary)] text-center">No options found</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Application ---

export default function OptionAnalyzer() {
  // Data Manager State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [compareDatasetId, setCompareDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Data State (derived)
  const activeDataset = useMemo(() => datasets.find(d => d.id === activeDatasetId) || null, [datasets, activeDatasetId]);
  const compareDataset = useMemo(() => datasets.find(d => d.id === compareDatasetId) || null, [datasets, compareDatasetId]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<"Overview" | "Ratios" | "SmartMoney" | "Historical" | "CustomLab">("Overview");
  const [filterMode, setFilterMode] = useState<"All" | "ATM" | "OTM" | "ITM">("All");

  // Call/Put State
  const [callBase, setCallBase] = useState<number | "">("");
  const [callTarget, setCallTarget] = useState<number | "">("");
  const [putBase, setPutBase] = useState<number | "">("");
  const [putTarget, setPutTarget] = useState<number | "">("");

  // --- Data Sync ---
  useEffect(() => {
    if (activeDataset && activeDataset.data.length > 0) {
      const atmIndex = activeDataset.data.findIndex(d => d.strike === activeDataset.atm);
      setCallBase(activeDataset.atm);
      setCallTarget(activeDataset.data[Math.min(atmIndex + 2, activeDataset.data.length - 1)]?.strike || activeDataset.atm);
      setPutBase(activeDataset.atm);
      setPutTarget(activeDataset.data[Math.max(atmIndex - 2, 0)]?.strike || activeDataset.atm);
    }
  }, [activeDataset]);

  // --- Parsing & Data Management ---

  const parseNumber = (val: any) => {
    if (!val || val === "-" || val === " ") return 0;
    if (typeof val === "number") return val;
    return parseFloat(val.toString().replace(/,/g, "")) || 0;
  };

  const extractMetadata = (filename: string) => {
    let symbol = "UNKNOWN";
    let expiry = "UNKNOWN EXPIRY";
    
    const upperName = filename.toUpperCase();
    
    // Auto detect standard symbols (ordered by length descending to prevent partial match bug, e.g. NIFTY masking BANKNIFTY)
    const symbols = ["MIDCPNIFTY", "BANKNIFTY", "FINNIFTY", "NIFTY", "SENSEX", "RELIANCE", "HDFCBANK", "TCS", "INFY"];
    for (const s of symbols) {
      if (upperName.includes(s)) {
        symbol = s;
        break;
      }
    }

    // Attempt to extract expiry like 12-MAY-2026 or 12MAY26
    const dateMatch = upperName.match(/(\d{1,2}[A-Z]{3}\d{2,4})|(\d{1,2}-[A-Z]{3}-\d{2,4})/);
    if (dateMatch) {
      expiry = dateMatch[0];
    } else {
      // Create a dummy expiry if none found based on date
      expiry = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-').toUpperCase();
    }

    return { symbol, expiry };
  };

  const processData = (rows: any[], filename: string) => {
    const parsedData: OptionRow[] = [];
    let tcOI = 0;
    let tpOI = 0;
    
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 21) continue;

      const strike = parseNumber(row[11]);
      if (strike === 0) continue;

      const callOI = parseNumber(row[1]);
      const putOI = parseNumber(row[21]);

      parsedData.push({
        strike,
        callOI,
        callVol: parseNumber(row[3]),
        callLTP: parseNumber(row[5]),
        putLTP: parseNumber(row[17]),
        putVol: parseNumber(row[19]),
        putOI,
      });

      tcOI += callOI;
      tpOI += putOI;
    }

    if (parsedData.length === 0) {
      alert(`No valid data found in ${filename}.`);
      return;
    }

    let minDiff = Infinity;
    let currentAtm = parsedData[0].strike;

    parsedData.forEach((row) => {
      const diff = Math.abs(row.callLTP - row.putLTP);
      if (diff < minDiff && row.callLTP > 0 && row.putLTP > 0) {
        minDiff = diff;
        currentAtm = row.strike;
      }
    });

    const { symbol, expiry } = extractMetadata(filename);
    const newDataset: Dataset = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      filename,
      symbol,
      expiry,
      uploadTime: Date.now(),
      data: parsedData,
      atm: currentAtm,
      totalCallOI: tcOI,
      totalPutOI: tpOI
    };

    setDatasets(prev => [...prev, newDataset]);
    setActiveDatasetId(newDataset.id);
    
    // Setup defaults for ratio builder
    const atmIndex = parsedData.findIndex(d => d.strike === currentAtm);
    setCallBase(currentAtm);
    setCallTarget(parsedData[Math.min(atmIndex + 2, parsedData.length - 1)]?.strike || currentAtm);
    setPutBase(currentAtm);
    setPutTarget(parsedData[Math.max(atmIndex - 2, 0)]?.strike || currentAtm);
  };

  const fetchLiveNSEData = async (symbol: string = "NIFTY") => {
    setLiveLoading(true);
    try {
      const res = await fetch(`/api/nse/option-chain?symbol=${symbol}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      const expiryDates = json.records.expiryDates;
      const nearestExpiry = expiryDates[0];
      const rawData = json.records.data.filter((d: any) => d.expiryDate === nearestExpiry);
      
      let currentAtm = json.records.underlyingValue;
      let minDiff = Infinity;

      const parsedData: OptionRow[] = rawData.map((d: any) => {
        const row = {
          strike: d.strikePrice,
          callOI: d.CE?.openInterest || 0,
          callVol: d.CE?.totalTradedVolume || 0,
          callLTP: d.CE?.lastPrice || 0,
          putOI: d.PE?.openInterest || 0,
          putVol: d.PE?.totalTradedVolume || 0,
          putLTP: d.PE?.lastPrice || 0
        };
        const diff = Math.abs(currentAtm - d.strikePrice);
        if (diff < minDiff) {
          minDiff = diff;
          currentAtm = d.strikePrice;
        }
        return row;
      }).filter((r: OptionRow) => r.callLTP > 0 || r.putLTP > 0);

      const tcOI = parsedData.reduce((acc: number, val: OptionRow) => acc + val.callOI, 0);
      const tpOI = parsedData.reduce((acc: number, val: OptionRow) => acc + val.putOI, 0);

      const newDataset: Dataset = {
        id: `live-${symbol}-${Date.now()}`,
        filename: `LIVE NSE API (${symbol})`,
        symbol,
        expiry: nearestExpiry.toUpperCase().replace(/ /g, '-'),
        uploadTime: Date.now(),
        data: parsedData,
        atm: currentAtm,
        totalCallOI: tcOI,
        totalPutOI: tpOI
      };

      setDatasets(prev => [...prev.filter(d => !d.id.startsWith(`live-${symbol}`)), newDataset]);
      setActiveDatasetId(newDataset.id);
    } catch (e: any) {
      alert("Failed to fetch Live NSE Data: " + e.message);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);

    Array.from(files).forEach(file => {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: (results) => {
            processData(results.data, file.name);
            setLoading(false);
          },
          error: (error) => {
            console.error(error);
            alert(`Error reading ${file.name}`);
            setLoading(false);
          }
        });
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          processData(rows, file.name);
          setLoading(false);
        };
        reader.readAsBinaryString(file);
      }
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatNum = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  // --- Derived Calculations ---

  const { maxCall, maxPut, totalPCR } = useMemo(() => {
    if (!activeDataset) return { maxCall: null, maxPut: null, totalPCR: 0 };
    
    let mCall = activeDataset.data[0];
    let mPut = activeDataset.data[0];

    activeDataset.data.forEach(d => {
      if (d.callOI > mCall.callOI) mCall = d;
      if (d.putOI > mPut.putOI) mPut = d;
    });

    const pcr = activeDataset.totalCallOI > 0 ? (activeDataset.totalPutOI / activeDataset.totalCallOI) : 0;
    return { maxCall: mCall, maxPut: mPut, totalPCR: pcr };
  }, [activeDataset]);

  const pcrSentiment = useMemo(() => {
    if (totalPCR > 1.2) return { text: "Bullish", color: "#10b981" }; // var(--success)
    if (totalPCR < 0.8) return { text: "Bearish", color: "#ef4444" }; // var(--danger)
    return { text: "Neutral", color: "#f59e0b" }; // var(--warning)
  }, [totalPCR]);

  const closestMatchPair = useMemo<{ call: OptionRow, put: OptionRow, diffPercent: number } | null>(() => {
    if (!activeDataset) return null;
    let bestMatch: { call: OptionRow, put: OptionRow, diffPercent: number } | null = null;
    let minDiffPercent = Infinity;

    const otmCalls = activeDataset.data.filter(d => d.strike > activeDataset.atm && d.callOI > 5000);
    const otmPuts = activeDataset.data.filter(d => d.strike < activeDataset.atm && d.putOI > 5000);

    otmCalls.forEach(callData => {
      otmPuts.forEach(putData => {
        const diff = Math.abs(callData.callOI - putData.putOI);
        const maxOI = Math.max(callData.callOI, putData.putOI);
        const diffPercent = (diff / maxOI) * 100;

        if (diffPercent < minDiffPercent && diffPercent < 15) {
          minDiffPercent = diffPercent;
          bestMatch = { call: callData, put: putData, diffPercent };
        }
      });
    });
    return bestMatch;
  }, [activeDataset]);

  const filteredOptions = useMemo(() => {
    if (!activeDataset) return [];
    let d = activeDataset.data;
    if (filterMode === "ATM") {
      d = activeDataset.data.filter(x => Math.abs(x.strike - activeDataset.atm) <= 400);
    } else if (filterMode === "OTM") {
      d = activeDataset.data.filter(x => Math.abs(x.strike - activeDataset.atm) > 400);
    } else if (filterMode === "ITM") {
      d = activeDataset.data.filter(x => Math.abs(x.strike - activeDataset.atm) > 1000);
    }
    return d.map(d => ({ label: formatNum(d.strike), value: d.strike }));
  }, [activeDataset, filterMode]);

  // Comparison Data Logic
  const comparisonChartData = useMemo(() => {
    if (!activeDataset || !compareDataset) return [];
    
    // Merge strikes from both datasets
    const strikeSet = new Set([...activeDataset.data.map(d => d.strike), ...compareDataset.data.map(d => d.strike)]);
    const strikes = Array.from(strikeSet).sort((a, b) => a - b);
    
    return strikes.map(strike => {
      const aData = activeDataset.data.find(d => d.strike === strike);
      const cData = compareDataset.data.find(d => d.strike === strike);
      
      return {
        strike,
        activeCall: aData?.callOI || 0,
        activePut: aData?.putOI || 0,
        compareCall: cData?.callOI || 0,
        comparePut: cData?.putOI || 0,
        callDiff: (aData?.callOI || 0) - (cData?.callOI || 0),
        putDiff: (aData?.putOI || 0) - (cData?.putOI || 0)
      };
    }).filter(d => Math.abs(d.strike - activeDataset.atm) <= 800);
  }, [activeDataset, compareDataset]);

  // --- Actions ---

  const exportPDF = () => {
    const el = document.getElementById("export-container");
    if (!el) return;
    el.classList.add("exporting");
    html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#0f111a" }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Analytics_${activeDataset?.symbol}_${activeDataset?.expiry}.pdf`);
      el.classList.remove("exporting");
    });
  };

  // --- Render ---

  if (datasets.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col justify-center items-center h-[80vh]">
        <div 
          className="glass-panel hover:border-[#3b82f6] transition-all duration-500 w-full" 
          style={{ padding: "6rem 2rem", textAlign: "center", borderStyle: "dashed", cursor: "pointer", borderWidth: "2px" }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="bg-[#3b82f6]/10 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Upload size={56} color="#3b82f6" />
          </div>
          <h2 className="text-4xl font-bold mb-4 gradient-text tracking-tight">Institutional Data Importer</h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto text-lg leading-relaxed">
            Upload NSE Option Chain files to activate the Smart Money Terminal. Supports multiple expiries and historical comparisons.
          </p>
          <div className="flex justify-center gap-4">
            <button className="btn-primary px-8 py-4 text-lg rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2">
              <Database size={20} /> Select CSV / Excel
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-6 flex items-center justify-center gap-1">
            <FileSpreadsheet size={14}/> Auto-detects Symbol & Expiry directly from files
          </p>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" multiple style={{ display: "none" }} />
          {loading && <p className="mt-6 text-[#3b82f6] animate-pulse font-medium">Processing Datasets...</p>}
        </div>
      </div>
    );
  }

  // Active Data Helpers
  const callBaseData = activeDataset?.data.find(d => d.strike === Number(callBase));
  const callTargetData = activeDataset?.data.find(d => d.strike === Number(callTarget));
  const putBaseData = activeDataset?.data.find(d => d.strike === Number(putBase));
  const putTargetData = activeDataset?.data.find(d => d.strike === Number(putTarget));

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto px-4 pb-20">
      
      {/* 1. DATA MANAGER HEADER (Replaces old top actions) */}
      <div className="bg-[#161925]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl backdrop-blur-xl sticky top-4 z-[50]">
        <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
          
          {/* Left: Brand & Active Context */}
          <div className="flex items-center gap-6 w-full xl:w-auto">
            <div className="bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] p-3 rounded-xl shadow-lg">
              <Activity color="#fff" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-1 flex items-center gap-3">
                Smart Money Terminal
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 uppercase tracking-widest animate-pulse">
                  Connected
                </span>
              </h1>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium">
                <span className="flex items-center gap-1 text-white"><Layers size={14} color="#3b82f6"/> {activeDataset?.symbol}</span>
                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                <span className="flex items-center gap-1"><Calendar size={14} color="#8b5cf6"/> {activeDataset?.expiry}</span>
                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                <span>Spot: <strong className="text-white">{formatNum(activeDataset?.atm || 0)}</strong></span>
              </div>
            </div>
          </div>

          {/* Center: File Switching & Management */}
          <div className="flex-1 flex justify-center gap-3 w-full xl:w-auto bg-black/20 p-2 rounded-xl border border-[var(--border-color)]">
            <div className="w-64">
              <CustomSelect 
                icon={Database}
                options={datasets.map(d => ({ label: `${d.symbol} • ${d.expiry}`, value: d.id }))} 
                value={activeDatasetId} 
                onChange={setActiveDatasetId} 
                placeholder="Switch Dataset..." 
              />
            </div>
            <button 
              className="bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-[#10b981]/30"
              onClick={() => fetchLiveNSEData(activeDataset?.symbol || "NIFTY")}
              disabled={liveLoading}
            >
              <CloudLightning size={16} className={liveLoading ? "animate-pulse" : ""} /> {liveLoading ? "Fetching..." : "Live NSE"}
            </button>
            <button 
              className="bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-[#3b82f6]/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Import CSV
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" multiple style={{ display: "none" }} />
          </div>

          {/* Right: Actions */}
          <div className="flex gap-3 w-full xl:w-auto justify-end">
            <button className="bg-[#1a1d2d] hover:bg-[#252a40] text-white px-4 py-2 rounded-lg border border-[var(--border-color)] transition-all flex items-center gap-2 shadow-md">
              <Camera size={16} /> <span className="hidden sm:inline">Screenshot</span>
            </button>
            <button className="bg-[#1a1d2d] hover:bg-[#252a40] text-white px-4 py-2 rounded-lg border border-[var(--border-color)] transition-all flex items-center gap-2 shadow-md" onClick={exportPDF}>
              <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] px-4 py-2 rounded-lg border border-[#ef4444]/30 transition-all flex items-center gap-2" onClick={() => setDatasets([])}>
              <RefreshCw size={16} /> <span className="hidden sm:inline">Reset All</span>
            </button>
          </div>
        </div>
      </div>

      <div id="export-container" className="flex flex-col gap-8">
        
        {/* 2. TABS NAVIGATION */}
        <div className="flex gap-2 p-1 bg-[#161925]/50 border border-[var(--border-color)] rounded-xl w-fit mx-auto lg:mx-0 backdrop-blur-sm overflow-x-auto max-w-full">
          {["Overview", "CustomLab", "Ratios", "SmartMoney", "Historical"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as "Overview" | "Ratios" | "SmartMoney" | "Historical" | "CustomLab")}
              className={`px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 whitespace-nowrap ${activeTab === tab ? 'bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}`}
            >
              {tab === "CustomLab" ? "Custom Strategy Lab" : tab === "Ratios" ? "Ratio Spread Builder" : tab === "SmartMoney" ? "AI & Heatmap" : tab === "Historical" ? "Compare Expiries" : tab}
            </button>
          ))}
        </div>

        {/* 3. TAB VIEWS */}

        {/* ================= CUSTOM LAB TAB ================= */}
        {activeTab === "CustomLab" && (
          <CustomStrategyBuilder activeDataset={activeDataset} />
        )}
        
        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Status Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-5 bg-[#161925]/40 rounded-2xl border border-[var(--border-color)]">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total CE OI</p>
                <p className="font-bold text-lg text-[#ef4444]">{formatNum(activeDataset?.totalCallOI || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total PE OI</p>
                <p className="font-bold text-lg text-[#10b981]">{formatNum(activeDataset?.totalPutOI || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">PCR Ratio</p>
                <p className="font-bold text-lg" style={{ color: pcrSentiment.color }}>{totalPCR.toFixed(2)} ({pcrSentiment.text})</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total Strikes</p>
                <p className="font-bold text-lg text-white">{activeDataset?.data.length}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Source File</p>
                <p className="font-bold text-sm text-gray-300 truncate bg-black/30 p-1.5 rounded">{activeDataset?.filename}</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="glass-panel p-8 relative overflow-hidden group shadow-xl">
                <div className="absolute top-[-10px] right-[-10px] p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110"><Crosshair size={100} /></div>
                <p className="text-[var(--text-secondary)] font-medium mb-2 tracking-wide uppercase text-sm">Center of Gravity</p>
                <h2 className="text-5xl font-extrabold text-white mb-2">{formatNum(activeDataset?.atm || 0)}</h2>
                <div className="text-sm font-bold text-[#3b82f6] bg-[#3b82f6]/10 w-fit px-3 py-1 rounded-full border border-[#3b82f6]/20">Estimated ATM</div>
              </div>

              <div className="glass-panel p-8 border-b-4 border-b-[#ef4444] relative overflow-hidden shadow-xl">
                <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
                  Highest Resistance <TrendingUp size={16} color="#ef4444" />
                </p>
                <h2 className="text-5xl font-extrabold text-[#ef4444] mb-2">{formatNum(maxCall?.strike || 0)}</h2>
                <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">{formatNum(maxCall?.callOI || 0)} CE</div>
              </div>

              <div className="glass-panel p-8 border-b-4 border-b-[#10b981] relative overflow-hidden shadow-xl">
                <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
                  Highest Support <TrendingDown size={16} color="#10b981" />
                </p>
                <h2 className="text-5xl font-extrabold text-[#10b981] mb-2">{formatNum(maxPut?.strike || 0)}</h2>
                <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">{formatNum(maxPut?.putOI || 0)} PE</div>
              </div>

              <div className="glass-panel p-8 relative overflow-hidden shadow-xl" style={{ borderBottom: `4px solid ${pcrSentiment.color}` }}>
                <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
                  Market Bias <Percent size={16} color={pcrSentiment.color} />
                </p>
                <h2 className="text-5xl font-extrabold mb-2" style={{ color: pcrSentiment.color }}>{pcrSentiment.text}</h2>
                <div className="text-sm font-bold bg-black/30 w-fit px-3 py-1 rounded-full text-gray-300">
                  PCR: {totalPCR.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Quick Chart */}
            <div className="glass-panel p-8 shadow-xl">
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <BarChart2 className="text-[#3b82f6]" size={28} /> OI Profile (Quick View)
              </h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeDataset?.data.filter(d => Math.abs(d.strike - (activeDataset?.atm || 0)) <= 800)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val/100000).toFixed(1)}L`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', padding: '15px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(value: any) => [formatNum(value), ""]}
                      labelFormatter={(label) => `Strike: ${label}`}
                    />
                    <Bar dataKey="putOI" fill="#10b981" name="Put OI" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="callOI" fill="#ef4444" name="Call OI" radius={[4, 4, 0, 0]} barSize={24} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ================= RATIOS TAB ================= */}
        {activeTab === "Ratios" && (
          <StrategyEngine activeDataset={activeDataset} />
        )}

        {/* ================= SMART MONEY & HEATMAP TAB ================= */}
        {activeTab === "SmartMoney" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* AI Insights */}
              <div className="flex-1 bg-gradient-to-b from-[#1a1d2d] to-[#0f111a] rounded-2xl border border-[#8b5cf6]/40 p-8 relative overflow-hidden shadow-2xl lg:col-span-2">
                <div className="absolute top-[-30px] right-[-30px] opacity-10"><BrainCircuit size={150} color="#8b5cf6" /></div>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#8b5cf6]">
                  <Lightbulb size={28} /> Advanced AI Interpretation
                </h3>
                <div className="space-y-4 relative z-10 bg-black/20 p-6 rounded-xl border border-white/5">
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18}/></span>
                    <span className="leading-relaxed"><strong className="text-white">Resistance:</strong> Heavy Call Writing detected at <strong className="text-[#ef4444]">{formatNum(maxCall?.strike || 0)}</strong>. Market will struggle to cross this zone.</span>
                  </div>
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18}/></span>
                    <span className="leading-relaxed"><strong className="text-white">Support:</strong> Put support is exceptionally strong at <strong className="text-[#10b981]">{formatNum(maxPut?.strike || 0)}</strong>. Market makers defending this floor.</span>
                  </div>
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18}/></span>
                    <span className="leading-relaxed">
                      <strong className="text-white">Sentiment:</strong> PCR is <strong style={{ color: pcrSentiment.color }}>{totalPCR.toFixed(2)}</strong>. {totalPCR > 1.2 ? "Aggressive put selling signals a bullish structure." : totalPCR < 0.8 ? "Heavy call writing dictates a bearish ceiling." : "Range-bound trading expected."}
                    </span>
                  </div>
                  {closestMatchPair && (
                    <div className="flex gap-4 text-base text-gray-200 items-start mt-4 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
                      <span className="text-yellow-400 mt-1"><Crosshair size={18}/></span>
                      <span className="leading-relaxed">
                        <strong className="text-yellow-400">Institutional Strangle Detected:</strong> High probability of market settling between <strong className="text-white">{formatNum(closestMatchPair.put.strike)}</strong> and <strong className="text-white">{formatNum(closestMatchPair.call.strike)}</strong> due to mirrored OI writing activity.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strangle Matcher */}
              <div className="glass-panel p-8 flex flex-col gap-6 lg:col-span-1 shadow-xl">
                <h3 className="text-xl font-bold flex items-center gap-2 text-yellow-400">
                  <Search size={24} /> Closest OI Match
                </h3>
                {closestMatchPair ? (
                  <div className="bg-[#161925] border border-[var(--border-color)] p-6 rounded-2xl flex-1 flex flex-col justify-center shadow-inner">
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-center">
                        <div className="text-[#ef4444] font-bold text-3xl mb-1">{formatNum(closestMatchPair.call.strike)}</div>
                        <div className="text-xs text-gray-400 font-bold bg-black/30 py-1 px-2 rounded">CE OI: {formatNum(closestMatchPair.call.callOI)}</div>
                      </div>
                      <div className="text-yellow-500 font-black text-lg bg-yellow-500/10 px-3 py-1 rounded-full">VS</div>
                      <div className="text-center">
                        <div className="text-[#10b981] font-bold text-3xl mb-1">{formatNum(closestMatchPair.put.strike)}</div>
                        <div className="text-xs text-gray-400 font-bold bg-black/30 py-1 px-2 rounded">PE OI: {formatNum(closestMatchPair.put.putOI)}</div>
                      </div>
                    </div>
                    <div className="text-sm text-yellow-100 text-center border-t border-white/5 pt-4">
                      Difference: <strong className="text-white text-lg">{closestMatchPair.diffPercent.toFixed(1)}%</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic bg-black/20 p-8 rounded-xl text-center border border-dashed border-white/10 flex-1 flex items-center justify-center">
                    No tightly matching bounds detected for current expiry.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= HISTORICAL / COMPARE TAB ================= */}
        {activeTab === "Historical" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="glass-panel p-8">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <Clock size={28} color="#3b82f6" /> Compare Expiries / Historical
                  </h3>
                  <p className="text-[var(--text-secondary)] mt-2">Compare OI shifts between two loaded datasets to track rollover or money migration.</p>
                </div>
                
                <div className="bg-[#161925]/80 p-3 rounded-xl border border-[var(--border-color)] flex items-center gap-4 w-full md:w-[400px]">
                  <span className="text-sm font-bold text-gray-400 whitespace-nowrap px-2">Compare with:</span>
                  <CustomSelect 
                    options={datasets.filter(d => d.id !== activeDatasetId).map(d => ({ label: `${d.symbol} • ${d.expiry}`, value: d.id }))} 
                    value={compareDatasetId} 
                    onChange={setCompareDatasetId} 
                    placeholder="Select Dataset" 
                  />
                </div>
              </div>

              {!compareDatasetId ? (
                <div className="bg-[#161925] border border-dashed border-white/10 rounded-2xl p-16 text-center">
                  <Database size={48} className="mx-auto mb-4 text-gray-600" />
                  <h4 className="text-xl font-bold text-gray-300 mb-2">No Comparison Dataset Selected</h4>
                  <p className="text-gray-500 max-w-md mx-auto">Upload another CSV and select it from the dropdown above to view OI migration charts.</p>
                  <button 
                    className="mt-6 bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] px-6 py-3 rounded-xl font-bold transition-all border border-[#3b82f6]/30 inline-flex items-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={18} /> Upload More Data
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {/* Diff Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-2">Comparing</p>
                      <p className="font-bold text-lg text-[#3b82f6]">{activeDataset?.expiry}</p>
                      <p className="text-sm font-bold text-gray-500 my-1">vs</p>
                      <p className="font-bold text-lg text-[#8b5cf6]">{compareDataset?.expiry}</p>
                    </div>
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-2">Total Call OI Shift</p>
                      <p className={`font-bold text-2xl ${(activeDataset?.totalCallOI || 0) > (compareDataset?.totalCallOI || 0) ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                        {formatNum((activeDataset?.totalCallOI || 0) - (compareDataset?.totalCallOI || 0))}
                      </p>
                    </div>
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-2">Total Put OI Shift</p>
                      <p className={`font-bold text-2xl ${(activeDataset?.totalPutOI || 0) > (compareDataset?.totalPutOI || 0) ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {formatNum((activeDataset?.totalPutOI || 0) - (compareDataset?.totalPutOI || 0))}
                      </p>
                    </div>
                  </div>

                  {/* Diff Chart */}
                  <div className="h-[500px] w-full bg-black/20 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-lg font-bold mb-6 flex items-center gap-2"><BarChart2 className="text-[#3b82f6]"/> Shift Analysis (Blue = Active, Purple = Compare)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val/100000).toFixed(1)}L`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        
                        {/* Call Compare */}
                        <Line type="monotone" dataKey="activeCall" name={`${activeDataset?.expiry} Call`} stroke="#3b82f6" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="compareCall" name={`${compareDataset?.expiry} Call`} stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                        
                        {/* Put Compare */}
                        <Line type="monotone" dataKey="activePut" name={`${activeDataset?.expiry} Put`} stroke="#10b981" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="comparePut" name={`${compareDataset?.expiry} Put`} stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
