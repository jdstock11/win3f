import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'NIFTY';
  
  try {
    const baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };

    // First fetch to get session cookies
    const baseResponse = await fetch('https://www.nseindia.com', { headers: baseHeaders });
    const setCookieHeader = baseResponse.headers.get('set-cookie') || '';
    
    // Parse cookies simply
    const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');

    // Fetch actual option chain JSON
    const apiUrl = `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        ...baseHeaders,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookies,
        'Referer': 'https://www.nseindia.com/option-chain'
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`NSE API responded with status: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("NSE Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
