import { DailyPCRRecord } from "../types";
import Papa from "papaparse";

export const parseOptionChainCSV = (file: File): Promise<DailyPCRRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      if (!csvText) {
        resolve([]);
        return;
      }

      let underlying = "UNKNOWN";
      if (file.name.toUpperCase().includes("BANKNIFTY")) underlying = "BANKNIFTY";
      else if (file.name.toUpperCase().includes("NIFTYNXT50")) underlying = "NIFTYNXT50";
      else if (file.name.toUpperCase().includes("FINNIFTY")) underlying = "FINNIFTY";
      else if (file.name.toUpperCase().includes("MIDCPNIFTY")) underlying = "MIDCPNIFTY";
      else if (file.name.toUpperCase().includes("NIFTY")) underlying = "NIFTY";
      else if (file.name.toUpperCase().includes("RELIANCE")) underlying = "RELIANCE";
      else {
         // try to extract from name like Quote-Equity-RELIANCE-EQ...
         const parts = file.name.split('-');
         if (parts.length > 2 && (parts[0] === 'Quote' || parts[0] === 'option')) {
            underlying = parts[2];
         }
      }

      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length < 2) {
             resolve([]);
             return;
          }

          // Detect Format
          let format: 'OPTION_CHAIN' | 'HISTORICAL_DERIVATIVE' | 'HISTORICAL_EQUITY' = 'OPTION_CHAIN';
          let headerRowIndex = -1;

          for (let i = 0; i < Math.min(10, data.length); i++) {
             const rowLower = data[i].map(c => c.toLowerCase().trim());
             if (rowLower.includes("date") && rowLower.includes("option type") && rowLower.includes("volume")) {
                format = 'HISTORICAL_DERIVATIVE';
                headerRowIndex = i;
                break;
             }
             if (rowLower.includes("date") && rowLower.includes("series") && rowLower.includes("volume")) {
                format = 'HISTORICAL_EQUITY';
                headerRowIndex = i;
                break;
             }
             if (rowLower.includes("strike") || rowLower.includes("strike price")) {
                format = 'OPTION_CHAIN';
                headerRowIndex = i;
                break;
             }
          }

          const parseNumber = (val: string) => {
            if (!val || val === "-" || val.trim() === "") return 0;
            return parseFloat(val.replace(/,/g, "")) || 0;
          };
          
          const recordsMap = new Map<string, DailyPCRRecord>();

          if (format === 'HISTORICAL_DERIVATIVE') {
             const headers = data[headerRowIndex].map(c => c.toLowerCase().trim());
             const dateIdx = headers.indexOf("date");
             const optTypeIdx = headers.indexOf("option type");
             const volIdx = headers.indexOf("volume");
             const oiIdx = headers.indexOf("open interest") !== -1 ? headers.indexOf("open interest") : headers.indexOf("open int");
             const expiryIdx = headers.indexOf("expiry date");
             const highIdx = headers.indexOf("high price") !== -1 ? headers.indexOf("high price") : headers.indexOf("high");
             const lowIdx = headers.indexOf("low price") !== -1 ? headers.indexOf("low price") : headers.indexOf("low");
             const closeIdx = headers.indexOf("close price") !== -1 ? headers.indexOf("close price") : headers.indexOf("close");
             const openIdx = headers.indexOf("open price") !== -1 ? headers.indexOf("open price") : headers.indexOf("open");
             let hasOptions = false;

             for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (row.length <= Math.max(dateIdx, optTypeIdx, volIdx)) continue;
                
                let rawDate = row[dateIdx].trim();
                if (!rawDate) continue;
                // format dates like 22-Jul-26 to standard if possible, else keep as is
                const optType = row[optTypeIdx].toUpperCase().trim();
                const vol = parseNumber(row[volIdx]);
                const oi = oiIdx !== -1 ? parseNumber(row[oiIdx]) : 0;
                const high = highIdx !== -1 ? parseNumber(row[highIdx]) : 0;
                const low = lowIdx !== -1 ? parseNumber(row[lowIdx]) : 0;
                const close = closeIdx !== -1 ? parseNumber(row[closeIdx]) : 0;
                const open = openIdx !== -1 ? parseNumber(row[openIdx]) : 0;
                let expiry = expiryIdx !== -1 ? row[expiryIdx].trim() : "UNKNOWN";

                if (!recordsMap.has(rawDate)) {
                   recordsMap.set(rawDate, {
                      date: rawDate,
                      underlying,
                      expiry,
                      callVolume: 0,
                      putVolume: 0,
                      volumePCR: 0,
                      callOI: 0,
                      putOI: 0,
                      oiPCR: 0,
                      high,
                      low,
                      close,
                      open
                   });
                }

                const rec = recordsMap.get(rawDate)!;
                if (high > (rec.high || 0)) rec.high = high;
                if (low > 0 && (!rec.low || low < rec.low)) rec.low = low;
                rec.close = close; // just take the last close
                if (open > 0 && (!rec.open || rec.open === 0)) rec.open = open;
                
                if (optType === "CE") {
                   rec.callVolume += vol;
                   rec.callOI += oi;
                   hasOptions = true;
                } else if (optType === "PE") {
                   rec.putVolume += vol;
                   rec.putOI += oi;
                   hasOptions = true;
                } else {
                   // Futures or Others. Let's just add to callVolume to make it visible
                   rec.callVolume += vol;
                   rec.callOI += oi;
                }
             }
             
             if (!hasOptions) {
                Array.from(recordsMap.values()).forEach(r => r.isEquityOrFuture = true);
             }

          } else if (format === 'HISTORICAL_EQUITY') {
             const headers = data[headerRowIndex].map(c => c.toLowerCase().trim());
             const dateIdx = headers.indexOf("date");
             const volIdx = headers.indexOf("volume");
             const highIdx = headers.indexOf("high");
             const lowIdx = headers.indexOf("low");
             const closeIdx = headers.indexOf("close") !== -1 ? headers.indexOf("close") : headers.indexOf("ltp");
             const openIdx = headers.indexOf("open");

             for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (row.length <= Math.max(dateIdx, volIdx)) continue;
                
                let rawDate = row[dateIdx].trim();
                if (!rawDate) continue;
                const vol = parseNumber(row[volIdx]);
                const high = highIdx !== -1 ? parseNumber(row[highIdx]) : 0;
                const low = lowIdx !== -1 ? parseNumber(row[lowIdx]) : 0;
                const close = closeIdx !== -1 ? parseNumber(row[closeIdx]) : 0;
                const open = openIdx !== -1 ? parseNumber(row[openIdx]) : 0;

                if (!recordsMap.has(rawDate)) {
                   recordsMap.set(rawDate, {
                      date: rawDate,
                      underlying,
                      expiry: "EQUITY",
                      callVolume: vol, // Put everything in callVolume for Equity
                      putVolume: 0,
                      volumePCR: 0,
                      callOI: 0,
                      putOI: 0,
                      oiPCR: 0,
                      isEquityOrFuture: true,
                      high,
                      low,
                      close,
                      open
                   });
                } else {
                   const rec = recordsMap.get(rawDate)!;
                   rec.callVolume += vol;
                   if (high > (rec.high || 0)) rec.high = high;
                   if (low > 0 && (!rec.low || low < rec.low)) rec.low = low;
                   rec.close = close;
                   if (open > 0 && (!rec.open || rec.open === 0)) rec.open = open;
                }
             }
          } else {
             // OPTION_CHAIN (Single Day)
             let callVolumeIndex = -1;
             let putVolumeIndex = -1;
             let callOIIndex = -1;
             let putOIIndex = -1;
             
             let totalCallVolume = 0;
             let totalPutVolume = 0;
             let totalCallOI = 0;
             let totalPutOI = 0;

             const lowerRow = data[headerRowIndex].map(cell => cell.toLowerCase().trim());
             const strikeIdx = lowerRow.indexOf("strike") !== -1 ? lowerRow.indexOf("strike") : lowerRow.indexOf("strike price");
             
             for (let j = 0; j < strikeIdx; j++) {
               if (lowerRow[j] === "volume") callVolumeIndex = j;
               if (lowerRow[j] === "oi" || lowerRow[j] === "open int") callOIIndex = j;
             }
             for (let j = strikeIdx + 1; j < lowerRow.length; j++) {
               if (lowerRow[j] === "volume") putVolumeIndex = j;
               if (lowerRow[j] === "oi" || lowerRow[j] === "open int") putOIIndex = j;
             }

             if (callVolumeIndex !== -1 && putVolumeIndex !== -1) {
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                   const row = data[i];
                   if (row.length <= Math.max(callVolumeIndex, putVolumeIndex)) continue;

                   const cv = parseNumber(row[callVolumeIndex]);
                   const pv = parseNumber(row[putVolumeIndex]);
                   const coi = callOIIndex !== -1 ? parseNumber(row[callOIIndex]) : 0;
                   const poi = putOIIndex !== -1 ? parseNumber(row[putOIIndex]) : 0;

                   if (row.some(cell => cell.toLowerCase().includes("total"))) {
                       if (cv > totalCallVolume) totalCallVolume = cv;
                       if (pv > totalPutVolume) totalPutVolume = pv;
                       if (coi > totalCallOI) totalCallOI = coi;
                       if (poi > totalPutOI) totalPutOI = poi;
                       break;
                   } else {
                       totalCallVolume += cv;
                       totalPutVolume += pv;
                       totalCallOI += coi;
                       totalPutOI += poi;
                   }
                }
             }

             let date = new Date().toISOString().split('T')[0];
             const dateMatch = file.name.match(/\d{2}-\w{3}-\d{4}/) || file.name.match(/\d{8}/);
             if (dateMatch) {
                // simple try to format
                date = dateMatch[0]; 
             }

             recordsMap.set(date, {
                date,
                underlying,
                expiry: "UNKNOWN",
                callVolume: totalCallVolume,
                putVolume: totalPutVolume,
                volumePCR: 0,
                callOI: totalCallOI,
                putOI: totalPutOI,
                oiPCR: 0
             });
          }

          // Sort by date (assuming DD-MMM-YY format from NSE or ISO)
          const finalRecords = Array.from(recordsMap.values());
          finalRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Calculate PCRs based on type
          let prevVolume = 0;
          let prevOI = 0;
          
          for (let i = 0; i < finalRecords.length; i++) {
             const rec = finalRecords[i];
             
             if (rec.isEquityOrFuture) {
                rec.volumePCR = prevVolume === 0 ? 0 : rec.callVolume / prevVolume;
                rec.oiPCR = prevOI === 0 ? 0 : rec.callOI / prevOI;
             } else {
                rec.volumePCR = rec.callVolume === 0 ? 0 : rec.putVolume / rec.callVolume;
                rec.oiPCR = rec.callOI === 0 ? 0 : rec.putOI / rec.callOI;
             }
             
             prevVolume = rec.callVolume;
             prevOI = rec.callOI;
          }

          resolve(finalRecords);
        },
        error: (error: Error) => {
          console.error("CSV Parse Error:", error);
          resolve([]);
        }
      });
    };
    reader.onerror = () => resolve([]);
    reader.readAsText(file);
  });
};
