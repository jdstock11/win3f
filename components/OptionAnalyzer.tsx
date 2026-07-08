"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Upload, TrendingUp, TrendingDown, ArrowRight, Activity,
  Crosshair, Download, BrainCircuit, Search, Percent,
  BarChart2, Lightbulb, Camera, Database, FileSpreadsheet,
  Calendar, Layers, Clock, Settings, Maximize2, RefreshCw, X, FolderOpen, CloudLightning, ShieldAlert
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, AreaChart, Area, LineChart
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import StrategyEngine, { OptionRow, Dataset } from "./StrategyEngine";
import CustomStrategyBuilder from "./CustomStrategyBuilder";
import InstitutionalDecisionEngine from "./InstitutionalDecisionEngine";
import IntradayComparison from "./IntradayComparison";

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
      {label && <label className="block mb-2 text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">{Icon && <Icon size={14} />} {label}</label>}
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
  const [activeTab, setActiveTab] = useState<"Overview" | "StrategyEngine" | "SmartMoney" | "Rollover" | "CustomLab">("Overview");
  
  // Intraday Comparison State
  const [previousUpload, setPreviousUpload] = useState<{timestamp: string, dataset: Dataset} | null>(null);
  const [currentUpload, setCurrentUpload] = useState<{timestamp: string, dataset: Dataset} | null>(null);

  // --- Parsing & Data Management ---

  const parseNumber = (val: any) => {
    if (!val || val === "-" || val === " ") return 0;
    if (typeof val === "number") return val;
    return parseFloat(val.toString().replace(/,/g, "")) || 0;
  };

  const extractMetadata = (filename: string, rows: any[]) => {
    let symbol = "UNKNOWN";
    let expiry = "UNKNOWN EXPIRY";

    const detectSymbol = () => {
      // 1-6: Check CSV Rows
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        const rowStr = row.join(" ").toUpperCase();
        
        // Specific Regex for fields
        const match = rowStr.match(/(?:UNDERLYING INDEX|UNDERLYING|SYMBOL|INSTRUMENT NAME|CONTRACT NAME)[\s:,-]*([A-Z]{3,15})/);
        
        if (match && match[1] && !['INDEX', 'VALUE', 'NAME', 'SYMBOL'].includes(match[1])) {
          return match[1];
        }

        // Check adjacent columns
        for (let j = 0; j < row.length - 1; j++) {
           const col1 = String(row[j]).toUpperCase().trim();
           const col2 = String(row[j+1]).toUpperCase().trim();
           if (['UNDERLYING', 'SYMBOL', 'UNDERLYING INDEX', 'INSTRUMENT NAME', 'CONTRACT NAME'].includes(col1)) {
              if (col2 && col2 !== '' && col2 !== '-') return col2;
           }
        }
      }

      // 7: Filename fallback
      const filenameMatch = filename.toUpperCase().match(/-(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|[A-Z]{3,15})-/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }

      const symbols = ["MIDCPNIFTY", "BANKNIFTY", "FINNIFTY", "NIFTY", "SENSEX", "RELIANCE", "HDFCBANK", "TCS", "INFY", "SBIN"];
      for (const s of symbols) {
        if (filename.toUpperCase().includes(s)) {
          return s;
        }
      }

      return "UNKNOWN";
    };

    symbol = detectSymbol();

    const dateMatch = filename.toUpperCase().match(/(\d{1,2}[A-Z]{3}\d{2,4})|(\d{1,2}-[A-Z]{3}-\d{2,4})/);
    if (dateMatch) {
      expiry = dateMatch[0];
    } else {
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
        callOIChange: parseNumber(row[2]),
        callVol: parseNumber(row[3]),
        callIV: parseNumber(row[4]),
        callLTP: parseNumber(row[5]),
        callLTPChange: parseNumber(row[6]),
        putLTPChange: parseNumber(row[16]),
        putLTP: parseNumber(row[17]),
        putIV: parseNumber(row[18]),
        putVol: parseNumber(row[19]),
        putOIChange: parseNumber(row[20]),
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

    const { symbol, expiry } = extractMetadata(filename, rows);
    const newDataset: Dataset = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      symbol,
      expiry,
      data: parsedData,
      atm: currentAtm,
    };

    setDatasets(prev => [...prev, newDataset]);
    if (!activeDatasetId) setActiveDatasetId(newDataset.id);
    else if (!compareDatasetId) setCompareDatasetId(newDataset.id);

    // Intraday Comparison Cache Integration
    fetch(`/api/cache?symbol=${symbol}`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setPreviousUpload(data.data);
        } else {
          setPreviousUpload(null);
        }
        
        const curr = { timestamp: new Date().toISOString(), dataset: newDataset };
        setCurrentUpload(curr);
        
        fetch('/api/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, dataset: newDataset, timestamp: curr.timestamp })
        });
      })
      .catch(err => console.error("Cache error", err));
  };

  const fetchLiveNSEData = async (symbol: string = "NIFTY") => {
    setLiveLoading(true);
    try {
      const res = await fetch(`/api/nse/option-chain?symbol=${symbol}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const expiryDates = json.records.expiryDates;
      
      // Fetch both current and next expiry
      const nearestExpiry = expiryDates[0];
      const nextExpiry = expiryDates[1] || expiryDates[0];
      
      const rawData = json.records.data;
      
      const processExpiry = (exp: string, idPrefix: string) => {
        const filteredData = rawData.filter((d: any) => d.expiryDate === exp);
        let currentAtm = json.records.underlyingValue;
        let minDiff = Infinity;

        const parsedData: OptionRow[] = filteredData.map((d: any) => {
          const row = {
            strike: d.strikePrice,
            callOI: d.CE?.openInterest || 0,
            callOIChange: d.CE?.changeinOpenInterest || 0,
            callVol: d.CE?.totalTradedVolume || 0,
            callIV: d.CE?.impliedVolatility || 0,
            callLTP: d.CE?.lastPrice || 0,
            callLTPChange: d.CE?.change || 0,
            putOI: d.PE?.openInterest || 0,
            putOIChange: d.PE?.changeinOpenInterest || 0,
            putVol: d.PE?.totalTradedVolume || 0,
            putIV: d.PE?.impliedVolatility || 0,
            putLTP: d.PE?.lastPrice || 0,
            putLTPChange: d.PE?.change || 0
          };
          const diff = Math.abs(currentAtm - d.strikePrice);
          if (diff < minDiff) {
            minDiff = diff;
            currentAtm = d.strikePrice;
          }
          return row;
        }).filter((r: OptionRow) => r.callLTP > 0 || r.putLTP > 0);
        
        return {
          id: `${idPrefix}-${symbol}-${Date.now()}`,
          symbol,
          expiry: exp.toUpperCase().replace(/ /g, '-'),
          data: parsedData,
          atm: currentAtm,
        };
      };

      const currDataset = processExpiry(nearestExpiry, 'live-curr');
      const nextDataset = processExpiry(nextExpiry, 'live-next');

      setDatasets(prev => {
        const withoutOldLive = prev.filter(d => !d.id.startsWith(`live-${symbol}`));
        return [...withoutOldLive, currDataset, nextDataset];
      });
      setActiveDatasetId(currDataset.id);
      setCompareDatasetId(nextDataset.id);

    } catch (e: any) {
      alert("Failed to fetch Live NSE Data: " + e.message);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setLoading(true);

    Array.from(files).forEach(file => {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: (results) => {
            processData(results.data, file.name);
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
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          processData(data, file.name);
          setLoading(false);
        };
        reader.readAsBinaryString(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetWorkspace = async () => {
    if (activeDataset?.symbol) {
      try {
        await fetch(`/api/cache?symbol=${activeDataset.symbol}`, { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to delete cache", err);
      }
    }
    setDatasets([]);
    setActiveDatasetId(null);
    setCompareDatasetId(null);
    setPreviousUpload(null);
    setCurrentUpload(null);
    setActiveTab("Overview");
  };

  const formatNum = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  // --- Derived Calculations ---

  const { maxCall, maxPut, totalPCR, totalCallOI, totalPutOI } = useMemo(() => {
    if (!activeDataset) return { maxCall: null, maxPut: null, totalPCR: 0, totalCallOI: 0, totalPutOI: 0 };

    let mCall = activeDataset.data[0];
    let mPut = activeDataset.data[0];
    let tcOI = 0;
    let tpOI = 0;

    activeDataset.data.forEach(d => {
      if (d.callOI > mCall.callOI) mCall = d;
      if (d.putOI > mPut.putOI) mPut = d;
      tcOI += d.callOI;
      tpOI += d.putOI;
    });

    const pcr = tcOI > 0 ? (tpOI / tcOI) : 0;
    return { maxCall: mCall, maxPut: mPut, totalPCR: pcr, totalCallOI: tcOI, totalPutOI: tpOI };
  }, [activeDataset]);

  const pcrSentiment = useMemo(() => {
    if (totalPCR > 1.2) return { text: "Bullish", color: "#10b981" }; // var(--success)
    if (totalPCR < 0.8) return { text: "Bearish", color: "#ef4444" }; // var(--danger)
    return { text: "Neutral", color: "#f59e0b" }; // var(--warning)
  }, [totalPCR]);

  // Comparison Data Logic for Rollover
  const comparisonChartData = useMemo(() => {
    if (!activeDataset || !compareDataset) return [];

    const strikeSet = new Set([...activeDataset.data.map(d => d.strike), ...compareDataset.data.map(d => d.strike)]);
    const strikes = Array.from(strikeSet).sort((a, b) => a - b);

    return strikes.map(strike => {
      const aData = activeDataset.data.find(d => d.strike === strike);
      const cData = compareDataset.data.find(d => d.strike === strike);

      const aCallOI = aData?.callOI || 0;
      const cCallOI = cData?.callOI || 0;
      const aPutOI = aData?.putOI || 0;
      const cPutOI = cData?.putOI || 0;

      return {
        strike,
        activeCall: aCallOI,
        activePut: aPutOI,
        compareCall: cCallOI,
        comparePut: cPutOI,
        callRollover: (cCallOI / (aCallOI + cCallOI || 1)) * 100,
        putRollover: (cPutOI / (aPutOI + cPutOI || 1)) * 100,
      };
    }).filter(d => Math.abs(d.strike - activeDataset.atm) <= 800);
  }, [activeDataset, compareDataset]);

  const rolloverStats = useMemo(() => {
    if (!activeDataset || !compareDataset) return null;
    let aCall = 0, aPut = 0, cCall = 0, cPut = 0;
    activeDataset.data.forEach(d => { aCall += d.callOI; aPut += d.putOI; });
    compareDataset.data.forEach(d => { cCall += d.callOI; cPut += d.putOI; });

    const totalCurr = aCall + aPut;
    const totalNext = cCall + cPut;
    const rolloverPct = (totalNext / (totalCurr + totalNext || 1)) * 100;
    
    return {
      callRollover: (cCall / (aCall + cCall || 1)) * 100,
      putRollover: (cPut / (aPut + cPut || 1)) * 100,
      totalRollover: rolloverPct,
      sentiment: rolloverPct > 60 ? "Aggressive" : rolloverPct > 40 ? "Steady" : "Weak"
    }
  }, [activeDataset, compareDataset]);

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

  if (datasets.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col justify-center items-center h-[80vh]">
        <div
          className="glass-panel hover:border-[#3b82f6] transition-all duration-500 w-full"
          style={{ padding: "6rem 2rem", textAlign: "center", borderStyle: "dashed", cursor: "pointer", borderWidth: "2px" }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="bg-[#3b82f6]/10 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Activity size={56} color="#3b82f6" />
          </div>
          <h2 className="text-4xl font-bold mb-4 gradient-text tracking-tight">Institutional Terminal</h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto text-lg leading-relaxed">
            Upload Option Chain files to analyze Rollovers, Calendar Spreads, and Smart Money flows.
          </p>
          <div className="flex justify-center gap-4">
            <button className="btn-primary px-8 py-4 text-lg rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2">
              <Database size={20} /> Select CSV / Excel
            </button>
            <button 
              className="bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] px-8 py-4 text-lg rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2 border border-[#10b981]/30 transition-colors"
              onClick={(e) => { e.stopPropagation(); fetchLiveNSEData("NIFTY"); }}
              disabled={liveLoading}
            >
              <CloudLightning size={20} className={liveLoading ? "animate-pulse" : ""} /> {liveLoading ? "Fetching..." : "Fetch Live NSE"}
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" multiple style={{ display: "none" }} />
          {loading && <p className="mt-6 text-[#3b82f6] animate-pulse font-medium">Processing Datasets...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto px-4 pb-20">

      {/* 1. DATA MANAGER HEADER */}
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
                <span className="flex items-center gap-1 text-white"><Layers size={14} color="#3b82f6" /> {activeDataset?.symbol}</span>
                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                <span className="flex items-center gap-1"><Calendar size={14} color="#8b5cf6" /> Current: {activeDataset?.expiry}</span>
                {compareDataset && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                    <span className="flex items-center gap-1 text-amber-400"><Clock size={14} /> Next: {compareDataset?.expiry}</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                <span>Spot: <strong className="text-white">{formatNum(activeDataset?.atm || 0)}</strong></span>
              </div>
            </div>
          </div>

          {/* Center: File Switching & Management */}
          <div className="flex-1 flex justify-center gap-3 w-full xl:w-auto bg-black/20 p-2 rounded-xl border border-[var(--border-color)]">
            <div className="w-48">
              <CustomSelect
                icon={Database}
                options={datasets.map(d => ({ label: `Cur: ${d.expiry}`, value: d.id }))}
                value={activeDatasetId}
                onChange={setActiveDatasetId}
                placeholder="Current Dataset"
              />
            </div>
            <div className="w-48">
              <CustomSelect
                icon={Clock}
                options={datasets.filter(d=>d.id !== activeDatasetId).map(d => ({ label: `Nxt: ${d.expiry}`, value: d.id }))}
                value={compareDatasetId}
                onChange={setCompareDatasetId}
                placeholder="Next Dataset (Optional)"
              />
            </div>
            <button
              className="bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-[#10b981]/30"
              onClick={() => fetchLiveNSEData(activeDataset?.symbol || "NIFTY")}
              disabled={liveLoading}
            >
              <CloudLightning size={16} className={liveLoading ? "animate-pulse" : ""} />
            </button>
            <button
              className="bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-[#3b82f6]/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" multiple style={{ display: "none" }} />
            <button
              className="bg-red-500/20 hover:bg-red-500/30 text-red-500 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-red-500/30"
              onClick={resetWorkspace}
              title="Reset Workspace"
            >
              <RefreshCw size={16} /> <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex gap-3 w-full xl:w-auto justify-end">
            <button className="bg-[#1a1d2d] hover:bg-[#252a40] text-white px-4 py-2 rounded-lg border border-[var(--border-color)] transition-all flex items-center gap-2 shadow-md" onClick={exportPDF}>
              <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div id="export-container" className="flex flex-col gap-8">

        {/* 2. TABS NAVIGATION */}
        <div className="flex gap-2 p-1 bg-[#161925]/50 border border-[var(--border-color)] rounded-xl w-fit mx-auto lg:mx-0 backdrop-blur-sm overflow-x-auto max-w-full">
          {[
            { id: "Overview", label: "Overview & Bias" },
            { id: "StrategyEngine", label: "Strategy Engine" },
            { id: "SmartMoney", label: "Smart Money & PCR" },
            { id: "Rollover", label: "Rollover Analysis" },
            { id: "CustomLab", label: "Custom Strategy Lab" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 whitespace-nowrap ${activeTab === tab.id ? 'bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. TAB VIEWS */}

        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Status Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-5 bg-[#161925]/40 rounded-2xl border border-[var(--border-color)]">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total CE OI</p>
                <p className="font-bold text-lg text-[#ef4444]">{formatNum(totalCallOI)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total PE OI</p>
                <p className="font-bold text-lg text-[#10b981]">{formatNum(totalPutOI)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total PCR Ratio</p>
                <p className="font-bold text-lg" style={{ color: pcrSentiment.color }}>{totalPCR.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Total Strikes Parsed</p>
                <p className="font-bold text-lg text-white">{activeDataset?.data.length}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">Rollover Bias</p>
                <p className={`font-bold text-lg ${rolloverStats?.sentiment === 'Aggressive' ? 'text-amber-400' : 'text-gray-300'}`}>{rolloverStats ? rolloverStats.sentiment : 'N/A'}</p>
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
                <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">{formatNum(maxCall?.callOI || 0)} CE OI</div>
              </div>

              <div className="glass-panel p-8 border-b-4 border-b-[#10b981] relative overflow-hidden shadow-xl">
                <p className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
                  Highest Support <TrendingDown size={16} color="#10b981" />
                </p>
                <h2 className="text-5xl font-extrabold text-[#10b981] mb-2">{formatNum(maxPut?.strike || 0)}</h2>
                <div className="text-sm text-gray-300 font-semibold bg-black/30 w-fit px-3 py-1 rounded-full">{formatNum(maxPut?.putOI || 0)} PE OI</div>
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
                <BarChart2 className="text-[#3b82f6]" size={28} /> Strike Visualization
              </h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeDataset?.data.filter(d => Math.abs(d.strike - (activeDataset?.atm || 0)) <= 800)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
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
            {activeDataset && <InstitutionalDecisionEngine dataset={activeDataset} />}
            {activeDataset && <IntradayComparison previousUpload={previousUpload} currentUpload={currentUpload} currentSymbol={activeDataset.symbol} />}
          </div>
        )}

        {/* ================= STRATEGY ENGINE TAB ================= */}
        {activeTab === "StrategyEngine" && (
          <StrategyEngine activeDataset={activeDataset} compareDataset={compareDataset} />
        )}

        {/* ================= CUSTOM LAB TAB ================= */}
        {activeTab === "CustomLab" && (
          <CustomStrategyBuilder activeDataset={activeDataset} />
        )}

        {/* ================= SMART MONEY & PCR TAB ================= */}
        {activeTab === "SmartMoney" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* AI Insights */}
              <div className="bg-gradient-to-b from-[#1a1d2d] to-[#0f111a] rounded-2xl border border-[#8b5cf6]/40 p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-[-30px] right-[-30px] opacity-10"><BrainCircuit size={150} color="#8b5cf6" /></div>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#8b5cf6]">
                  <Lightbulb size={28} /> AI PCR & Heatmap Engine
                </h3>
                <div className="space-y-4 relative z-10 bg-black/20 p-6 rounded-xl border border-white/5">
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18} /></span>
                    <span className="leading-relaxed"><strong className="text-white">Resistance Zone:</strong> Massive Call Writing at <strong className="text-[#ef4444]">{formatNum(maxCall?.strike || 0)}</strong>. Institutions expect expiry below this level.</span>
                  </div>
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18} /></span>
                    <span className="leading-relaxed"><strong className="text-white">Support Zone:</strong> Deep Put Writing at <strong className="text-[#10b981]">{formatNum(maxPut?.strike || 0)}</strong>. Market Makers defending the floor aggressively.</span>
                  </div>
                  <div className="flex gap-4 text-base text-gray-200 items-start">
                    <span className="text-[#8b5cf6] mt-1"><Layers size={18} /></span>
                    <span className="leading-relaxed">
                      <strong className="text-white">Market Bias:</strong> PCR at <strong style={{ color: pcrSentiment.color }}>{totalPCR.toFixed(3)}</strong>. {totalPCR > 1.2 ? "Extremely bullish sentiment with aggressive put shorting." : totalPCR < 0.8 ? "Bearish sentiment with strong call resistance." : "Sideways and range-bound trading anticipated."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Volatility Engine */}
              <div className="glass-panel p-8 relative overflow-hidden shadow-2xl">
                 <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-amber-400">
                  <Activity size={28} /> Volatility Skew & Smile
                </h3>
                <p className="text-sm text-gray-400 mb-4">Implied Volatility (IV) curve across strikes reveals hedging demand.</p>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeDataset?.data.filter(d => Math.abs(d.strike - (activeDataset?.atm || 0)) <= 800)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                      <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} domain={['auto','auto']} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="callIV" stroke="#ef4444" strokeWidth={2} dot={false} name="Call IV %" />
                      <Line type="monotone" dataKey="putIV" stroke="#10b981" strokeWidth={2} dot={false} name="Put IV %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ROLLOVER & COMPARE TAB ================= */}
        {activeTab === "Rollover" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="glass-panel p-8">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b border-white/5 pb-6">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <Clock size={28} color="#f59e0b" /> Rollover Migration Analysis
                  </h3>
                  <p className="text-[var(--text-secondary)] mt-2">Track Smart Money shifting from Current to Next Expiry.</p>
                </div>

                {!compareDataset && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <ShieldAlert size={18} /> Select "Next Dataset" in top bar to view Rollover.
                  </div>
                )}
              </div>

              {compareDataset ? (
                <div className="flex flex-col gap-8">
                  {/* Diff Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-1">Total Rollover %</p>
                      <p className="font-bold text-3xl text-amber-400">{rolloverStats?.totalRollover.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500 mt-2">Puts + Calls Shifted</p>
                    </div>
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-1">Call Rollover %</p>
                      <p className="font-bold text-3xl text-[#ef4444]">{rolloverStats?.callRollover.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500 mt-2">Resistance Migration</p>
                    </div>
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-1">Put Rollover %</p>
                      <p className="font-bold text-3xl text-[#10b981]">{rolloverStats?.putRollover.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500 mt-2">Support Migration</p>
                    </div>
                    <div className="bg-[#161925] p-6 rounded-xl border border-[var(--border-color)]">
                      <p className="text-sm text-gray-400 mb-1">Conviction Engine</p>
                      <p className={`font-bold text-3xl ${rolloverStats?.sentiment === 'Aggressive' ? 'text-emerald-400' : 'text-gray-400'}`}>{rolloverStats?.sentiment}</p>
                      <p className="text-xs text-gray-500 mt-2">Institutional Participation</p>
                    </div>
                  </div>

                  {/* Chart */}
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Strike-wise Rollover Heatmap</h4>
                  <div className="h-[450px] w-full bg-[#0a0c12] rounded-xl p-4 border border-[var(--border-color)]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="strike" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'rgba(15, 17, 26, 0.95)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="activePut" fill="#10b981" opacity={0.3} name="Curr Put OI" stackId="put" />
                        <Bar dataKey="comparePut" fill="#10b981" name="Next Put OI" stackId="put" />
                        
                        <Bar dataKey="activeCall" fill="#ef4444" opacity={0.3} name="Curr Call OI" stackId="call" />
                        <Bar dataKey="compareCall" fill="#ef4444" name="Next Call OI" stackId="call" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <Database size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Awaiting Next Expiry Dataset...</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
