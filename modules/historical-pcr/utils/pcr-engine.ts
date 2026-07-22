import { DailyPCRRecord, PCRDataset, RecoveryEvent, RecoveryStats, ProbabilityResult } from "../types";

export const getPCRClassification = (pcr: number, isEquityOrFuture: boolean = false) => {
  if (isEquityOrFuture) {
     if (pcr < 0.55) return "Bullish";
     if (pcr >= 0.55 && pcr <= 1.60) return "Neutral";
     return "Bearish";
  }

  if (pcr < 0.50) return "Strong Bullish";
  if (pcr >= 0.50 && pcr < 0.60) return "Bullish";
  if (pcr >= 0.60 && pcr < 1.00) return "Neutral Bullish";
  if (pcr >= 1.00 && pcr < 1.30) return "Neutral";
  if (pcr >= 1.30 && pcr < 1.60) return "Neutral Bearish";
  return "Bearish";
};

export const scanForRecoveries = (
  records: DailyPCRRecord[],
  threshold: number = 0.60,
  targetZoneMin: number = 1.00,
  targetZoneMax: number = 1.30,
  type: 'volume' | 'oi' = 'volume'
): RecoveryEvent[] => {
  const events: RecoveryEvent[] = [];
  let currentEvent: RecoveryEvent | null = null;
  
  // Sort records chronologically
  const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const pcr = type === 'volume' ? record.volumePCR : record.oiPCR;
    
    // Check if we enter the extreme zone
    if (!currentEvent && pcr < threshold) {
      currentEvent = {
        entryDate: record.date,
        entryPCR: pcr,
        exitDate: '',
        exitPCR: 0,
        recoveryDate: null,
        recoveryPCR: null,
        sessionsTaken: null,
        maxDeviationPCR: pcr,
        status: 'In Progress'
      };
    }
    
    if (currentEvent) {
       if (pcr < currentEvent.maxDeviationPCR) {
          currentEvent.maxDeviationPCR = pcr;
       }
       
       // Exited extreme zone but not recovered
       if (pcr >= threshold && !currentEvent.exitDate && pcr < targetZoneMin) {
          currentEvent.exitDate = record.date;
          currentEvent.exitPCR = pcr;
       }
       
       // Recovered
       if (pcr >= targetZoneMin) {
          currentEvent.recoveryDate = record.date;
          currentEvent.recoveryPCR = pcr;
          // count sessions (rough estimate by array index difference)
          const entryIndex = sorted.findIndex(r => r.date === currentEvent!.entryDate);
          currentEvent.sessionsTaken = i - entryIndex;
          currentEvent.status = 'Recovered';
          
          if (!currentEvent.exitDate) {
             currentEvent.exitDate = record.date;
             currentEvent.exitPCR = pcr;
          }
          
          events.push(currentEvent);
          currentEvent = null; // Reset for next event
       }
    }
  }
  
  if (currentEvent) {
     currentEvent.status = 'Failed'; // or still in progress if it's the end
     events.push(currentEvent);
  }

  return events;
};

export const calculateRecoveryStats = (events: RecoveryEvent[]): RecoveryStats => {
  const recoveredEvents = events.filter(e => e.status === 'Recovered' && e.sessionsTaken !== null);
  
  if (recoveredEvents.length === 0) {
    return {
      averageDays: 0,
      medianDays: 0,
      minDays: 0,
      maxDays: 0,
      totalSignals: events.length,
      successfulRecoveries: 0,
      failedRecoveries: events.filter(e => e.status === 'Failed').length,
      successRate: 0
    };
  }

  const days = recoveredEvents.map(e => e.sessionsTaken as number).sort((a, b) => a - b);
  const sum = days.reduce((a, b) => a + b, 0);
  const averageDays = sum / days.length;
  
  const mid = Math.floor(days.length / 2);
  const medianDays = days.length % 2 !== 0 ? days[mid] : (days[mid - 1] + days[mid]) / 2;

  return {
    averageDays,
    medianDays,
    minDays: days[0],
    maxDays: days[days.length - 1],
    totalSignals: events.length,
    successfulRecoveries: recoveredEvents.length,
    failedRecoveries: events.length - recoveredEvents.length,
    successRate: (recoveredEvents.length / events.length) * 100
  };
};

export const calculateProbabilities = (events: RecoveryEvent[]): ProbabilityResult[] => {
  const recoveredEvents = events.filter(e => e.status === 'Recovered' && e.sessionsTaken !== null);
  const total = events.length;
  if (total === 0) return [];

  const targets = [1, 2, 3, 5, 10, 15, 20];
  const results: ProbabilityResult[] = [];

  targets.forEach(days => {
    const recoveredWithin = recoveredEvents.filter(e => (e.sessionsTaken as number) <= days).length;
    results.push({
      days,
      probability: recoveredWithin / total
    });
  });

  return results;
};
