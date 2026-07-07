export const cleanNumber = (val: string | undefined): number => {
  if (!val || val.trim() === "-" || val.trim() === "") return 0;
  return Number(val.replace(/,/g, ""));
};

export const formatNumber = (num: number): string => {
  if (num >= 10000000) return (num / 10000000).toFixed(2) + " Cr";
  if (num >= 100000) return (num / 100000).toFixed(2) + " L";
  if (num >= 1000) return (num / 1000).toFixed(2) + " K";
  return num.toString();
};

export const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  return (value - min) / (max - min);
};

export const findATMStrike = (underlyingValue: number, strikeInterval: number = 50): number => {
  return Math.round(underlyingValue / strikeInterval) * strikeInterval;
};
