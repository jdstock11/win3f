export interface OptionData {
  strike: number;
  callOI: number;
  callChngOI: number;
  callVolume: number;
  callIV: number;
  callLTP: number;
  putOI: number;
  putChngOI: number;
  putVolume: number;
  putIV: number;
  putLTP: number;
}

export interface DailyPCRRecord {
  date: string;
  underlying: string;
  expiry: string;
  callVolume: number;
  putVolume: number;
  volumePCR: number;
  callOI: number;
  putOI: number;
  oiPCR: number;
  isEquityOrFuture?: boolean;
  high?: number;
  low?: number;
  close?: number;
  open?: number;
}

export interface PCRDataset {
  underlying: string;
  expiry: string;
  records: DailyPCRRecord[];
}

export interface RecoveryEvent {
  entryDate: string;
  entryPCR: number;
  exitDate: string;
  exitPCR: number;
  recoveryDate: string | null;
  recoveryPCR: number | null;
  sessionsTaken: number | null;
  maxDeviationPCR: number;
  status: 'Recovered' | 'Failed' | 'In Progress';
}

export interface RecoveryStats {
  averageDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  totalSignals: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  successRate: number;
}

export interface ProbabilityResult {
  days: number;
  probability: number; // 0 to 1
}
