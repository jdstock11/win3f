import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

// Fixed row labels in exact order
const ROW_LABELS = [
  "Symbol",
  "Call Writing %",
  "Call Buying %",
  "Call Unwinding %",
  "Call Short Covering",
  "",
  "Put Writing %",
  "Put Buying %",
  "Put Unwinding %",
  "Put Short Covering",
];

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const exportDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const symbol = (data.symbol && data.symbol !== "UNKNOWN") ? String(data.symbol) : "UNKNOWN";
    const symbolSafe = symbol.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Intraday_History_${symbolSafe}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    const timeCol = String(data.time || "N/A");

    // Values for each ROW_LABEL index
    const newValues: (string | number)[] = [
      symbol,
      data.ce_writing  ?? "",
      data.ce_buying   ?? "",
      data.ce_unwinding ?? "",
      data.ce_covering ?? "",
      "",
      data.pe_writing  ?? "",
      data.pe_buying   ?? "",
      data.pe_unwinding ?? "",
      data.pe_covering ?? "",
    ];

    // ── Load existing data ────────────────────────────────────────────────────
    // Structure stored on disk:
    //   Row 0 (header): ["Metric", "slot1", "slot2", ...]
    //   Row 1..N (data): [ROW_LABELS[r], val_for_slot1, val_for_slot2, ...]

    // timeDataMap: slotName -> array of ROW_LABELS.length values
    const timeDataMap: Record<string, (string | number)[]> = {};
    let existingTimes: string[] = [];

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const wb = xlsx.read(fileBuffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // header:1 → returns raw rows as arrays; row 0 = header, row 1..N = data
      const rawAoa: (string | number)[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

      if (rawAoa.length >= 2) {
        // Row 0 = ["Metric", "slot1", "slot2", ...]
        const headerRow = rawAoa[0];
        existingTimes = (headerRow.slice(1) as string[]).map(String);

        existingTimes.forEach((t, colOffset) => {
          const colIdx = colOffset + 1; // +1 because col 0 = Metric
          const colData: (string | number)[] = [];
          for (let r = 0; r < ROW_LABELS.length; r++) {
            // Data rows start at rawAoa[1], so data row r is rawAoa[r + 1]
            const dataRowIdx = r + 1;
            colData[r] = (rawAoa[dataRowIdx] && rawAoa[dataRowIdx][colIdx] !== undefined)
              ? rawAoa[dataRowIdx][colIdx]
              : "";
          }
          timeDataMap[t] = colData;
        });
      }
    }

    // Add / overwrite current time slot
    timeDataMap[timeCol] = newValues;

    // Build ordered list of times — existing order preserved, new slot appended (not duplicated)
    const filteredExisting = existingTimes.filter(t => t !== timeCol);
    const allTimes = [...filteredExisting, timeCol];

    // ── Build AOA from scratch ────────────────────────────────────────────────
    // Row 0: header
    const newAoa: (string | number)[][] = [];
    newAoa.push(["Metric", ...allTimes]);

    // Rows 1..N: data
    for (let r = 0; r < ROW_LABELS.length; r++) {
      const row: (string | number)[] = [ROW_LABELS[r]];
      for (const t of allTimes) {
        const tData = timeDataMap[t];
        row.push(tData ? (tData[r] ?? "") : "");
      }
      newAoa.push(row);
    }

    // ── Write workbook ────────────────────────────────────────────────────────
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(newAoa);

    // Column widths
    worksheet['!cols'] = [
      { wch: 24 },
      ...allTimes.map(() => ({ wch: 14 })),
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, `${symbol} History`);
    const out = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, out);

    return NextResponse.json({ success: true, message: 'Saved successfully.', fileName });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error saving excel:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || "UNKNOWN";
    const symbolSafe = symbol.replace(/[^a-zA-Z0-9]/g, "_");

    const fileName = `Intraday_History_${symbolSafe}.xlsx`;
    const filePath = path.join(process.cwd(), 'public', 'exports', fileName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
