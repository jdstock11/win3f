import Papa from "papaparse";
import { RawNSEOptionRow, OptionDataPoint, OptionChainRow, MergedDailyData } from "./types";
import { cleanNumber } from "./utils";

export const parseNSECSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toUpperCase().replace(/_/g, " "),
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error)
    });
  });
};

const getVal = (row: any, keys: string[]): string => {
  for (const k of keys) {
    if (row[k] !== undefined) return String(row[k]).trim();
  }
  return "";
};

const mapRawToDataPoint = (row: any): OptionDataPoint => {
  return {
    strikePrice: cleanNumber(getVal(row, ["STRIKE PRICE"])),
    open: cleanNumber(getVal(row, ["OPEN"])),
    high: cleanNumber(getVal(row, ["HIGH"])),
    low: cleanNumber(getVal(row, ["LOW"])),
    close: cleanNumber(getVal(row, ["CLOSE"])),
    ltp: cleanNumber(getVal(row, ["LTP"])),
    volume: cleanNumber(getVal(row, ["NO. OF CONTRACTS", "CONTRACTS", "VOLUME"])),
    openInterest: cleanNumber(getVal(row, ["OPEN INT", "OPEN_INT", "OI"])),
    changeInOI: cleanNumber(getVal(row, ["CHANGE IN OI", "CHG IN OI", "CHG_OI"])),
    underlyingValue: cleanNumber(getVal(row, ["UNDERLYING VALUE", "UNDERLYING"]))
  };
};

const normalizeDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  } catch (e) {
    return dateStr;
  }
};

export const mergeOptionChains = (ceData: any[], peData: any[]): MergedDailyData[] => {
  console.log(`--- MERGE REPORT ---`);
  console.log(`Total CE rows: ${ceData.length}`);
  console.log(`Total PE rows: ${peData.length}`);

  const ceMap = new Map<string, any>();
  const peMap = new Map<string, any>();

  const getMergeKey = (row: any) => {
    const rawDate = getVal(row, ["DATE", "TRADE DATE"]);
    const rawExpiry = getVal(row, ["EXPIRY", "EXPIRY DATE"]);
    const rawStrike = getVal(row, ["STRIKE PRICE"]);
    
    if (!rawDate || !rawExpiry || !rawStrike || rawStrike === "-") return null;

    const date = normalizeDate(rawDate);
    const expiry = normalizeDate(rawExpiry);
    const strike = cleanNumber(rawStrike); // Removes commas and converts to Number
    
    return `${date}_${expiry}_${strike}`;
  };

  ceData.forEach(row => {
    const key = getMergeKey(row);
    if (key) ceMap.set(key, row);
  });
  
  peData.forEach(row => {
    const key = getMergeKey(row);
    if (key) peMap.set(key, row);
  });

  const ceKeys = Array.from(ceMap.keys());
  const peKeys = Array.from(peMap.keys());
  
  console.log("First 5 CE Keys:", ceKeys.slice(0, 5));
  console.log("First 5 PE Keys:", peKeys.slice(0, 5));

  const allKeys = new Set([...ceKeys, ...peKeys]);
  
  const mergedMap = new Map<string, MergedDailyData>();

  let matchedRows = 0;
  let unmatchedCeRows = 0;
  let unmatchedPeRows = 0;
  const unmatchedKeys: string[] = [];

  allKeys.forEach(key => {
    const ceRow = ceMap.get(key);
    const peRow = peMap.get(key);

    if (ceRow && peRow) {
      matchedRows++;
    } else {
      if (ceRow) unmatchedCeRows++;
      if (peRow) unmatchedPeRows++;
      if (unmatchedKeys.length < 20) unmatchedKeys.push(key);
    }

    const baseRow = ceRow || peRow;
    const rawDate = getVal(baseRow, ["DATE", "TRADE DATE"]);
    const rawExpiry = getVal(baseRow, ["EXPIRY", "EXPIRY DATE"]);
    const date = normalizeDate(rawDate);
    const expiry = normalizeDate(rawExpiry);
    const groupKey = `${date}_${expiry}`;
    
    if (!mergedMap.has(groupKey)) {
      mergedMap.set(groupKey, {
        date,
        expiry,
        chain: []
      });
    }

    const dailyData = mergedMap.get(groupKey)!;
    const strikeRow: OptionChainRow = {
      strikePrice: cleanNumber(getVal(baseRow, ["STRIKE PRICE"])),
      underlyingValue: cleanNumber(getVal(baseRow, ["UNDERLYING VALUE", "UNDERLYING"])),
      CE: ceRow ? mapRawToDataPoint(ceRow) : null,
      PE: peRow ? mapRawToDataPoint(peRow) : null
    };
    dailyData.chain.push(strikeRow);
  });

  console.log(`Successfully matched rows: ${matchedRows}`);
  console.log(`Unmatched CE rows: ${unmatchedCeRows}`);
  console.log(`Unmatched PE rows: ${unmatchedPeRows}`);
  console.log(`First 20 unmatched keys:`, unmatchedKeys);
  console.log(`Merged Row Count (Unique Strikes): ${allKeys.size}`);
  console.log(`--------------------`);

  const result = Array.from(mergedMap.values());
  result.forEach(day => {
    day.chain.sort((a, b) => a.strikePrice - b.strikePrice);
  });
  result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return result;
};
