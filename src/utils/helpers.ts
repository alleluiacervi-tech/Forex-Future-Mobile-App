export const calculateProfit = (
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  type: 'buy' | 'sell'
): number => {
  const priceDiff = type === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff * lotSize * 100000; // Standard lot size multiplier
};

export const calculateMargin = (lotSize: number, leverage: number = 100): number => {
  return (lotSize * 100000) / leverage;
};

export const calculatePipValue = (lotSize: number, pipSize: number = 0.0001): number => {
  return lotSize * 100000 * pipSize;
};

export const getPriceColor = (change: number): string => {
  if (change > 0) return '#4CAF50';
  if (change < 0) return '#f44336';
  return '#9e9e9e';
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

