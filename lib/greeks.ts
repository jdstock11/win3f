export function CND(x: number) {
  const a1 = 0.31938153, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let w = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) {
    w = 1.0 - w;
  }
  return w;
}

export function ND(x: number) {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

// S = Spot Price, K = Strike Price, T = Time to expiry (in years), r = risk-free rate (e.g. 0.05), v = volatility (e.g. 0.20)
export function calculateGreeks(S: number, K: number, T: number, r: number, v: number, type: 'CE' | 'PE') {
  if (T <= 0 || v <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  
  const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  const gamma = ND(d1) / (S * v * Math.sqrt(T));
  const vega = (S * ND(d1) * Math.sqrt(T)) / 100; // per 1% change in IV

  let delta, theta, rho;

  if (type === 'CE') {
    delta = CND(d1);
    theta = (-S * ND(d1) * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * CND(d2)) / 365; // per day
    rho = (K * T * Math.exp(-r * T) * CND(d2)) / 100; // per 1% change in r
  } else {
    delta = CND(d1) - 1;
    theta = (-S * ND(d1) * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * CND(-d2)) / 365;
    rho = (-K * T * Math.exp(-r * T) * CND(-d2)) / 100;
  }

  return { delta, gamma, theta, vega, rho };
}

export function estimateTimeToExpiry(expiryStr: string): number {
  if (!expiryStr) return 7 / 365;
  const expiryDate = new Date(expiryStr);
  if (isNaN(expiryDate.getTime())) return 7 / 365;
  
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return Math.max(0.001, diffDays) / 365; // Minimum 1 day to avoid Infinity
}
