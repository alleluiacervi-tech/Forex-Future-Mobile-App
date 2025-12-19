export const calculateRSI = (values: number[], period: number = 14): number[] => {
  if (values.length < period + 1) return [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rsi: number[] = [];

  const first = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  rsi.push(first);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const next = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    rsi.push(next);
  }

  return rsi;
};

export const generateMockSeries = (base: number, points: number = 60): number[] => {
  const series: number[] = [];
  let value = base;

  for (let i = 0; i < points; i++) {
    const wave = Math.sin(i / 6) * base * 0.0006;
    const noise = (Math.random() - 0.5) * base * 0.0008;
    value = value + wave * 0.12 + noise * 0.08;
    series.push(value);
  }

  return series;
};
