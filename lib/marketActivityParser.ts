import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MostActiveOptionRow } from './marketActivityTypes';

export const parseMarketActivityData = async (file: File): Promise<MostActiveOptionRow[]> => {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          try {
            const data = processRawRows(results.data as any[][]);
            resolve(data);
          } catch (e) {
            reject(e);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const data = processRawRows(rows as any[][]);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsBinaryString(file);
    } else {
      reject(new Error("Unsupported file format. Please upload .csv, .xls, or .xlsx"));
    }
  });
};

const processRawRows = (rows: any[][]): MostActiveOptionRow[] => {
  const filteredRows = rows.filter(row => row && row.length > 0 && row.join('').trim().length > 0);
  
  if (filteredRows.length < 2) {
    throw new Error("File is empty or invalid");
  }

  const headers = filteredRows[0].map(h => String(h || '').trim().replace(/"/g, ''));
  const dataRows = filteredRows.slice(1);
  
  const parsedData: MostActiveOptionRow[] = [];

  const symbolIdx = headers.findIndex(h => h.toLowerCase().includes('symbol'));
  const optTypeIdx = headers.findIndex(h => h.toLowerCase().includes('option type') || h.toLowerCase() === 'opt type');
  const strikeIdx = headers.findIndex(h => h.toLowerCase().includes('strike'));
  const expiryIdx = headers.findIndex(h => h.toLowerCase().includes('expiry'));
  const volIdx = headers.findIndex(h => h.toLowerCase().includes('volume') || h.toLowerCase().includes('contracts'));
  const oiIdx = headers.findIndex(h => h.toLowerCase() === 'open interest' || h.toLowerCase() === 'oi');
  const chgOiIdx = headers.findIndex(h => h.toLowerCase().includes('change in oi') || h.toLowerCase().includes('chg in oi'));
  const ltpIdx = headers.findIndex(h => h.toLowerCase().includes('ltp') || h.toLowerCase().includes('last price') || h.toLowerCase().includes('close'));

  for (const cols of dataRows) {
    if (cols.length < 5) continue; // Skip invalid rows
    
    const getVal = (idx: number, fallback: string | number = 0) => idx >= 0 && cols[idx] !== undefined && cols[idx] !== '-' ? cols[idx] : fallback;
    const getNum = (idx: number) => {
      const val = getVal(idx, "0");
      if (typeof val === 'number') return val;
      return Number(String(val).replace(/,/g, ''));
    };

    const symbol = String(getVal(symbolIdx, "UNKNOWN"));
    if (symbol === "UNKNOWN") continue;

    let optionTypeRaw = String(getVal(optTypeIdx, "CE"));
    if (optionTypeRaw.includes("PE") || optionTypeRaw.includes("Put") || optionTypeRaw.includes("PA")) {
      optionTypeRaw = "PE";
    } else {
      optionTypeRaw = "CE";
    }

    parsedData.push({
      symbol: symbol,
      optionType: optionTypeRaw as 'CE' | 'PE',
      strikePrice: getNum(strikeIdx),
      expiryDate: String(getVal(expiryIdx, "")),
      volume: getNum(volIdx),
      openInterest: getNum(oiIdx),
      changeInOI: getNum(chgOiIdx),
      ltp: getNum(ltpIdx),
    });
  }

  if (parsedData.length === 0) {
     throw new Error("No valid data found in file. Please ensure it is a Most Active Contracts file.");
  }

  return parsedData;
};

export const groupMarketDataBySymbol = (data: MostActiveOptionRow[]): Record<string, MostActiveOptionRow[]> => {
  const grouped: Record<string, MostActiveOptionRow[]> = {};
  for (const row of data) {
    if (!grouped[row.symbol]) {
      grouped[row.symbol] = [];
    }
    grouped[row.symbol].push(row);
  }
  return grouped;
};
