import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache');

export const dynamic = 'force-dynamic';

async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${symbol.toUpperCase()}.json`);
    
    let exists = true;
    try {
      await fs.access(filePath);
    } catch {
      exists = false;
    }

    if (!exists) {
      return NextResponse.json({ data: null });
    }

    const fileContents = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContents);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error reading cache:', error);
    return NextResponse.json({ error: 'Failed to read cache' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, dataset, timestamp } = body;

    if (!symbol || !dataset) {
      return NextResponse.json({ error: 'Symbol and dataset are required' }, { status: 400 });
    }

    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${symbol.toUpperCase()}.json`);
    
    const cachePayload = {
      timestamp: timestamp || new Date().toISOString(),
      dataset
    };

    await fs.writeFile(filePath, JSON.stringify(cachePayload, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error writing cache:', error);
    return NextResponse.json({ error: 'Failed to write cache' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${symbol.toUpperCase()}.json`);
    
    let exists = true;
    try {
      await fs.access(filePath);
    } catch {
      exists = false;
    }

    if (exists) {
      await fs.unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting cache:', error);
    return NextResponse.json({ error: 'Failed to delete cache' }, { status: 500 });
  }
}
