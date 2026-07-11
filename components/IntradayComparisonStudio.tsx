"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import {
  Upload, Activity, TrendingUp, TrendingDown,
  BrainCircuit, Target, Shield, BarChart2, Zap, ArrowRight,
  Download, Layers, BarChart, FileText,
  ChevronDown, ChevronUp, RefreshCw, CheckCircle, XCircle,
  PieChart
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface OptionRow {
  strike: number;
  callOI: number;
  callVol: number;
  callLTP: number;
  callIV: number;
  putOI: number;
  putVol: number;
  putLTP: number;
  putIV: number;
}

interface ParsedFile {
  underlying: string;
  expiry: string;
  fileName: string;
  time: string;
  rows: OptionRow[];
  totalCEOI: number;
  totalPEOI: number;
  spot: number;
  atm: number;
  pcr: number;
}

interface DiffRow {
  strike: number;
  prev: OptionRow;
  curr: OptionRow;
  ceOIDiff: number;
  peOIDiff: number;
  ceVolDiff: number;
  peVolDiff: number;
  ceLTPDiff: number;
  peLTPDiff: number;
  ceVolPct: number;
  peVolPct: number;
  ceOIPct: number;
  peOIPct: number;
  ceLTPPct: number;
  peLTPPct: number;
  ceClass: string;
  peClass: string;
  ceConfidence: string;
  peConfidence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pn = (v: any): number => {
  if (v == null || v === "" || v === "-" || v === " ") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/,/g, "")) || 0;
};

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtDiff = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;

const classifyStrike = (
  oiDiff: number,
  ltpDiff: number,
  type: "CE" | "PE"
): { label: string; confidence: string } => {
  const absOI = Math.abs(oiDiff);
  const conf = absOI > 100000 ? "High" : absOI > 30000 ? "Medium" : "Low";

  if (type === "CE") {
    if (oiDiff > 0 && ltpDiff <= 0) return { label: "Fresh Call Writing", confidence: conf };
    if (oiDiff > 0 && ltpDiff > 0) return { label: "Long Build-up", confidence: conf };
    if (oiDiff < 0 && ltpDiff > 0) return { label: "Short Covering", confidence: conf };
    if (oiDiff < 0 && ltpDiff <= 0) return { label: "Long Unwinding", confidence: conf };
  } else {
    if (oiDiff > 0 && ltpDiff <= 0) return { label: "Fresh Put Writing", confidence: conf };
    if (oiDiff > 0 && ltpDiff > 0) return { label: "Short Build-up", confidence: conf };
    if (oiDiff < 0 && ltpDiff > 0) return { label: "Short Covering", confidence: conf };
    if (oiDiff < 0 && ltpDiff <= 0) return { label: "Long Unwinding", confidence: conf };
  }
  return { label: "Neutral", confidence: "Low" };
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────────────────────────────────────

const parseOptionChainCSV = (text: string, fileName: string): ParsedFile => {
  const result = Papa.parse(text, { skipEmptyLines: false });
  const rows: any[][] = result.data as any[][];

  let underlying = "UNKNOWN";
  let expiry = "UNKNOWN";

  // Try to detect underlying from filename
  const fnUpper = fileName.toUpperCase();
  const knownSymbols = ["MIDCPNIFTY", "BANKNIFTY", "FINNIFTY", "NIFTY", "SENSEX"];
  for (const sym of knownSymbols) {
    if (fnUpper.includes(sym)) { underlying = sym; break; }
  }

  // Scan first 5 rows for metadata
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const rowStr = (rows[i] || []).join(" ").toUpperCase();
    const symMatch = rowStr.match(/UNDERLYING[:\s,-]+([A-Z]{3,15})/);
    if (symMatch && !["INDEX", "VALUE", "NAME"].includes(symMatch[1])) underlying = symMatch[1];
    const expMatch = rowStr.match(/\d{1,2}[-\s][A-Z]{3}[-\s]\d{2,4}/);
    if (expMatch) expiry = expMatch[0].replace(/\s/g, "-").toUpperCase();
  }

  // Expiry from filename
  if (expiry === "UNKNOWN") {
    const dateMatch = fileName.match(/(\d{1,2}[A-Za-z]{3}\d{2,4})|(\d{1,2}-[A-Za-z]{3}-\d{2,4})/);
    if (dateMatch) expiry = dateMatch[0].toUpperCase();
  }

  const optionRows: OptionRow[] = [];
  let totalCEOI = 0, totalPEOI = 0;

  // NSE option chain format: header at row 1, data from row 2
  // Cols: blank,OI,ChgOI,Vol,IV,LTP,Chg,BidQty,Bid,Ask,AskQty,STRIKE,BidQty,Bid,Ask,AskQty,Chg,LTP,IV,Vol,ChgOI,OI,blank
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 22) continue;
    const strike = pn(r[11]);
    if (!strike || strike < 100) continue;

    const row: OptionRow = {
      strike,
      callOI: pn(r[1]),
      callVol: pn(r[3]),
      callLTP: pn(r[5]),
      callIV: pn(r[4]),
      putOI: pn(r[21]),
      putVol: pn(r[19]),
      putLTP: pn(r[17]),
      putIV: pn(r[18]),
    };
    optionRows.push(row);
    totalCEOI += row.callOI;
    totalPEOI += row.putOI;
  }

  if (optionRows.length === 0) throw new Error("No valid option chain rows found.");

  // Determine ATM (closest to equal CE/PE LTP)
  let minDiff = Infinity, atm = optionRows[0].strike;
  for (const r of optionRows) {
    if (r.callLTP > 0 && r.putLTP > 0) {
      const d = Math.abs(r.callLTP - r.putLTP);
      if (d < minDiff) { minDiff = d; atm = r.strike; }
    }
  }

  // Approximate spot: ATM strike (CE LTP ≈ PE LTP)
  const atmRow = optionRows.find(r => r.strike === atm);
  const spot = atmRow ? atm + (atmRow.callLTP - atmRow.putLTP) : atm;
  const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 0;

  // Extract time from filename e.g. "0915" or "09-15"
  const timeMatch = fileName.match(/(\d{4})(?![\d])/);
  let time = "N/A";
  if (timeMatch) {
    const t = timeMatch[1];
    time = `${t.slice(0, 2)}:${t.slice(2)}`;
  }

  return { underlying, expiry, fileName, time, rows: optionRows, totalCEOI, totalPEOI, spot, atm, pcr };
};

// ─────────────────────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

const SectionCard = ({ title, icon: Icon, color = "#8b5cf6", children }: {
  title: string; icon: any; color?: string; children: React.ReactNode;
}) => (
  <div className="glass-panel p-6 mb-6" style={{ borderColor: `${color}30` }}>
    <h3 className="flex items-center gap-3 text-lg font-bold text-white mb-5 pb-3 border-b border-white/10">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={18} style={{ color }} />
      </span>
      {title}
    </h3>
    {children}
  </div>
);

const StatCard = ({ label, value, sub, color = "white" }: { label: string; value: React.ReactNode; sub?: string; color?: string }) => (
  <div className="bg-[#161925]/70 rounded-xl p-4 border border-white/5">
    <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</p>
    <p className="text-xl font-bold" style={{ color }}>{value}</p>
    {sub && <p className="text-xs mt-1" style={{ color: `${color}99` }}>{sub}</p>}
  </div>
);

const Badge = ({ label, type }: { label: string; type: "bullish" | "bearish" | "neutral" | "warning" | "info" | "purple" }) => {
  const colors: Record<string, string> = {
    bullish: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    bearish: "bg-red-500/20 text-red-400 border-red-500/30",
    neutral: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    warning: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${colors[type]}`}>{label}</span>
  );
};

const DiffCell = ({ val, pct, reverse = false }: { val: number; pct?: number; reverse?: boolean }) => {
  const positive = reverse ? val < 0 : val > 0;
  const color = val === 0 ? "#64748b" : positive ? "#10b981" : "#ef4444";
  return (
    <span style={{ color }} className="font-medium">
      {fmtDiff(val)}{pct !== undefined && <span className="text-xs ml-1 opacity-70">({fmtPct(pct)})</span>}
    </span>
  );
};

const ClassBadge = ({ label }: { label: string }) => {
  if (label.includes("Fresh Call Writing") || label.includes("Long Unwinding")) return <Badge label={label} type="bearish" />;
  if (label.includes("Fresh Put Writing") || label.includes("Long Build-up") || label.includes("Short Build-up")) return <Badge label={label} type="bullish" />;
  if (label.includes("Short Covering")) return <Badge label={label} type="info" />;
  return <Badge label={label} type="neutral" />;
};

const ConfBadge = ({ label }: { label: string }) => {
  if (label === "High") return <Badge label={label} type="warning" />;
  if (label === "Medium") return <Badge label={label} type="info" />;
  return <Badge label={label} type="neutral" />;
};

// Intensity-based color palette (unchanged logic – only presentation)
const getChipStyle = (val: number, max: number): React.CSSProperties => {
  if (max === 0 || val === 0) return {
    background: "rgba(100,116,139,0.18)",
    border: "1px solid rgba(100,116,139,0.25)",
    boxShadow: "none",
    color: "#94a3b8",
  };
  const t = Math.min(Math.abs(val) / max, 1);
  if (val > 0) {
    if (t > 0.65) return {
      background: "linear-gradient(135deg,rgba(16,185,129,0.45),rgba(5,150,105,0.35))",
      border: "1px solid rgba(16,185,129,0.5)",
      boxShadow: "0 0 10px rgba(16,185,129,0.25)",
      color: "#6ee7b7",
    };
    return {
      background: "linear-gradient(135deg,rgba(16,185,129,0.22),rgba(5,150,105,0.15))",
      border: "1px solid rgba(16,185,129,0.25)",
      boxShadow: "0 0 6px rgba(16,185,129,0.12)",
      color: "#a7f3d0",
    };
  } else {
    if (t > 0.65) return {
      background: "linear-gradient(135deg,rgba(239,68,68,0.45),rgba(185,28,28,0.35))",
      border: "1px solid rgba(239,68,68,0.5)",
      boxShadow: "0 0 10px rgba(239,68,68,0.25)",
      color: "#fca5a5",
    };
    return {
      background: "linear-gradient(135deg,rgba(249,115,22,0.28),rgba(239,68,68,0.18))",
      border: "1px solid rgba(249,115,22,0.30)",
      boxShadow: "0 0 6px rgba(249,115,22,0.12)",
      color: "#fdba74",
    };
  }
};

const HeatChip = ({ val, max, label }: { val: number; max: number; label: string }) => {
  const style = getChipStyle(val, max);
  return (
    <div
      style={{
        ...style,
        borderRadius: "10px",
        padding: "9px 12px",
        textAlign: "center",
        flex: "1 1 80px",
        minWidth: "76px",
        maxWidth: "110px",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px) scale(1.04)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = style.boxShadow
          ? style.boxShadow.replace(/0.25\)/, "0.5)").replace(/0.12\)/, "0.3)")
          : "0 4px 14px rgba(255,255,255,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = style.boxShadow || "";
      }}
    >
      <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: "3px", letterSpacing: "0.02em" }}>{label}</p>
      <p style={{ fontSize: "12px", fontWeight: 800, color: style.color as string }}>{fmtDiff(val)}</p>
    </div>
  );
};

interface HeatmapCardDef {
  title: string;
  accentColor: string;
  badgeLabel: string;
  data: DiffRow[];
  valKey: keyof DiffRow;
  max: number;
}

const HeatmapCard = ({ title, accentColor, badgeLabel, data, valKey, max }: HeatmapCardDef) => (
  <div style={{
    background: "rgba(22,25,37,0.75)",
    border: `1px solid ${accentColor}28`,
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    minHeight: "220px",
    boxShadow: `0 4px 24px ${accentColor}10`,
  }}>
    {/* Card header */}
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <div style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: accentColor, boxShadow: `0 0 6px ${accentColor}`,
        flexShrink: 0,
      }} />
      <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>{title}</p>
      <span style={{
        fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px",
        background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}35`,
      }}>{badgeLabel}</span>
    </div>
    {/* Chip grid — fills remaining height */}
    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "6px", alignContent: data.length === 0 ? "center" : "flex-start", justifyContent: data.length === 0 ? "center" : "flex-start" }}>
      {data.length > 0
        ? data.map(r => <HeatChip key={r.strike} val={r[valKey] as number} max={max} label={fmt(r.strike)} />)
        : <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)", textAlign: "center", width: "100%" }}>No data in this window</p>}
    </div>
  </div>
);


// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOADER WIDGET
// ─────────────────────────────────────────────────────────────────────────────

const FileUploader = ({
  label, sublabel, file, onFile, color
}: {
  label: string; sublabel: string; file: ParsedFile | null;
  onFile: (f: ParsedFile) => void; color: string;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setLoading(true);
    try {
      const text = await f.text();
      const parsed = parseOptionChainCSV(text, f.name);
      onFile(parsed);
    } catch (err: any) {
      setError(err.message || "Parse error");
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div
      className="flex-1 rounded-2xl p-6 border-2 border-dashed transition-all cursor-pointer hover:border-opacity-100"
      style={{ borderColor: `${color}50`, background: `${color}08` }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".csv" onChange={handle} style={{ display: "none" }} />
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
          {file
            ? <CheckCircle size={24} style={{ color }} />
            : <Upload size={24} style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base mb-0.5">{label}</p>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{sublabel}</p>
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color }}>{file.underlying} — {file.expiry}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{file.fileName}</p>
              <div className="flex gap-3 mt-2">
                <span className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
                  ⏱ {file.time}
                </span>
                <span className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
                  📊 {file.rows.length} strikes
                </span>
                <span className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
                  PCR {file.pcr.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <button
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
            >
              {loading ? "Parsing..." : "Choose File"}
            </button>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function IntradayComparisonStudio() {
  const [prevFile, setPrevFile] = useState<ParsedFile | null>(null);
  const [currFile, setCurrFile] = useState<ParsedFile | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const toggleSection = (n: number) => setExpandedSection(s => s === n ? null : n);

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    if (!prevFile || !currFile) { setValidationError("Please upload both files."); return; }
    if (prevFile.underlying !== currFile.underlying || prevFile.expiry !== currFile.expiry) {
      setValidationError("Underlying or Expiry mismatch. Both files must belong to the same underlying and same expiry.");
      setAnalyzed(false);
      return;
    }
    setValidationError(null);
    setAnalyzed(true);
    setExpandedSection(null);
    setTimeout(() => {
      document.getElementById("ics-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [prevFile, currFile]);

  // ── Core Diff Computation ─────────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!analyzed || !prevFile || !currFile) return null;

    const strikes = Array.from(new Set([
      ...prevFile.rows.map(r => r.strike),
      ...currFile.rows.map(r => r.strike),
    ])).sort((a, b) => a - b);

    const empty: OptionRow = { strike: 0, callOI: 0, callVol: 0, callLTP: 0, callIV: 0, putOI: 0, putVol: 0, putLTP: 0, putIV: 0 };

    const diffRows: DiffRow[] = strikes.map(strike => {
      const p = prevFile.rows.find(r => r.strike === strike) || { ...empty, strike };
      const c = currFile.rows.find(r => r.strike === strike) || { ...empty, strike };

      const ceOIDiff = c.callOI - p.callOI;
      const peOIDiff = c.putOI - p.putOI;
      const ceVolDiff = c.callVol - p.callVol;
      const peVolDiff = c.putVol - p.putVol;
      const ceLTPDiff = c.callLTP - p.callLTP;
      const peLTPDiff = c.putLTP - p.putLTP;

      const safe = (d: number, base: number) => base > 0 ? (d / base) * 100 : 0;

      const ceCls = classifyStrike(ceOIDiff, ceLTPDiff, "CE");
      const peCls = classifyStrike(peOIDiff, peLTPDiff, "PE");

      return {
        strike, prev: p, curr: c,
        ceOIDiff, peOIDiff, ceVolDiff, peVolDiff, ceLTPDiff, peLTPDiff,
        ceVolPct: safe(ceVolDiff, p.callVol),
        peVolPct: safe(peVolDiff, p.putVol),
        ceOIPct: safe(ceOIDiff, p.callOI),
        peOIPct: safe(peOIDiff, p.putOI),
        ceLTPPct: safe(ceLTPDiff, p.callLTP),
        peLTPPct: safe(peLTPDiff, p.putLTP),
        ceClass: ceCls.label,
        peClass: peCls.label,
        ceConfidence: ceCls.confidence,
        peConfidence: peCls.confidence,
      };
    });

    const sorted = (arr: DiffRow[], key: keyof DiffRow, desc = true) =>
      [...arr].sort((a, b) => desc ? (b[key] as number) - (a[key] as number) : (a[key] as number) - (b[key] as number));

    // Top 10 volume
    const top10CEVolInc = sorted(diffRows, "ceVolDiff").slice(0, 10);
    const top10PEVolInc = sorted(diffRows, "peVolDiff").slice(0, 10);
    const top10CEVolDec = sorted(diffRows, "ceVolDiff", false).slice(0, 10);
    const top10PEVolDec = sorted(diffRows, "peVolDiff", false).slice(0, 10);

    // Top 10 OI
    const top10CEOIInc = sorted(diffRows, "ceOIDiff").slice(0, 10);
    const top10PEOIInc = sorted(diffRows, "peOIDiff").slice(0, 10);
    const top10CEOIDec = sorted(diffRows, "ceOIDiff", false).slice(0, 10);
    const top10PEOIDec = sorted(diffRows, "peOIDiff", false).slice(0, 10);

    // Top 10 premium
    const top10CEPremInc = sorted(diffRows, "ceLTPDiff").slice(0, 10);
    const top10PEPremInc = sorted(diffRows, "peLTPDiff").slice(0, 10);
    const top10CEPremDec = sorted(diffRows, "ceLTPDiff", false).slice(0, 10);
    const top10PEPremDec = sorted(diffRows, "peLTPDiff", false).slice(0, 10);

    // Institutional activity
    const freshCEWrite = diffRows.filter(r => r.ceClass === "Fresh Call Writing").sort((a, b) => b.ceOIDiff - a.ceOIDiff).slice(0, 5);
    const freshPEWrite = diffRows.filter(r => r.peClass === "Fresh Put Writing").sort((a, b) => b.peOIDiff - a.peOIDiff).slice(0, 5);
    const callBuying = diffRows.filter(r => r.ceClass === "Long Build-up").sort((a, b) => b.ceOIDiff - a.ceOIDiff).slice(0, 5);
    const putBuying = diffRows.filter(r => r.peClass === "Short Build-up").sort((a, b) => b.peOIDiff - a.peOIDiff).slice(0, 5);
    const longUnwind = diffRows.filter(r => r.ceClass === "Long Unwinding").sort((a, b) => a.ceOIDiff - b.ceOIDiff).slice(0, 5);
    const shortCover = diffRows.filter(r => r.ceClass === "Short Covering" || r.peClass === "Short Covering")
      .sort((a, b) => Math.abs(b.ceOIDiff) - Math.abs(a.ceOIDiff)).slice(0, 5);

    // Support / resistance
    const prevMaxCE = [...prevFile.rows].sort((a, b) => b.callOI - a.callOI)[0];
    const currMaxCE = [...currFile.rows].sort((a, b) => b.callOI - a.callOI)[0];
    const prevMaxPE = [...prevFile.rows].sort((a, b) => b.putOI - a.putOI)[0];
    const currMaxPE = [...currFile.rows].sort((a, b) => b.putOI - a.putOI)[0];

    const totalCEOIDiff = currFile.totalCEOI - prevFile.totalCEOI;
    const totalPEOIDiff = currFile.totalPEOI - prevFile.totalPEOI;
    const pcrChange = currFile.pcr - prevFile.pcr;
    const spotDiff = currFile.spot - prevFile.spot;
    const atmShift = currFile.atm - prevFile.atm;

    // Market bias
    const totalCEAdded = diffRows.reduce((a, r) => a + (r.ceOIDiff > 0 ? r.ceOIDiff : 0), 0);
    const totalPEAdded = diffRows.reduce((a, r) => a + (r.peOIDiff > 0 ? r.peOIDiff : 0), 0);
    const bias: "Bullish" | "Bearish" | "Neutral" =
      currFile.pcr > 1.3 && pcrChange > 0 ? "Bullish" :
      currFile.pcr < 0.7 && pcrChange < 0 ? "Bearish" :
      totalPEAdded > totalCEAdded * 1.2 ? "Bullish" :
      totalCEAdded > totalPEAdded * 1.2 ? "Bearish" : "Neutral";

    const biasConf = Math.abs(totalPEAdded - totalCEAdded) > 500000 ? "High" :
      Math.abs(totalPEAdded - totalCEAdded) > 100000 ? "Medium" : "Low";

    const pcrTrend: "Improving" | "Weakening" | "Stable" =
      pcrChange > 0.05 ? "Improving" : pcrChange < -0.05 ? "Weakening" : "Stable";

    const expZoneLow = currMaxPE?.strike || 0;
    const expZoneHigh = currMaxCE?.strike || 0;

    // Smart money shift — top PE OI migration
    const peShift = [...diffRows].sort((a, b) => b.peOIDiff - a.peOIDiff);
    const ceShift = [...diffRows].sort((a, b) => b.ceOIDiff - a.ceOIDiff);

    // Strategy
    const strategy = generateStrategy(bias, expZoneLow, expZoneHigh, currFile.atm, currFile.pcr);

    // AI conclusion
    const conclusion = generateConclusion(bias, prevFile, currFile, freshCEWrite, freshPEWrite, callBuying, putBuying, longUnwind, shortCover, spotDiff, atmShift, pcrChange, expZoneLow, expZoneHigh);

    return {
      diffRows, bias, biasConf, pcrTrend, pcrChange, spotDiff, atmShift,
      totalCEOIDiff, totalPEOIDiff, totalCEAdded, totalPEAdded,
      top10CEVolInc, top10PEVolInc, top10CEVolDec, top10PEVolDec,
      top10CEOIInc, top10PEOIInc, top10CEOIDec, top10PEOIDec,
      top10CEPremInc, top10PEPremInc, top10CEPremDec, top10PEPremDec,
      freshCEWrite, freshPEWrite, callBuying, putBuying, longUnwind, shortCover,
      prevMaxCE, currMaxCE, prevMaxPE, currMaxPE,
      expZoneLow, expZoneHigh,
      peShift, ceShift,
      strategy, conclusion,
    };
  }, [analyzed, prevFile, currFile]);

  // ── Strategy Generator ───────────────────────────────────────────────────
  function generateStrategy(bias: string, support: number, resistance: number, atm: number, pcr: number) {
    const mid = Math.round((support + resistance) / 2);
    const width = resistance - support;

    if (bias === "Bullish") {
      return {
        name: "Bull Put Spread",
        why: `Bullish bias (PCR ${pcr.toFixed(2)} > 1, strong PE writing at ${fmt(support)}). Risk-defined credit strategy exploiting put writers momentum.`,
        legs: [
          { action: "Sell", type: "PE", strike: support, premium: "~ATM Put" },
          { action: "Buy", type: "PE", strike: support - 100, premium: "~OTM Put" },
        ],
        entry: `Sell ${fmt(support)} PE, Buy ${fmt(support - 100)} PE when spot is above ${fmt(support + 50)}`,
        exit: `Close at 50% profit or if spot breaks ${fmt(support - 50)} convincingly`,
        adjustment: `If spot breaks support, roll down the spread by 100 points`,
        maxRisk: `100 × Lot Size`,
        maxReward: `Net Credit × Lot Size`,
        expectedProb: "68%",
        rr: "1 : 1.8",
      };
    } else if (bias === "Bearish") {
      return {
        name: "Bear Call Spread",
        why: `Bearish bias (fresh CE writing at ${fmt(resistance)}, PCR declining). Risk-defined debit strategy benefiting from resistance holding.`,
        legs: [
          { action: "Sell", type: "CE", strike: resistance, premium: "~ATM Call" },
          { action: "Buy", type: "CE", strike: resistance + 100, premium: "~OTM Call" },
        ],
        entry: `Sell ${fmt(resistance)} CE, Buy ${fmt(resistance + 100)} CE when spot is below ${fmt(resistance - 50)}`,
        exit: `Close at 50% profit or if spot breaks ${fmt(resistance + 50)} convincingly`,
        adjustment: `If spot breaks resistance, roll up the spread by 100 points`,
        maxRisk: `100 × Lot Size`,
        maxReward: `Net Credit × Lot Size`,
        expectedProb: "65%",
        rr: "1 : 1.5",
      };
    } else {
      return {
        name: "Iron Condor",
        why: `Neutral/range-bound bias. Support at ${fmt(support)}, resistance at ${fmt(resistance)} — sell premium on both sides.`,
        legs: [
          { action: "Sell", type: "PE", strike: support, premium: "~Support Put" },
          { action: "Buy", type: "PE", strike: support - 100, premium: "~OTM Put" },
          { action: "Sell", type: "CE", strike: resistance, premium: "~Resistance Call" },
          { action: "Buy", type: "CE", strike: resistance + 100, premium: "~OTM Call" },
        ],
        entry: `When spot is between ${fmt(mid - 100)} and ${fmt(mid + 100)}`,
        exit: `Close at 40% profit or if spot moves beyond either short strike`,
        adjustment: `Roll the breached side up/down if spot tests a short strike`,
        maxRisk: `100 × Lot Size (per side)`,
        maxReward: `Net Credit × Lot Size`,
        expectedProb: "72%",
        rr: "1 : 0.8",
      };
    }
  }

  function generateConclusion(
    bias: string, prev: ParsedFile, curr: ParsedFile,
    fcw: DiffRow[], fpw: DiffRow[], cb: DiffRow[], pb: DiffRow[],
    lu: DiffRow[], sc: DiffRow[],
    spotDiff: number, atmShift: number, pcrChange: number,
    support: number, resistance: number
  ): string {
    const spotDir = spotDiff > 0 ? "higher" : spotDiff < 0 ? "lower" : "flat";
    const pcrDir = pcrChange > 0 ? "strengthened" : pcrChange < 0 ? "weakened" : "remained stable";
    const fcwStrike = fcw[0]?.strike ? fmt(fcw[0].strike) : "N/A";
    const fpwStrike = fpw[0]?.strike ? fmt(fpw[0].strike) : "N/A";
    const cbStrike = cb[0]?.strike ? fmt(cb[0].strike) : "N/A";
    const pbStrike = pb[0]?.strike ? fmt(pb[0].strike) : "N/A";
    const luStrike = lu[0]?.strike ? fmt(lu[0].strike) : "N/A";
    const scStrike = sc[0]?.strike ? fmt(sc[0].strike) : "N/A";

    return `Between ${prev.time} and ${curr.time}, institutional activity on ${curr.underlying} showed a clear ${bias.toLowerCase()} tilt. ` +
      `Spot moved ${Math.abs(spotDiff).toFixed(0)} points ${spotDir} to approximately ${curr.spot.toFixed(0)}, with the ATM shifting ${Math.abs(atmShift)} points ${atmShift > 0 ? "higher" : atmShift < 0 ? "lower" : "unchanged"}. ` +
      `The PCR ${pcrDir} from ${prev.pcr.toFixed(2)} to ${curr.pcr.toFixed(2)}, indicating that put writers ${pcrChange > 0 ? "gained confidence, building fresh support" : "reduced exposure, reflecting caution"}. ` +
      `Fresh call writing was heaviest at strike ${fcwStrike}, forming a strong resistance zone${fcw.length > 1 ? ` and ${fcw.length - 1} additional strikes` : ""}. ` +
      `Fresh put writing was concentrated at ${fpwStrike}, reinforcing support${fpw.length > 1 ? ` across ${fpw.length} strikes` : ""}. ` +
      (cb.length > 0 ? `Institutional call buying at ${cbStrike} signals directional bullish bets, adding upside pressure. ` : "") +
      (pb.length > 0 ? `Put buying at ${pbStrike} indicates hedging or directional put longs, adding downside risk. ` : "") +
      (lu.length > 0 ? `Long unwinding was observed at ${luStrike}, suggesting longs reducing exposure. ` : "") +
      (sc.length > 0 ? `Short covering at ${scStrike} indicates trapped shorts exiting positions. ` : "") +
      `The expected trading zone is ${fmt(support)} to ${fmt(resistance)}. ` +
      `Ideal trading plan: ${bias === "Bullish" ? `Buy on dips toward ${fmt(support)}, targeting ${fmt(resistance)}` : bias === "Bearish" ? `Sell on rises toward ${fmt(resistance)}, targeting ${fmt(support)}` : `Range-trade between ${fmt(support)} and ${fmt(resistance)}`}.`;
  }

  // ── PDF Export — Institutional Research Report ──────────────────────────
  const exportPDF = useCallback(() => {
    if (!analysis || !prevFile || !currFile) return;

    const {
      bias, biasConf, pcrTrend, pcrChange, spotDiff, atmShift,
      totalCEOIDiff, totalPEOIDiff, expZoneLow, expZoneHigh,
      strategy, conclusion,
      freshCEWrite, freshPEWrite, callBuying, putBuying, longUnwind, shortCover,
      top10CEVolInc, top10PEVolInc, top10CEOIInc, top10PEOIInc,
      top10CEOIDec, top10PEOIDec, top10CEPremInc, top10PEPremDec,
      prevMaxCE, currMaxCE, prevMaxPE, currMaxPE,
    } = analysis;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW = 210; // page width
    const PH = 297; // page height
    const ML = 14;  // margin left
    const MR = 196; // margin right (content ends here)
    const CW = MR - ML; // content width = 182
    const now = new Date();
    const genTime = now.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });

    // ── Safe display name (never UNKNOWN) ──
    const displayUnderlying = (currFile.underlying && currFile.underlying !== "UNKNOWN")
      ? currFile.underlying
      : currFile.fileName.replace(/\.csv$/i, "");
    const displayExpiry = (currFile.expiry && currFile.expiry !== "UNKNOWN")
      ? currFile.expiry.toUpperCase()
      : "";

    // ── Palette ──
    const C = {
      bg:       [8,  10, 22]  as [number,number,number],
      panel:    [18, 20, 38]  as [number,number,number],
      panelAlt: [24, 27, 50]  as [number,number,number],
      border:   [40, 44, 75]  as [number,number,number],
      accent:   [110, 72, 232] as [number,number,number],
      accentB:  [59, 130, 246] as [number,number,number],
      white:    [248,250,252] as [number,number,number],
      muted:    [148,163,184] as [number,number,number],
      green:    [16, 185, 129] as [number,number,number],
      red:      [239, 68, 68]  as [number,number,number],
      amber:    [245,158, 11]  as [number,number,number],
      cyan:     [6, 182, 212]  as [number,number,number],
      pink:     [236, 72, 153] as [number,number,number],
    };

    let totalPages = 0; // will be filled after render pass

    // ─── SHARED HELPERS ──────────────────────────────────────────────────────

    const fillPage = (col: [number,number,number] = C.bg) => {
      doc.setFillColor(...col);
      doc.rect(0, 0, PW, PH, "F");
    };

    const setFont = (size: number, style: "normal"|"bold" = "normal") => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
    };

    const txt = (
      text: string,
      x: number,
      y: number,
      size: number,
      color: [number,number,number],
      align: "left"|"center"|"right" = "left",
      style: "normal"|"bold" = "normal",
      maxW?: number
    ) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(...color);
      if (maxW) {
        const lines = doc.splitTextToSize(text, maxW);
        doc.text(lines, x, y, { align });
        return lines.length * size * 0.36;
      }
      doc.text(text, x, y, { align });
      return size * 0.36;
    };

    const line = (x1: number, y1: number, x2: number, y2: number, col: [number,number,number], w = 0.3) => {
      doc.setDrawColor(...col);
      doc.setLineWidth(w);
      doc.line(x1, y1, x2, y2);
    };

    const rect = (x: number, y: number, w: number, h: number, col: [number,number,number], r = 0) => {
      doc.setFillColor(...col);
      if (r > 0) doc.roundedRect(x, y, w, h, r, r, "F");
      else doc.rect(x, y, w, h, "F");
    };

    const strokeRect = (x: number, y: number, w: number, h: number, col: [number,number,number], lw = 0.3, r = 0) => {
      doc.setDrawColor(...col);
      doc.setLineWidth(lw);
      if (r > 0) doc.roundedRect(x, y, w, h, r, r, "S");
      else doc.rect(x, y, w, h, "S");
    };

    // Bias color helper
    const biasColor = (b: string): [number,number,number] =>
      b === "Bullish" ? C.green : b === "Bearish" ? C.red : C.amber;

    // KV pair inside a row
    const kv = (
      label: string, value: string,
      x: number, y: number, w: number,
      valColor: [number,number,number] = C.white
    ) => {
      txt(label, x, y, 7.5, C.muted, "left", "normal");
      txt(value, x + w, y, 8, valColor, "right", "bold");
    };

    // Section header bar
    const sectionHeader = (
      y: number, title: string, accentCol: [number,number,number] = C.accent
    ) => {
      rect(ML, y, CW, 8, C.panelAlt, 2);
      doc.setDrawColor(...accentCol);
      doc.setLineWidth(0.6);
      doc.line(ML, y, ML, y + 8);
      txt(title.toUpperCase(), ML + 5, y + 5.5, 8.5, accentCol, "left", "bold");
      return y + 11;
    };

    // ─── PAGE HEADER / FOOTER ──────────────────────────────────────────────

    const addPageChrome = (pageNum: number) => {
      // Top header bar
      rect(0, 0, PW, 12, C.panel);
      line(0, 12, PW, 12, C.border, 0.4);
      txt("INSTITUTIONAL DERIVATIVES ANALYTICS", ML, 8, 7, C.accent, "left", "bold");
      txt("INTRADAY COMPARISON REPORT  |  CONFIDENTIAL", MR, 8, 7, C.muted, "right", "normal");

      // Bottom footer bar
      rect(0, PH - 11, PW, 11, C.panel);
      line(0, PH - 11, PW, PH - 11, C.border, 0.4);
      txt(`Generated: ${genTime}`, ML, PH - 5, 6.5, C.muted, "left", "normal");
      txt(`${displayUnderlying}  |  ${displayExpiry}  |  ${prevFile.time} → ${currFile.time}`, PW / 2, PH - 5, 6.5, C.muted, "center", "normal");
      txt(`Page ${pageNum}`, MR, PH - 5, 6.5, C.muted, "right", "normal");
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1 — COVER
    // ─────────────────────────────────────────────────────────────────────────

    fillPage();

    // Gradient-like overlay panels
    rect(0, 0, PW, 110, [10, 12, 28]);
    rect(0, 85, PW, 3, C.accent);

    // Branding block
    txt("INSTITUTIONAL DERIVATIVES ANALYTICS", PW / 2, 38, 14, C.accent, "center", "bold");
    txt("Intraday Institutional Comparison Report", PW / 2, 50, 11, C.white, "center", "normal");
    line(PW / 2 - 50, 55, PW / 2 + 50, 55, C.border);

    txt(displayUnderlying, PW / 2, 68, 22, C.white, "center", "bold");
    if (displayExpiry) txt(`Expiry: ${displayExpiry}`, PW / 2, 77, 9, C.muted, "center", "normal");

    // Time window badge
    rect(PW / 2 - 35, 88, 70, 12, C.panelAlt, 3);
    txt(`${prevFile.time}  →  ${currFile.time}`, PW / 2, 96, 9, C.cyan, "center", "bold");

    // Info cards (2×3 grid)
    const cardW = 52, cardH = 26, cardGap = 6;
    const cardStartX = (PW - (3 * cardW + 2 * cardGap)) / 2;
    const cards1 = [
      { label: "Previous Spot",  value: `~${prevFile.spot.toFixed(0)}`,         col: C.muted },
      { label: "Current Spot",   value: `~${currFile.spot.toFixed(0)}`,          col: C.white },
      { label: "Spot Change",    value: fmtDiff(spotDiff),                       col: spotDiff >= 0 ? C.green : C.red },
      { label: "Previous PCR",   value: prevFile.pcr.toFixed(2),                 col: C.muted },
      { label: "Current PCR",    value: currFile.pcr.toFixed(2),                 col: C.white },
      { label: "PCR Change",     value: fmtPct(pcrChange),                       col: pcrChange >= 0 ? C.green : C.red },
    ];
    cards1.forEach((c, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      const cx = cardStartX + col * (cardW + cardGap);
      const cy = 108 + row * (cardH + cardGap);
      rect(cx, cy, cardW, cardH, C.panelAlt, 3);
      strokeRect(cx, cy, cardW, cardH, C.border, 0.3, 3);
      txt(c.label, cx + cardW / 2, cy + 9, 7, C.muted, "center", "normal");
      txt(c.value, cx + cardW / 2, cy + 19, 9.5, c.col, "center", "bold");
    });

    // Bias banner
    const bCol = biasColor(bias);
    rect(ML, 174, CW, 18, C.panelAlt, 3);
    strokeRect(ML, 174, CW, 18, bCol, 0.5, 3);
    txt("MARKET BIAS", ML + 10, 182, 7.5, C.muted, "left", "normal");
    txt(bias.toUpperCase(), ML + 10, 188, 10, bCol, "left", "bold");
    txt("AI CONFIDENCE", PW / 2, 182, 7.5, C.muted, "center", "normal");
    txt(biasConf, PW / 2, 188, 10, C.amber, "center", "bold");
    txt("STRATEGY", MR - 10, 182, 7.5, C.muted, "right", "normal");
    txt(strategy.name, MR - 10, 188, 9, C.cyan, "right", "bold");

    // File info section
    let fy = 200;
    rect(ML, fy, CW, 46, C.panelAlt, 3);
    strokeRect(ML, fy, CW, 46, C.border, 0.3, 3);
    txt("REPORT DETAILS", ML + 6, fy + 8, 7, C.accent, "left", "bold");
    line(ML, fy + 11, ML + CW, fy + 11, C.border, 0.25);

    const kvX = ML + 6, kvHalf = CW / 2 - 8;
    kv("Underlying", displayUnderlying,          kvX,              fy + 18, kvHalf);
    kv("Expiry",     displayExpiry || "—",        kvX + CW / 2,     fy + 18, kvHalf);
    kv("ATM",        `${currFile.atm}`,           kvX,              fy + 26, kvHalf);
    kv("ATM Shift",  `${prevFile.atm} → ${currFile.atm}`, kvX + CW / 2, fy + 26, kvHalf);
    kv("Prev File",  prevFile.fileName.replace(/\.csv$/i, ""), kvX, fy + 34, CW - 12, C.muted);
    kv("Curr File",  currFile.fileName.replace(/\.csv$/i, ""), kvX, fy + 40, CW - 12, C.muted);

    // Cover footer
    txt(`Generated: ${genTime}`, PW / 2, 258, 7, C.muted, "center", "normal");
    txt("CONFIDENTIAL  |  FOR INSTITUTIONAL USE ONLY", PW / 2, 265, 7, [60, 60, 100], "center", "normal");
    txt("This report is for analytical purposes only and does not constitute investment advice.", PW / 2, 272, 6.5, [50, 55, 85], "center", "normal");

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 2 — EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(2);

    let y2 = 20;
    y2 = sectionHeader(y2, "Executive Summary", C.accent);

    // Main KV grid
    const summaryRows = [
      ["Previous Time",    prevFile.time,                     "Current Time",    currFile.time],
      ["Underlying",       displayUnderlying,                  "Expiry",          displayExpiry || "—"],
      ["Previous Spot",    `~${prevFile.spot.toFixed(0)}`,    "Current Spot",    `~${currFile.spot.toFixed(0)}`],
      ["Spot Difference",  fmtDiff(spotDiff),                 "ATM Shift",       fmtDiff(atmShift)],
      ["Previous PCR",     prevFile.pcr.toFixed(2),           "Current PCR",     currFile.pcr.toFixed(2)],
      ["PCR Change",       fmtPct(pcrChange),                 "PCR Trend",       pcrTrend],
      ["Total CE OI Δ",    fmtDiff(totalCEOIDiff),            "Total PE OI Δ",   fmtDiff(totalPEOIDiff)],
      ["Market Bias",      bias,                              "Confidence",      biasConf],
    ];

    summaryRows.forEach((row, i) => {
      const ry = y2 + i * 10;
      rect(ML, ry, CW, 10, i % 2 === 0 ? C.panelAlt : C.panel);
      txt(row[0], ML + 4, ry + 7, 8, C.muted, "left", "normal");
      txt(row[1], ML + CW / 2 - 4, ry + 7, 8.5, C.white, "right", "bold");
      line(ML + CW / 2, ry, ML + CW / 2, ry + 10, C.border, 0.2);
      txt(row[2], ML + CW / 2 + 4, ry + 7, 8, C.muted, "left", "normal");
      txt(row[3], MR, ry + 7, 8.5, C.white, "right", "bold");
    });
    strokeRect(ML, y2, CW, summaryRows.length * 10, C.border, 0.3);

    y2 += summaryRows.length * 10 + 8;

    // Bias banner on page 2
    y2 = sectionHeader(y2, "Market Bias Assessment", biasColor(bias));
    rect(ML, y2, CW, 22, C.panelAlt, 3);
    strokeRect(ML, y2, CW, 22, biasColor(bias), 0.5, 3);
    txt(bias.toUpperCase(), PW / 2, y2 + 9, 15, biasColor(bias), "center", "bold");
    txt(
      bias === "Bullish"
        ? `PCR improved to ${currFile.pcr.toFixed(2)} — Put writers active. Support zone: ${fmt(expZoneLow)}.`
        : bias === "Bearish"
        ? `PCR weakened to ${currFile.pcr.toFixed(2)} — Call writers active. Resistance zone: ${fmt(expZoneHigh)}.`
        : `PCR at ${currFile.pcr.toFixed(2)} — Range-bound between ${fmt(expZoneLow)} and ${fmt(expZoneHigh)}.`,
      PW / 2, y2 + 18, 8, C.muted, "center", "normal"
    );
    y2 += 28;

    // Support / Resistance bar
    y2 = sectionHeader(y2, "Support & Resistance Migration", C.accentB);
    const sr = [
      ["Previous Support", fmt(prevMaxPE?.strike || 0), "Current Support", fmt(currMaxPE?.strike || 0)],
      ["Previous Resistance", fmt(prevMaxCE?.strike || 0), "Current Resistance", fmt(currMaxCE?.strike || 0)],
    ];
    sr.forEach((row, i) => {
      const ry2 = y2 + i * 10;
      rect(ML, ry2, CW, 10, i % 2 === 0 ? C.panelAlt : C.panel);
      txt(row[0], ML + 4, ry2 + 7, 8, C.muted);
      txt(row[1], ML + CW / 2 - 4, ry2 + 7, 8.5, i === 0 ? C.green : C.red, "right", "bold");
      line(ML + CW / 2, ry2, ML + CW / 2, ry2 + 10, C.border, 0.2);
      txt(row[2], ML + CW / 2 + 4, ry2 + 7, 8, C.muted);
      txt(row[3], MR, ry2 + 7, 8.5, i === 0 ? C.green : C.red, "right", "bold");
    });
    strokeRect(ML, y2, CW, sr.length * 10, C.border, 0.3);

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 3 — TOP INSTITUTIONAL ACTIVITY
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(3);

    let y3 = 20;

    const renderActivityTable = (
      title: string,
      rows: typeof freshCEWrite,
      oiKey: "ceOIDiff" | "peOIDiff",
      accentCol: [number,number,number],
      startY: number
    ): number => {
      startY = sectionHeader(startY, title, accentCol);
      if (rows.length === 0) {
        rect(ML, startY, CW, 9, C.panelAlt);
        txt("No activity detected in this window", ML + 4, startY + 6, 8, C.muted);
        return startY + 12;
      }
      // Header
      rect(ML, startY, CW, 8, C.panelAlt);
      txt("Rank", ML + 4, startY + 5.5, 7, accentCol, "left", "bold");
      txt("Strike", ML + 30, startY + 5.5, 7, accentCol, "left", "bold");
      txt("OI Change", MR, startY + 5.5, 7, accentCol, "right", "bold");
      startY += 8;
      rows.slice(0, 5).forEach((r, i) => {
        const ry = startY + i * 8;
        rect(ML, ry, CW, 8, i % 2 === 0 ? C.panel : C.panelAlt);
        txt(`#${i + 1}`, ML + 4, ry + 5.5, 7.5, C.muted);
        txt(fmt(r.strike), ML + 30, ry + 5.5, 8, C.white, "left", "bold");
        const oi = r[oiKey] as number;
        txt(fmtDiff(oi), MR, ry + 5.5, 8, oi >= 0 ? C.green : C.red, "right", "bold");
      });
      strokeRect(ML, startY - 8, CW, rows.slice(0,5).length * 8 + 8, C.border, 0.3);
      return startY + rows.slice(0,5).length * 8 + 6;
    };

    // Two columns layout
    const halfW = (CW - 6) / 2;
    const col1X = ML, col2X = ML + halfW + 6;

    // Fresh Call Writing
    const renderHalfTable = (
      title: string,
      rows: typeof freshCEWrite,
      oiKey: "ceOIDiff"|"peOIDerlDiff",
      accentCol: [number,number,number],
      startX: number,
      startY: number,
      colW: number,
    ): number => {
      rect(startX, startY, colW, 8, C.panelAlt, 2);
      doc.setDrawColor(...accentCol);
      doc.setLineWidth(0.5);
      doc.line(startX, startY, startX, startY + 8);
      txt(title.toUpperCase(), startX + 5, startY + 5.5, 7, accentCol, "left", "bold");
      startY += 9;

      if (rows.length === 0) {
        rect(startX, startY, colW, 8, C.panel);
        txt("No activity", startX + 4, startY + 5.5, 7, C.muted);
        return startY + 11;
      }
      // Header row
      rect(startX, startY, colW, 7, C.panelAlt);
      txt("Rank", startX + 3, startY + 5, 6.5, accentCol, "left", "bold");
      txt("Strike", startX + 18, startY + 5, 6.5, accentCol, "left", "bold");
      txt("OI Δ", startX + colW - 3, startY + 5, 6.5, accentCol, "right", "bold");
      startY += 7;

      rows.slice(0, 5).forEach((r, i) => {
        const ry = startY + i * 7;
        rect(startX, ry, colW, 7, i % 2 === 0 ? C.panel : C.panelAlt);
        txt(`#${i + 1}`, startX + 3, ry + 5, 7, C.muted);
        txt(fmt(r.strike), startX + 18, ry + 5, 7.5, C.white, "left", "bold");
        const oi = (r as any)[oiKey] as number;
        txt(fmtDiff(oi ?? 0), startX + colW - 3, ry + 5, 7.5, oi >= 0 ? C.green : C.red, "right", "bold");
      });
      strokeRect(startX, startY - 7, colW, rows.slice(0,5).length * 7 + 7, C.border, 0.3);
      return startY + rows.slice(0,5).length * 7 + 5;
    };

    type ActivityOIKey = "ceOIDiff" | "peOIDiff";

    const panels: Array<{title:string; rows: typeof freshCEWrite; oiKey: ActivityOIKey; col:[number,number,number]; x:number}> = [
      { title: "Fresh Call Writing",  rows: freshCEWrite,  oiKey: "ceOIDiff", col: C.red,    x: col1X },
      { title: "Fresh Put Writing",   rows: freshPEWrite,  oiKey: "peOIDiff", col: C.green,  x: col2X },
      { title: "Call Buying",         rows: callBuying,    oiKey: "ceOIDiff", col: C.accentB,x: col1X },
      { title: "Put Buying",          rows: putBuying,     oiKey: "peOIDiff", col: C.cyan,   x: col2X },
      { title: "Long Unwinding",      rows: longUnwind,    oiKey: "ceOIDiff", col: C.amber,  x: col1X },
      { title: "Short Covering",      rows: shortCover,    oiKey: "ceOIDiff", col: C.pink,   x: col2X },
    ];

    let rightY = y3, leftY = y3;
    panels.forEach((p) => {
      if (p.x === col1X) {
        leftY = renderHalfTable(p.title, p.rows, p.oiKey as any, p.col, p.x, leftY, halfW);
      } else {
        rightY = renderHalfTable(p.title, p.rows, p.oiKey as any, p.col, p.x, rightY, halfW);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 4 — OI & VOLUME COMPARISON TABLES
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(4);

    let y4 = 20;

    type DiffRowKeyNum = "ceOIDiff"|"peOIDiff"|"ceVolDiff"|"peVolDiff"|"ceLTPDiff"|"peLTPDiff"|"ceOIPct"|"peOIPct"|"ceVolPct"|"peVolPct"|"ceLTPPct"|"peLTPPct";

    const renderCompTable = (
      title: string,
      rows: DiffRow[],
      cols: Array<{ header: string; key: DiffRowKeyNum|"strike"; width: number; isColor?: boolean }>,
      accentCol: [number,number,number],
      startY: number,
      limit = 10
    ): number => {
      if (startY > 255) { doc.addPage(); fillPage(); addPageChrome(4); startY = 20; }
      startY = sectionHeader(startY, title, accentCol);

      const rowH = 7;
      const hdrH = 8;

      // Header
      rect(ML, startY, CW, hdrH, C.panelAlt);
      let xCursor = ML;
      cols.forEach((c) => {
        txt(c.header, xCursor + c.width / 2, startY + 5.5, 7, accentCol, "center", "bold");
        xCursor += c.width;
      });
      startY += hdrH;

      rows.slice(0, limit).forEach((r, i) => {
        if (startY > 265) { doc.addPage(); fillPage(); addPageChrome(4); startY = 20; }
        rect(ML, startY, CW, rowH, i % 2 === 0 ? C.panel : C.panelAlt);
        xCursor = ML;
        cols.forEach((c) => {
          let val: string;
          let color: [number,number,number] = C.white;
          if (c.key === "strike") {
            val = fmt(r.strike);
            color = C.white;
          } else {
            const num = r[c.key] as number;
            val = c.key.includes("Pct") ? fmtPct(num) : fmtDiff(num);
            if (c.isColor) color = num > 0 ? C.green : num < 0 ? C.red : C.muted;
          }
          txt(val, xCursor + c.width / 2, startY + 5, 7.5, color, "center", "bold");
          xCursor += c.width;
        });
        startY += rowH;
      });
      strokeRect(ML, startY - rows.slice(0,limit).length * rowH - hdrH, CW, rows.slice(0,limit).length * rowH + hdrH, C.border, 0.3);
      return startY + 6;
    };

    const strikeW = 32, diffW = 32, pctW = 28, prevW = 30, currW = 30;

    y4 = renderCompTable(
      "Top OI Increase — CE", analysis.top10CEOIInc.filter(r => r.ceOIDiff > 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "Prev OI",   key: "ceOIPct",   width: prevW },
        { header: "OI Δ",      key: "ceOIDiff",  width: diffW, isColor: true },
        { header: "OI Δ%",     key: "ceOIPct",   width: pctW,  isColor: true },
      ],
      C.red, y4
    );

    y4 = renderCompTable(
      "Top OI Increase — PE", analysis.top10PEOIInc.filter(r => r.peOIDiff > 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "Prev OI",   key: "peOIPct",   width: prevW },
        { header: "OI Δ",      key: "peOIDiff",  width: diffW, isColor: true },
        { header: "OI Δ%",     key: "peOIPct",   width: pctW,  isColor: true },
      ],
      C.green, y4
    );

    y4 = renderCompTable(
      "Top OI Decrease — CE", analysis.top10CEOIDec.filter(r => r.ceOIDiff < 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "OI Δ",      key: "ceOIDiff",  width: diffW, isColor: true },
        { header: "OI Δ%",     key: "ceOIPct",   width: pctW,  isColor: true },
        { header: "Vol Δ",     key: "ceVolDiff", width: diffW, isColor: true },
      ],
      C.amber, y4
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 5 — VOLUME & PREMIUM TABLES
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(5);

    let y5 = 20;

    y5 = renderCompTable(
      "Top Volume Increase — CE", analysis.top10CEVolInc.filter(r => r.ceVolDiff > 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "Vol Δ",     key: "ceVolDiff", width: diffW, isColor: true },
        { header: "Vol Δ%",    key: "ceVolPct",  width: pctW,  isColor: true },
        { header: "OI Δ",      key: "ceOIDiff",  width: diffW, isColor: true },
      ],
      C.red, y5
    );

    y5 = renderCompTable(
      "Top Volume Increase — PE", analysis.top10PEVolInc.filter(r => r.peVolDiff > 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "Vol Δ",     key: "peVolDiff", width: diffW, isColor: true },
        { header: "Vol Δ%",    key: "peVolPct",  width: pctW,  isColor: true },
        { header: "OI Δ",      key: "peOIDiff",  width: diffW, isColor: true },
      ],
      C.green, y5
    );

    y5 = renderCompTable(
      "Premium Expansion — CE", analysis.top10CEPremInc.filter(r => r.ceLTPDiff > 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "LTP Δ",     key: "ceLTPDiff", width: diffW, isColor: true },
        { header: "LTP Δ%",    key: "ceLTPPct",  width: pctW,  isColor: true },
        { header: "OI Δ",      key: "ceOIDiff",  width: diffW, isColor: true },
      ],
      C.accentB, y5
    );

    y5 = renderCompTable(
      "Premium Decay — PE", analysis.top10PEPremDec.filter(r => r.peLTPDiff < 0),
      [
        { header: "Strike",    key: "strike",    width: strikeW },
        { header: "LTP Δ",     key: "peLTPDiff", width: diffW, isColor: true },
        { header: "LTP Δ%",    key: "peLTPPct",  width: pctW,  isColor: true },
        { header: "OI Δ",      key: "peOIDiff",  width: diffW, isColor: true },
      ],
      C.pink, y5
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 6 — AI TRADE BOOK & STRATEGY
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(6);

    let y6 = 20;
    y6 = sectionHeader(y6, "AI Trade Book", C.amber);

    const tradeRows = [
      ["Market Bias",    bias,                                                            biasColor(bias)],
      ["Confidence",     biasConf,                                                        C.amber],
      ["Support",        fmt(expZoneLow),                                                 C.green],
      ["Resistance",     fmt(expZoneHigh),                                                C.red],
      ["Entry Zone",     `${fmt(expZoneLow)} – ${fmt(expZoneHigh)}`,                      C.white],
      ["Stop Loss",      fmt(bias==="Bullish" ? expZoneLow-50 : expZoneHigh+50),          C.red],
      ["Target 1",       fmt(bias==="Bullish" ? expZoneHigh-50 : expZoneLow+50),          C.green],
      ["Target 2",       fmt(bias==="Bullish" ? expZoneHigh+100 : expZoneLow-100),        C.green],
      ["Risk : Reward",  strategy.rr,                                                     C.cyan],
      ["Probability",    strategy.expectedProb,                                            C.cyan],
    ] as [string, string, [number,number,number]][];

    tradeRows.forEach(([label, value, color], i) => {
      const ry = y6 + i * 10;
      rect(ML, ry, CW, 10, i % 2 === 0 ? C.panelAlt : C.panel);
      txt(label, ML + 4, ry + 7, 8.5, C.muted);
      txt(value, MR, ry + 7, 9, color, "right", "bold");
    });
    strokeRect(ML, y6, CW, tradeRows.length * 10, C.border, 0.3);
    y6 += tradeRows.length * 10 + 8;

    y6 = sectionHeader(y6, "Recommended Strategy", C.accent);

    rect(ML, y6, CW, 14, C.panelAlt, 3);
    strokeRect(ML, y6, CW, 14, C.accent, 0.5, 3);
    txt(strategy.name.toUpperCase(), PW / 2, y6 + 6, 11, C.accent, "center", "bold");
    txt(bias.toUpperCase() + " STRATEGY", PW / 2, y6 + 12, 7.5, C.muted, "center", "normal");
    y6 += 18;

    const stratRows: [string, string][] = [
      ["Why Selected",   strategy.why],
      ["Entry",          strategy.entry],
      ["Exit",           strategy.exit],
      ["Adjustment",     strategy.adjustment],
      ["Max Risk",       strategy.maxRisk],
      ["Risk : Reward",  strategy.rr],
      ["Probability",    strategy.expectedProb],
    ];

    stratRows.forEach(([label, value], i) => {
      if (y6 > 260) { doc.addPage(); fillPage(); addPageChrome(6); y6 = 20; }
      const lineH = 9 + Math.ceil(doc.splitTextToSize(value, CW - 60).length - 1) * 4;
      rect(ML, y6, CW, lineH, i % 2 === 0 ? C.panel : C.panelAlt);
      txt(label, ML + 4, y6 + 6.5, 8, C.muted, "left", "bold");
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.white);
      const lines = doc.splitTextToSize(value, CW - 60);
      doc.text(lines, MR, y6 + 6.5, { align: "right" });
      y6 += lineH;
    });
    strokeRect(ML, y6 - stratRows.reduce((a, [, v]) => a + 9 + Math.ceil(doc.splitTextToSize(v, CW - 60).length - 1) * 4, 0), CW, stratRows.reduce((a, [, v]) => a + 9 + Math.ceil(doc.splitTextToSize(v, CW - 60).length - 1) * 4, 0), C.border, 0.3);

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 7 — INSTITUTIONAL COMMENTARY
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(7);

    let y7 = 20;
    y7 = sectionHeader(y7, "Institutional Research Commentary", C.accent);

    // Commentary card
    rect(ML, y7, CW, 12, C.panelAlt, 3);
    txt("ANALYST NOTE", ML + 5, y7 + 5, 7, C.muted, "left", "normal");
    txt(`${displayUnderlying} | ${displayExpiry} | ${prevFile.time} → ${currFile.time}`, ML + 5, y7 + 10, 7.5, C.accent, "left", "bold");
    y7 += 15;

    // Main conclusion paragraph — wrap properly
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.white);
    const conclusionLines = doc.splitTextToSize(conclusion, CW);
    let paraY = y7;
    conclusionLines.forEach((ln: string, i: number) => {
      if (paraY > 265) { doc.addPage(); fillPage(); addPageChrome(7); paraY = 20; }
      doc.text(ln, ML, paraY);
      paraY += 4.5;
    });
    y7 = paraY + 5;

    // Key findings bullets
    if (y7 > 240) { doc.addPage(); fillPage(); addPageChrome(7); y7 = 20; }
    y7 = sectionHeader(y7, "Key Findings", C.cyan);

    const bullets = [
      `Support Zone: ${fmt(expZoneLow)} (Max PE OI at ${fmt(currMaxPE?.strike || 0)})`,
      `Resistance Zone: ${fmt(expZoneHigh)} (Max CE OI at ${fmt(currMaxCE?.strike || 0)})`,
      `PCR moved from ${prevFile.pcr.toFixed(2)} to ${currFile.pcr.toFixed(2)} — Trend: ${pcrTrend}`,
      `ATM shifted from ${prevFile.atm} to ${currFile.atm} (${atmShift >= 0 ? "+" : ""}${atmShift} pts)`,
      `Total CE OI change: ${fmtDiff(totalCEOIDiff)} | Total PE OI change: ${fmtDiff(totalPEOIDiff)}`,
      `Dominant activity: ${freshCEWrite.length > 0 ? `Fresh Call Writing at ${fmt(freshCEWrite[0].strike)}` : freshPEWrite.length > 0 ? `Fresh Put Writing at ${fmt(freshPEWrite[0].strike)}` : "Mixed institutional flow"}`,
      `Strategy recommended: ${strategy.name} | R:R ${strategy.rr} | Probability: ${strategy.expectedProb}`,
    ];

    bullets.forEach((b, i) => {
      if (y7 > 265) { doc.addPage(); fillPage(); addPageChrome(7); y7 = 20; }
      rect(ML, y7, CW, 9, i % 2 === 0 ? C.panelAlt : C.panel);
      txt("▸", ML + 3, y7 + 6.5, 8, C.accent, "left", "bold");
      txt(b, ML + 10, y7 + 6.5, 8, C.white, "left", "normal", CW - 12);
      y7 += 9;
    });
    strokeRect(ML, y7 - bullets.length * 9, CW, bullets.length * 9, C.border, 0.3);

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 8 — RISK DISCLOSURE
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    fillPage();
    addPageChrome(8);

    let y8 = 20;
    y8 = sectionHeader(y8, "Risk Disclosure", C.red);

    const disclosures = [
      "This report is generated using uploaded NSE Option Chain CSV data provided by the user.",
      "All analysis, classifications, and interpretations are based on publicly available options data.",
      "The report provides statistical and analytical probabilities only.",
      "This document does NOT constitute investment advice, financial advice, or a recommendation to buy or sell any security.",
      "Options trading involves substantial risk of loss and is not appropriate for all investors.",
      "Past performance of any strategy or analytical method does not guarantee future results.",
      "The Intraday Comparison Studio is a decision-support tool, not an execution engine.",
      "Always consult a SEBI-registered investment advisor before making any trading decisions.",
      "The underlying data quality depends entirely on the accuracy of the uploaded CSV files.",
      "Spot price estimates are approximated from option premiums and may differ from actual market prices.",
      "PCR and OI calculations are based on the snapshot data provided — intraday gaps are not accounted for.",
    ];

    disclosures.forEach((d, i) => {
      if (y8 > 260) { doc.addPage(); fillPage(); addPageChrome(8); y8 = 20; }
      rect(ML, y8, CW, 11, i % 2 === 0 ? C.panelAlt : C.panel);
      txt(`${i + 1}.`, ML + 3, y8 + 7.5, 8, C.red, "left", "bold");
      const lines = doc.splitTextToSize(d, CW - 18);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
      doc.text(lines, ML + 12, y8 + 7.5 - (lines.length - 1) * 2);
      y8 += 11;
    });
    strokeRect(ML, y8 - disclosures.length * 11, CW, disclosures.length * 11, C.border, 0.3);

    y8 += 8;
    rect(ML, y8, CW, 20, [20, 10, 10], 3);
    strokeRect(ML, y8, CW, 20, C.red, 0.5, 3);
    txt("⚠  FOR ANALYTICAL PURPOSES ONLY — NOT INVESTMENT ADVICE", PW / 2, y8 + 8, 8, C.red, "center", "bold");
    txt("Institutional Derivatives Analytics · Intraday Comparison Studio", PW / 2, y8 + 15, 7, [80, 60, 60], "center", "normal");

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE
    // ─────────────────────────────────────────────────────────────────────────

    const safeUnderlying = displayUnderlying.replace(/[^a-zA-Z0-9]/g, "");
    const safeExpiry = (displayExpiry || "UNKNOWN").replace(/[^a-zA-Z0-9\-]/g, "");
    doc.save(`${safeUnderlying}_${safeExpiry}_Intraday_Comparison_Report.pdf`);
  }, [analysis, prevFile, currFile]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="glass-panel p-8 mb-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)"
        }} />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Activity size={22} className="text-purple-400" />
            </div>
            <h2 className="text-3xl font-extrabold gradient-text">Intraday Comparison Studio</h2>
          </div>
          <p className="text-[var(--text-secondary)] text-sm max-w-lg mx-auto">
            Upload two Option Chain CSVs from the same underlying &amp; expiry to generate a complete institutional intraday analysis.
          </p>
        </div>
      </div>

      {/* ── Upload Panel ────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <FileUploader
            label="Previous Dataset"
            sublabel="Upload earlier snapshot (e.g. 09:15 CSV)"
            file={prevFile}
            onFile={f => { setPrevFile(f); setAnalyzed(false); setValidationError(null); }}
            color="#3b82f6"
          />
          <div className="hidden md:flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <ArrowRight size={18} className="text-[var(--text-secondary)]" />
            </div>
          </div>
          <FileUploader
            label="Current Dataset"
            sublabel="Upload later snapshot (e.g. 10:00 CSV)"
            file={currFile}
            onFile={f => { setCurrFile(f); setAnalyzed(false); setValidationError(null); }}
            color="#8b5cf6"
          />
        </div>

        {validationError && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm font-medium">{validationError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={validate}
            disabled={!prevFile || !currFile}
            className="btn-primary flex items-center gap-2 px-8 py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={16} /> Analyze Intraday Changes
          </button>
          {analyzed && (
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
            >
              <Download size={16} /> Export PDF
            </button>
          )}
          {(prevFile || currFile) && (
            <button
              onClick={() => { setPrevFile(null); setCurrFile(null); setAnalyzed(false); setValidationError(null); }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-[var(--text-secondary)] hover:text-white border border-white/10 hover:bg-white/5 transition-all"
            >
              <RefreshCw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Report ──────────────────────────────────────────────────────── */}
      {analyzed && analysis && prevFile && currFile && (
        <div id="ics-report" ref={reportRef}>

          {/* SECTION 1: Executive Summary */}
          <SectionCard title="1 · Executive Summary" icon={FileText} color="#8b5cf6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard label="Previous Time" value={prevFile.time} color="#3b82f6" />
              <StatCard label="Current Time" value={currFile.time} color="#8b5cf6" />
              <StatCard label="Underlying" value={currFile.underlying} color="white" />
              <StatCard label="Expiry" value={currFile.expiry} color="#f59e0b" />
              <StatCard label="Spot Change" value={<DiffCell val={analysis.spotDiff} />} color="white" />
              <StatCard label="ATM Shift" value={<DiffCell val={analysis.atmShift} />} sub={`${prevFile.atm} → ${currFile.atm}`} />
              <StatCard label="CE OI Δ" value={<DiffCell val={analysis.totalCEOIDiff} />} color="white" />
              <StatCard label="PE OI Δ" value={<DiffCell val={analysis.totalPEOIDiff} />} color="white" />
              <StatCard label="PCR Previous" value={prevFile.pcr.toFixed(2)} color="#94a3b8" />
              <StatCard label="PCR Current" value={currFile.pcr.toFixed(2)} color="#f8fafc" />
              <StatCard label="PCR Change" value={<DiffCell val={analysis.pcrChange} />} color="white" />
              <StatCard label="Market Bias" value={<Badge label={analysis.bias} type={analysis.bias === "Bullish" ? "bullish" : analysis.bias === "Bearish" ? "bearish" : "neutral"} />} />
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-2 flex items-center gap-3 border border-white/10">
              <span className="text-xs text-[var(--text-secondary)]">Confidence</span>
              <ConfBadge label={analysis.biasConf} />
              <span className="text-xs text-[var(--text-secondary)] ml-4">Bias Shift</span>
              <Badge label={analysis.bias === "Bullish" ? "Bullish Tilt" : analysis.bias === "Bearish" ? "Bearish Tilt" : "Range-Bound"} type={analysis.bias === "Bullish" ? "bullish" : analysis.bias === "Bearish" ? "bearish" : "neutral"} />
            </div>
          </SectionCard>

          {/* SECTION 2: PCR Analysis */}
          <SectionCard title="2 · PCR Analysis" icon={PieChart} color="#3b82f6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard label="Previous PCR" value={prevFile.pcr.toFixed(2)} color="#94a3b8" />
              <StatCard label="Current PCR" value={currFile.pcr.toFixed(2)} color="#f8fafc" />
              <StatCard label="Difference" value={<DiffCell val={analysis.pcrChange} />} />
              <StatCard label="PCR Trend" value={<Badge label={analysis.pcrTrend} type={analysis.pcrTrend === "Improving" ? "bullish" : analysis.pcrTrend === "Weakening" ? "bearish" : "neutral"} />} />
            </div>
            <div className="bg-[#161925]/70 rounded-xl p-4 border border-white/5 text-sm">
              <p className="text-[var(--text-secondary)] mb-2 font-semibold uppercase text-xs tracking-wider">Institutional Interpretation</p>
              <p className="text-white leading-relaxed">
                {currFile.pcr > 1.5
                  ? "PCR above 1.5 indicates extreme bullish sentiment — institutions are heavily writing puts, signalling strong support."
                  : currFile.pcr > 1.1
                  ? "PCR above 1.1 is bullish — put writers outnumber call writers, suggesting institutions expect market to hold or rise."
                  : currFile.pcr < 0.7
                  ? "PCR below 0.7 is bearish — call writers are dominant, suggesting institutions expect market to fall or stay capped."
                  : "PCR between 0.7–1.1 indicates a neutral/range-bound setup — balanced institutional positioning."}
                {" "}The PCR has {analysis.pcrTrend === "Improving" ? "improved, reinforcing bullish momentum." : analysis.pcrTrend === "Weakening" ? "weakened, indicating bearish pressure mounting." : "remained stable, confirming range-bound conditions."}
              </p>
            </div>
          </SectionCard>

          {/* SECTION 3: Spot Movement */}
          <SectionCard title="3 · Spot Movement" icon={TrendingUp} color="#10b981">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Previous Spot" value={`~${prevFile.spot.toFixed(0)}`} color="#94a3b8" />
              <StatCard label="Current Spot" value={`~${currFile.spot.toFixed(0)}`} color="#f8fafc" />
              <StatCard label="Difference" value={<DiffCell val={analysis.spotDiff} />} />
              <StatCard label="ATM Migration" value={`${prevFile.atm} → ${currFile.atm}`} color="#f59e0b" />
              <StatCard label="Expected Zone" value={`${fmt(analysis.expZoneLow)} – ${fmt(analysis.expZoneHigh)}`} color="#8b5cf6" />
            </div>
          </SectionCard>

          {/* SECTION 4: Top 10 Volume Changes */}
          <SectionCard title="4 · Top 10 Volume Increase / Decrease" icon={BarChart2} color="#f59e0b">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CE Volume Increase */}
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">CE — Volume Increase</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                      <th className="p-2 text-left">Strike</th>
                      <th className="p-2 text-right">Prev Vol</th>
                      <th className="p-2 text-right">Curr Vol</th>
                      <th className="p-2 text-right">Diff</th>
                      <th className="p-2 text-right">%</th>
                    </tr></thead>
                    <tbody>{analysis.top10CEVolInc.filter(r => r.ceVolDiff > 0).map(r => (
                      <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                        <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev.callVol)}</td>
                        <td className="p-2 text-right text-red-300">{fmt(r.curr.callVol)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.ceVolDiff} /></td>
                        <td className="p-2 text-right text-red-400">{fmtPct(r.ceVolPct)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              {/* PE Volume Increase */}
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">PE — Volume Increase</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                      <th className="p-2 text-left">Strike</th>
                      <th className="p-2 text-right">Prev Vol</th>
                      <th className="p-2 text-right">Curr Vol</th>
                      <th className="p-2 text-right">Diff</th>
                      <th className="p-2 text-right">%</th>
                    </tr></thead>
                    <tbody>{analysis.top10PEVolInc.filter(r => r.peVolDiff > 0).map(r => (
                      <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                        <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev.putVol)}</td>
                        <td className="p-2 text-right text-emerald-300">{fmt(r.curr.putVol)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.peVolDiff} /></td>
                        <td className="p-2 text-right text-emerald-400">{fmtPct(r.peVolPct)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              {/* CE Volume Decrease */}
              <div>
                <p className="text-xs font-bold text-red-400/60 uppercase tracking-wider mb-3">CE — Volume Decrease</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                      <th className="p-2 text-left">Strike</th>
                      <th className="p-2 text-right">Prev Vol</th>
                      <th className="p-2 text-right">Curr Vol</th>
                      <th className="p-2 text-right">Diff</th>
                      <th className="p-2 text-right">%</th>
                    </tr></thead>
                    <tbody>{analysis.top10CEVolDec.filter(r => r.ceVolDiff < 0).map(r => (
                      <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                        <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev.callVol)}</td>
                        <td className="p-2 text-right text-red-300/60">{fmt(r.curr.callVol)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.ceVolDiff} /></td>
                        <td className="p-2 text-right text-red-400/60">{fmtPct(r.ceVolPct)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              {/* PE Volume Decrease */}
              <div>
                <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-wider mb-3">PE — Volume Decrease</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                      <th className="p-2 text-left">Strike</th>
                      <th className="p-2 text-right">Prev Vol</th>
                      <th className="p-2 text-right">Curr Vol</th>
                      <th className="p-2 text-right">Diff</th>
                      <th className="p-2 text-right">%</th>
                    </tr></thead>
                    <tbody>{analysis.top10PEVolDec.filter(r => r.peVolDiff < 0).map(r => (
                      <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                        <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev.putVol)}</td>
                        <td className="p-2 text-right text-emerald-300/60">{fmt(r.curr.putVol)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.peVolDiff} /></td>
                        <td className="p-2 text-right text-emerald-400/60">{fmtPct(r.peVolPct)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 5: Top 10 OI Increase */}
          <SectionCard title="5 · Top 10 OI Increase" icon={TrendingUp} color="#10b981">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { label: "CE — OI Increase", color: "text-red-400", data: analysis.top10CEOIInc, oiKey: "ceOIDiff" as const, oiPct: "ceOIPct" as const, prev: "callOI" as const, curr2: "callOI" as const, cls: "ceClass" as const, conf: "ceConfidence" as const },
                { label: "PE — OI Increase", color: "text-emerald-400", data: analysis.top10PEOIInc, oiKey: "peOIDiff" as const, oiPct: "peOIPct" as const, prev: "putOI" as const, curr2: "putOI" as const, cls: "peClass" as const, conf: "peConfidence" as const },
              ].map(({ label, color, data, oiKey, oiPct, prev, curr2, cls, conf }) => (
                <div key={label}>
                  <p className={`text-xs font-bold ${color} uppercase tracking-wider mb-3`}>{label}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                        <th className="p-2 text-left">Strike</th>
                        <th className="p-2 text-right">Prev OI</th>
                        <th className="p-2 text-right">Curr OI</th>
                        <th className="p-2 text-right">Diff</th>
                        <th className="p-2 text-left">Classification</th>
                        <th className="p-2 text-center">Conf</th>
                      </tr></thead>
                      <tbody>{data.filter(r => (r[oiKey] as number) > 0).map(r => (
                        <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                          <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                          <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev[prev])}</td>
                          <td className="p-2 text-right text-white">{fmt(r.curr[curr2])}</td>
                          <td className="p-2 text-right"><DiffCell val={r[oiKey] as number} pct={r[oiPct] as number} /></td>
                          <td className="p-2"><ClassBadge label={r[cls] as string} /></td>
                          <td className="p-2 text-center"><ConfBadge label={r[conf] as string} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 6: Top 10 OI Decrease */}
          <SectionCard title="6 · Top 10 OI Decrease" icon={TrendingDown} color="#ef4444">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { label: "CE — OI Decrease", color: "text-red-400/70", data: analysis.top10CEOIDec, oiKey: "ceOIDiff" as const, oiPct: "ceOIPct" as const, prev: "callOI" as const, curr2: "callOI" as const, cls: "ceClass" as const },
                { label: "PE — OI Decrease", color: "text-emerald-400/70", data: analysis.top10PEOIDec, oiKey: "peOIDiff" as const, oiPct: "peOIPct" as const, prev: "putOI" as const, curr2: "putOI" as const, cls: "peClass" as const },
              ].map(({ label, color, data, oiKey, oiPct, prev, curr2, cls }) => (
                <div key={label}>
                  <p className={`text-xs font-bold ${color} uppercase tracking-wider mb-3`}>{label}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                        <th className="p-2 text-left">Strike</th>
                        <th className="p-2 text-right">Prev OI</th>
                        <th className="p-2 text-right">Curr OI</th>
                        <th className="p-2 text-right">Diff</th>
                        <th className="p-2 text-left">Interpretation</th>
                      </tr></thead>
                      <tbody>{data.filter(r => (r[oiKey] as number) < 0).map(r => (
                        <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                          <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                          <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(r.prev[prev])}</td>
                          <td className="p-2 text-right text-white">{fmt(r.curr[curr2])}</td>
                          <td className="p-2 text-right"><DiffCell val={r[oiKey] as number} pct={r[oiPct] as number} /></td>
                          <td className="p-2"><ClassBadge label={r[cls] as string} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 7: Premium Change Analysis */}
          <SectionCard title="7 · Premium Change Analysis" icon={Activity} color="#f59e0b">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { label: "CE — Premium Expansion", color: "text-red-400", data: analysis.top10CEPremInc, ltpKey: "ceLTPDiff" as const, ltpPct: "ceLTPPct" as const, prevLTP: "callLTP" as const, note: "Expansion" },
                { label: "PE — Premium Expansion", color: "text-emerald-400", data: analysis.top10PEPremInc, ltpKey: "peLTPDiff" as const, ltpPct: "peLTPPct" as const, prevLTP: "putLTP" as const, note: "Expansion" },
                { label: "CE — Premium Decay", color: "text-red-400/60", data: analysis.top10CEPremDec, ltpKey: "ceLTPDiff" as const, ltpPct: "ceLTPPct" as const, prevLTP: "callLTP" as const, note: "Decay" },
                { label: "PE — Premium Decay", color: "text-emerald-400/60", data: analysis.top10PEPremDec, ltpKey: "peLTPDiff" as const, ltpPct: "peLTPPct" as const, prevLTP: "putLTP" as const, note: "Decay" },
              ].map(({ label, color, data, ltpKey, ltpPct, prevLTP, note }) => (
                <div key={label}>
                  <p className={`text-xs font-bold ${color} uppercase tracking-wider mb-3`}>{label}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/10 text-[var(--text-secondary)]">
                        <th className="p-2 text-left">Strike</th>
                        <th className="p-2 text-right">Prev LTP</th>
                        <th className="p-2 text-right">Curr LTP</th>
                        <th className="p-2 text-right">Diff</th>
                        <th className="p-2 text-right">%</th>
                        <th className="p-2 text-center">Type</th>
                      </tr></thead>
                      <tbody>{data.filter(r => note === "Expansion" ? (r[ltpKey] as number) > 0 : (r[ltpKey] as number) < 0).map(r => (
                        <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3">
                          <td className="p-2 font-bold text-white">{fmt(r.strike)}</td>
                          <td className="p-2 text-right text-[var(--text-secondary)]">{r.prev[prevLTP].toFixed(2)}</td>
                          <td className="p-2 text-right text-white">{r.curr[prevLTP].toFixed(2)}</td>
                          <td className="p-2 text-right"><DiffCell val={r[ltpKey] as number} /></td>
                          <td className="p-2 text-right">{fmtPct(r[ltpPct] as number)}</td>
                          <td className="p-2 text-center">
                            <Badge label={note} type={note === "Expansion" ? "bullish" : "bearish"} />
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 8: Strike Behaviour Matrix */}
          <SectionCard title="8 · Strike Behaviour Matrix" icon={Layers} color="#6366f1">
            <button
              onClick={() => toggleSection(8)}
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors mb-4 bg-white/5 px-4 py-2 rounded-lg border border-white/10"
            >
              {expandedSection === 8 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expandedSection === 8 ? "Collapse Matrix" : "Expand Full Matrix"} ({analysis.diffRows.length} strikes)
            </button>
            {expandedSection === 8 && (
              <div className="overflow-x-auto custom-scrollbar bg-[#0f111a]/50 rounded-xl border border-white/5">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-[#161925] border-b border-white/10">
                    <tr>
                      <th className="p-2 text-left text-[var(--text-secondary)] sticky left-0 bg-[#161925]">Strike</th>
                      <th className="p-2 text-center text-red-400" colSpan={5}>CALL</th>
                      <th className="p-2 text-center text-emerald-400" colSpan={5}>PUT</th>
                    </tr>
                    <tr className="border-t border-white/5">
                      <th className="p-2 sticky left-0 bg-[#161925]"></th>
                      <th className="p-2 text-[var(--text-secondary)]">Prev OI</th>
                      <th className="p-2 text-[var(--text-secondary)]">Curr OI</th>
                      <th className="p-2 text-[var(--text-secondary)]">OI Δ</th>
                      <th className="p-2 text-[var(--text-secondary)]">Vol Δ</th>
                      <th className="p-2 text-[var(--text-secondary)]">Classification</th>
                      <th className="p-2 text-[var(--text-secondary)]">Prev OI</th>
                      <th className="p-2 text-[var(--text-secondary)]">Curr OI</th>
                      <th className="p-2 text-[var(--text-secondary)]">OI Δ</th>
                      <th className="p-2 text-[var(--text-secondary)]">Vol Δ</th>
                      <th className="p-2 text-[var(--text-secondary)]">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.diffRows.map(r => (
                      <tr key={r.strike} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="p-2 font-bold text-white sticky left-0 bg-[#0f111a] border-r border-white/5">{fmt(r.strike)}</td>
                        <td className="p-2 text-right text-red-400/50">{fmt(r.prev.callOI)}</td>
                        <td className="p-2 text-right text-red-300">{fmt(r.curr.callOI)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.ceOIDiff} /></td>
                        <td className="p-2 text-right"><DiffCell val={r.ceVolDiff} /></td>
                        <td className="p-2"><ClassBadge label={r.ceClass} /></td>
                        <td className="p-2 text-right text-emerald-400/50">{fmt(r.prev.putOI)}</td>
                        <td className="p-2 text-right text-emerald-300">{fmt(r.curr.putOI)}</td>
                        <td className="p-2 text-right"><DiffCell val={r.peOIDiff} /></td>
                        <td className="p-2 text-right"><DiffCell val={r.peVolDiff} /></td>
                        <td className="p-2"><ClassBadge label={r.peClass} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {expandedSection !== 8 && (
              <p className="text-sm text-[var(--text-secondary)]">Click "Expand Full Matrix" to view all {analysis.diffRows.length} strike rows with CE and PE classification.</p>
            )}
          </SectionCard>

          {/* SECTION 9: Top Institutional Activity */}
          <SectionCard title="9 · Top Institutional Activity" icon={BrainCircuit} color="#ec4899">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: "🔴 Fresh Call Writing", data: analysis.freshCEWrite, oiKey: "ceOIDiff" as const, color: "#ef4444" },
                { title: "🟢 Fresh Put Writing", data: analysis.freshPEWrite, oiKey: "peOIDiff" as const, color: "#10b981" },
                { title: "📈 Call Buying (Long Build-up)", data: analysis.callBuying, oiKey: "ceOIDiff" as const, color: "#3b82f6" },
                { title: "📉 Put Buying (Short Build-up)", data: analysis.putBuying, oiKey: "peOIDiff" as const, color: "#f59e0b" },
                { title: "⬇️ Long Unwinding", data: analysis.longUnwind, oiKey: "ceOIDiff" as const, color: "#8b5cf6" },
                { title: "⬆️ Short Covering", data: analysis.shortCover, oiKey: "ceOIDiff" as const, color: "#06b6d4" },
              ].map(({ title, data, oiKey, color }) => (
                <div key={title} className="bg-[#161925]/70 rounded-xl p-4 border border-white/5">
                  <p className="text-xs font-bold mb-3" style={{ color }}>{title}</p>
                  {data.length === 0
                    ? <p className="text-xs text-[var(--text-secondary)]">No activity detected</p>
                    : data.map((r, i) => (
                      <div key={r.strike} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-secondary)] w-4">#{i + 1}</span>
                          <span className="font-bold text-white text-sm">{fmt(r.strike)}</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color }}>{fmtDiff(r[oiKey] as number)}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 10: Smart Money Shift */}
          <SectionCard title="10 · Smart Money Shift" icon={ArrowRight} color="#06b6d4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">CE — Call OI Migration (Resistance Shift)</p>
                <div className="space-y-2">
                  {analysis.ceShift.slice(0, 5).map((r, i) => (
                    <div key={r.strike} className="flex items-center gap-3 bg-[#161925]/50 rounded-lg px-4 py-3 border border-white/5">
                      <span className="text-xs text-[var(--text-secondary)] w-5">#{i + 1}</span>
                      <span className="font-bold text-white">{fmt(r.strike)} CE</span>
                      <ArrowRight size={14} className="text-red-400 shrink-0" />
                      <span className="text-xs text-[var(--text-secondary)] flex-1">{r.ceClass}</span>
                      <DiffCell val={r.ceOIDiff} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">PE — Put OI Migration (Support Shift)</p>
                <div className="space-y-2">
                  {analysis.peShift.slice(0, 5).map((r, i) => (
                    <div key={r.strike} className="flex items-center gap-3 bg-[#161925]/50 rounded-lg px-4 py-3 border border-white/5">
                      <span className="text-xs text-[var(--text-secondary)] w-5">#{i + 1}</span>
                      <span className="font-bold text-white">{fmt(r.strike)} PE</span>
                      <ArrowRight size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-xs text-[var(--text-secondary)] flex-1">{r.peClass}</span>
                      <DiffCell val={r.peOIDiff} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 11: Heatmaps */}
          <SectionCard title="11 · Heatmaps" icon={BarChart} color="#f59e0b">
            {(() => {
              // ── Data definitions (IDENTICAL to previous — zero logic change) ──
              const cards: HeatmapCardDef[] = [
                {
                  title: "Largest Volume Addition (CE)",
                  accentColor: "#ef4444",
                  badgeLabel: "CE VOL +",
                  data: analysis.top10CEVolInc.slice(0, 10).filter(r => r.ceVolDiff > 0),
                  valKey: "ceVolDiff",
                  max: Math.max(...analysis.top10CEVolInc.map(r => Math.abs(r.ceVolDiff)), 1),
                },
                {
                  title: "Largest Volume Addition (PE)",
                  accentColor: "#10b981",
                  badgeLabel: "PE VOL +",
                  data: analysis.top10PEVolInc.slice(0, 10).filter(r => r.peVolDiff > 0),
                  valKey: "peVolDiff",
                  max: Math.max(...analysis.top10PEVolInc.map(r => Math.abs(r.peVolDiff)), 1),
                },
                {
                  title: "Largest OI Addition (CE)",
                  accentColor: "#f97316",
                  badgeLabel: "CE OI +",
                  data: analysis.top10CEOIInc.slice(0, 10).filter(r => r.ceOIDiff > 0),
                  valKey: "ceOIDiff",
                  max: Math.max(...analysis.top10CEOIInc.map(r => Math.abs(r.ceOIDiff)), 1),
                },
                {
                  title: "Largest OI Addition (PE)",
                  accentColor: "#06b6d4",
                  badgeLabel: "PE OI +",
                  data: analysis.top10PEOIInc.slice(0, 10).filter(r => r.peOIDiff > 0),
                  valKey: "peOIDiff",
                  max: Math.max(...analysis.top10PEOIInc.map(r => Math.abs(r.peOIDiff)), 1),
                },
                {
                  title: "Largest OI Exit (CE)",
                  accentColor: "#8b5cf6",
                  badgeLabel: "CE OI −",
                  data: analysis.top10CEOIDec.slice(0, 10).filter(r => r.ceOIDiff < 0),
                  valKey: "ceOIDiff",
                  max: Math.max(...analysis.top10CEOIDec.map(r => Math.abs(r.ceOIDiff)), 1),
                },
                {
                  title: "Largest OI Exit (PE)",
                  accentColor: "#a855f7",
                  badgeLabel: "PE OI −",
                  data: analysis.top10PEOIDec.slice(0, 10).filter(r => r.peOIDiff < 0),
                  valKey: "peOIDiff",
                  max: Math.max(...analysis.top10PEOIDec.map(r => Math.abs(r.peOIDiff)), 1),
                },
                {
                  title: "Largest Premium Expansion",
                  accentColor: "#3b82f6",
                  badgeLabel: "LTP +",
                  data: analysis.top10CEPremInc.slice(0, 10).filter(r => r.ceLTPDiff > 0),
                  valKey: "ceLTPDiff",
                  max: Math.max(...analysis.top10CEPremInc.map(r => Math.abs(r.ceLTPDiff)), 1),
                },
                {
                  title: "Largest Premium Decay",
                  accentColor: "#ec4899",
                  badgeLabel: "LTP −",
                  data: analysis.top10PEPremDec.slice(0, 10).filter(r => r.peLTPDiff < 0),
                  valKey: "peLTPDiff",
                  max: Math.max(...analysis.top10PEPremDec.map(r => Math.abs(r.peLTPDiff)), 1),
                },
              ];

              // ── Summary footer data (top-1 per category) ──
              const volAddCE  = analysis.top10CEVolInc.find(r => r.ceVolDiff > 0);
              const oiAddCE   = analysis.top10CEOIInc.find(r => r.ceOIDiff > 0);
              const oiAddPE   = analysis.top10PEOIInc.find(r => r.peOIDiff > 0);
              const premExp   = analysis.top10CEPremInc.find(r => r.ceLTPDiff > 0);
              const premDecay = analysis.top10PEPremDec.find(r => r.peLTPDiff < 0);
              const exitCE    = analysis.top10CEOIDec.find(r => r.ceOIDiff < 0);

              const summaryItems = [
                { label: "Largest Vol Added",     value: volAddCE  ? fmt(volAddCE.strike)  : "—", color: "#ef4444" },
                { label: "Largest OI Added (CE)", value: oiAddCE   ? fmt(oiAddCE.strike)   : "—", color: "#f97316" },
                { label: "Largest OI Added (PE)", value: oiAddPE   ? fmt(oiAddPE.strike)   : "—", color: "#06b6d4" },
                { label: "Premium Expansion",     value: premExp   ? fmt(premExp.strike)   : "—", color: "#3b82f6" },
                { label: "Premium Decay",         value: premDecay ? fmt(premDecay.strike) : "—", color: "#ec4899" },
                { label: "Largest Exit",           value: exitCE    ? fmt(exitCE.strike)    : "—", color: "#8b5cf6" },
              ];

              return (
                <>
                  {/* ── Full-width responsive card grid ── */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                    width: "100%",
                  }}>
                    {cards.map(c => <HeatmapCard key={c.title} {...c} />)}
                  </div>

                  {/* ── Summary Footer ── */}
                  <div style={{
                    marginTop: "20px",
                    background: "linear-gradient(135deg, rgba(15,17,26,0.9), rgba(22,25,37,0.8))",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "16px 20px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0",
                  }}>
                    <p style={{ width: "100%", fontSize: "10px", fontWeight: 700, color: "rgba(148,163,184,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
                      ⚡ Institutional Snapshot — Top Strikes
                    </p>
                    {summaryItems.map((s, i) => (
                      <div key={s.label} style={{
                        flex: "1 1 130px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRight: i < summaryItems.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      }}>
                        <p style={{ fontSize: "9px", fontWeight: 600, color: "rgba(148,163,184,0.55)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "5px", textAlign: "center" }}>{s.label}</p>
                        <p style={{ fontSize: "20px", fontWeight: 800, color: s.color, letterSpacing: "-0.01em", lineHeight: 1 }}>{s.value}</p>
                        <div style={{ width: "18px", height: "2px", background: s.color, borderRadius: "2px", marginTop: "5px", opacity: 0.5 }} />
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </SectionCard>

          {/* SECTION 12: Support / Resistance Migration */}
          <SectionCard title="12 · Support / Resistance Migration" icon={Shield} color="#10b981">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#161925]/70 rounded-xl p-5 border border-emerald-500/20">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4">Support (Max PE OI)</p>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Previous</p>
                    <p className="text-2xl font-bold text-emerald-300">{fmt(analysis.prevMaxPE?.strike || 0)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{fmt(analysis.prevMaxPE?.putOI || 0)} OI</p>
                  </div>
                  <ArrowRight size={20} className="text-emerald-500 shrink-0" />
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Current</p>
                    <p className="text-2xl font-bold text-emerald-400">{fmt(analysis.currMaxPE?.strike || 0)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{fmt(analysis.currMaxPE?.putOI || 0)} OI</p>
                  </div>
                </div>
                {analysis.prevMaxPE?.strike !== analysis.currMaxPE?.strike
                  ? <p className="text-sm text-emerald-400 font-semibold">
                    Support shifted {(analysis.currMaxPE?.strike || 0) > (analysis.prevMaxPE?.strike || 0) ? "higher ↑" : "lower ↓"} by {Math.abs((analysis.currMaxPE?.strike || 0) - (analysis.prevMaxPE?.strike || 0))} points
                  </p>
                  : <p className="text-sm text-[var(--text-secondary)]">Support unchanged at {fmt(analysis.currMaxPE?.strike || 0)}</p>}
              </div>
              <div className="bg-[#161925]/70 rounded-xl p-5 border border-red-500/20">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4">Resistance (Max CE OI)</p>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Previous</p>
                    <p className="text-2xl font-bold text-red-300">{fmt(analysis.prevMaxCE?.strike || 0)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{fmt(analysis.prevMaxCE?.callOI || 0)} OI</p>
                  </div>
                  <ArrowRight size={20} className="text-red-500 shrink-0" />
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Current</p>
                    <p className="text-2xl font-bold text-red-400">{fmt(analysis.currMaxCE?.strike || 0)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{fmt(analysis.currMaxCE?.callOI || 0)} OI</p>
                  </div>
                </div>
                {analysis.prevMaxCE?.strike !== analysis.currMaxCE?.strike
                  ? <p className="text-sm text-red-400 font-semibold">
                    Resistance shifted {(analysis.currMaxCE?.strike || 0) > (analysis.prevMaxCE?.strike || 0) ? "higher ↑" : "lower ↓"} by {Math.abs((analysis.currMaxCE?.strike || 0) - (analysis.prevMaxCE?.strike || 0))} points
                  </p>
                  : <p className="text-sm text-[var(--text-secondary)]">Resistance unchanged at {fmt(analysis.currMaxCE?.strike || 0)}</p>}
              </div>
            </div>
          </SectionCard>

          {/* SECTION 13: AI Trade Book */}
          <SectionCard title="13 · AI Trade Book" icon={Target} color="#f59e0b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard label="Market Bias" value={<Badge label={analysis.bias} type={analysis.bias === "Bullish" ? "bullish" : analysis.bias === "Bearish" ? "bearish" : "neutral"} />} />
              <StatCard label="Entry Zone" value={`${fmt(analysis.expZoneLow)} – ${fmt(analysis.expZoneHigh)}`} color="#8b5cf6" />
              <StatCard label="Support (SL Ref)" value={fmt(analysis.expZoneLow)} color="#10b981" />
              <StatCard label="Resistance (SL Ref)" value={fmt(analysis.expZoneHigh)} color="#ef4444" />
              <StatCard
                label="Stop Loss"
                value={fmt(analysis.bias === "Bullish" ? analysis.expZoneLow - 50 : analysis.expZoneHigh + 50)}
                color="#ef4444"
              />
              <StatCard
                label="Target 1"
                value={fmt(analysis.bias === "Bullish" ? analysis.expZoneHigh - 50 : analysis.expZoneLow + 50)}
                color="#10b981"
              />
              <StatCard
                label="Target 2"
                value={fmt(analysis.bias === "Bullish" ? analysis.expZoneHigh + 100 : analysis.expZoneLow - 100)}
                color="#10b981"
              />
              <StatCard label="Risk : Reward" value={analysis.strategy.rr} color="#f59e0b" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Probability" value={analysis.strategy.expectedProb} color="#06b6d4" />
              <StatCard label="Confidence" value={<ConfBadge label={analysis.biasConf} />} />
            </div>
          </SectionCard>

          {/* SECTION 14: Strategy Generator */}
          <SectionCard title="14 · Strategy Generator" icon={Zap} color="#a855f7">
            <div className="bg-gradient-to-r from-[#8b5cf6]/10 to-[#3b82f6]/10 border border-[#8b5cf6]/20 rounded-xl p-5 mb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/20 flex items-center justify-center">
                  <Zap size={20} className="text-[#8b5cf6]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Recommended Strategy</p>
                  <h4 className="text-xl font-extrabold text-white">{analysis.strategy.name}</h4>
                </div>
                <Badge label={analysis.bias} type={analysis.bias === "Bullish" ? "bullish" : analysis.bias === "Bearish" ? "bearish" : "neutral"} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Why Selected</p>
                    <p className="text-white text-sm leading-relaxed">{analysis.strategy.why}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Legs</p>
                    {analysis.strategy.legs.map((l, i) => (
                      <p key={i} className={`text-sm font-medium ${l.action === "Buy" ? "text-emerald-400" : "text-red-400"}`}>
                        {l.action} {l.type} @ {l.strike ? fmt(l.strike) : "—"} <span className="text-white/40 text-xs">({l.premium})</span>
                      </p>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Entry</p>
                    <p className="text-white text-sm">{analysis.strategy.entry}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Exit</p>
                    <p className="text-white text-sm">{analysis.strategy.exit}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Adjustment</p>
                    <p className="text-white text-sm">{analysis.strategy.adjustment}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
                      <p className="text-xs text-red-400/70">Max Risk</p>
                      <p className="text-sm font-bold text-red-400">{analysis.strategy.maxRisk}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                      <p className="text-xs text-emerald-400/70">Probability</p>
                      <p className="text-sm font-bold text-emerald-400">{analysis.strategy.expectedProb}</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                      <p className="text-xs text-amber-400/70">R : R</p>
                      <p className="text-sm font-bold text-amber-400">{analysis.strategy.rr}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 15: Intraday AI Conclusion */}
          <SectionCard title="15 · Intraday AI Conclusion" icon={BrainCircuit} color="#ec4899">
            <div className="bg-gradient-to-r from-[#ec4899]/10 to-[#8b5cf6]/10 border border-[#ec4899]/20 rounded-xl p-6 flex gap-4">
              <BrainCircuit size={28} className="text-[#ec4899] shrink-0 mt-1" />
              <p className="text-gray-200 leading-relaxed text-sm">{analysis.conclusion}</p>
            </div>
          </SectionCard>

          {/* SECTION 16: Export */}
          <SectionCard title="16 · Professional Export" icon={Download} color="#3b82f6">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1">
                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
                  Export the complete institutional intraday comparison report to PDF. The report includes all 16 sections: Executive Summary, PCR Analysis, Spot Movement, Volume/OI Breakdowns, Strike Behaviour Matrix, Institutional Activity, Smart Money Shifts, Trade Book, Strategy and AI Conclusion.
                </p>
                <button
                  onClick={exportPDF}
                  className="btn-primary flex items-center gap-2 px-6 py-3 text-sm font-bold"
                >
                  <Download size={16} /> Export Full Report as PDF
                </button>
              </div>
              <div className="bg-[#161925]/70 rounded-xl p-4 border border-white/5 text-sm min-w-[200px]">
                <p className="font-bold text-white mb-2">{currFile.underlying} · {currFile.expiry}</p>
                <p className="text-xs text-[var(--text-secondary)]">{prevFile.time} → {currFile.time}</p>
                <p className="text-xs text-[var(--text-secondary)]">{analysis.diffRows.length} strikes analysed</p>
                <p className="text-xs mt-2"><Badge label={analysis.bias} type={analysis.bias === "Bullish" ? "bullish" : analysis.bias === "Bearish" ? "bearish" : "neutral"} /></p>
              </div>
            </div>
          </SectionCard>

        </div>
      )}
    </div>
  );
}
