import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { CurrencyPair } from '../../types/market';
import { useTheme } from '../../hooks';
import { Text } from '../common/Text';

interface PriceChartProps {
  pair: CurrencyPair;
  timeframe: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({ pair, timeframe }) => {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // Generate mock chart data
  const { chartData, latest, ema20Last, ema50Last, ema200Last, trendState } = useMemo(() => {
    const hashString = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    const mulberry32 = (seed: number) => {
      let t = seed;
      return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), t | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    };

    const calculateEMA = (values: number[], period: number) => {
      if (!values.length) return [];
      const alpha = 2 / (period + 1);
      const out: number[] = new Array(values.length);

      const warmup = Math.min(period, values.length);
      let sma = 0;
      for (let i = 0; i < warmup; i++) sma += values[i];
      sma = sma / warmup;

      for (let i = 0; i < values.length; i++) {
        if (i < warmup - 1) {
          out[i] = values[i];
          continue;
        }

        if (i === warmup - 1) {
          out[i] = sma;
          continue;
        }

        out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
      }

      return out;
    };

    const seed = hashString(`${pair.id}|${pair.symbol}|${timeframe}`);
    const rnd = mulberry32(seed);

    const totalCandles = 420;
    const displayCandles = 180;
    const base = pair.price;

    const closes: number[] = [];
    let v = base;
    for (let i = 0; i < totalCandles; i++) {
      const wave = Math.sin(i / 10) * base * 0.0007;
      const noise = (rnd() - 0.5) * base * 0.0009;
      v = v + wave * 0.06 + noise * 0.1;
      closes.push(v);
    }

    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);

    const start = Math.max(0, closes.length - displayCandles);
    const closeView = closes.slice(start);
    const ema20View = ema20.slice(start);
    const ema50View = ema50.slice(start);
    const ema200View = ema200.slice(start);

    const labels = Array.from({ length: closeView.length }, (_, i) => {
      const step = 30;
      if (i % step !== 0) return '';
      return `${i}`;
    });

    const latest = closeView[closeView.length - 1] ?? base;
    const ema20Last = ema20View[ema20View.length - 1] ?? latest;
    const ema50Last = ema50View[ema50View.length - 1] ?? latest;
    const ema200Last = ema200View[ema200View.length - 1] ?? latest;

    const bullish = ema20Last > ema50Last && ema50Last > ema200Last;
    const bearish = ema20Last < ema50Last && ema50Last < ema200Last;
    const trendState: 'bullish' | 'bearish' | 'neutral' = bullish ? 'bullish' : bearish ? 'bearish' : 'neutral';

    return {
      chartData: {
        labels,
        datasets: [
          {
            data: closeView,
            color: (opacity = 1) =>
              `${theme.colors.text}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            strokeWidth: 2.2,
          },
          {
            data: ema20View,
            color: (opacity = 1) =>
              `${theme.colors.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            strokeWidth: 1.8,
          },
          {
            data: ema50View,
            color: (opacity = 1) =>
              `${theme.colors.info}${Math.round(opacity * 230).toString(16).padStart(2, '0')}`,
            strokeWidth: 1.6,
          },
          {
            data: ema200View,
            color: (opacity = 1) =>
              `${theme.colors.textSecondary}${Math.round(opacity * 210).toString(16).padStart(2, '0')}`,
            strokeWidth: 1.6,
          },
        ],
      },
      latest,
      ema20Last,
      ema50Last,
      ema200Last,
      trendState,
    };
  }, [pair.id, pair.price, pair.symbol, theme.colors.info, theme.colors.primary, theme.colors.text, theme.colors.textSecondary, timeframe]);

  const screenWidth = windowWidth - 64;
  const height = 240;

  const trendAccent =
    trendState === 'bullish' ? theme.colors.success : trendState === 'bearish' ? theme.colors.error : theme.colors.textSecondary;
  const trendLabel = trendState === 'bullish' ? 'Bullish trend' : trendState === 'bearish' ? 'Bearish trend' : 'Neutral trend';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text variant="h4" style={styles.title}>
            {pair.symbol}
          </Text>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {timeframe} • EMA 20 / 50 / 200
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.trendPill, { backgroundColor: `${trendAccent}1A`, borderColor: `${trendAccent}55` }]}
          >
            <Text variant="caption" style={[styles.trendText, { color: trendAccent }]}>
              {trendLabel}
            </Text>
          </View>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {latest.toFixed(5)}
          </Text>
        </View>
      </View>

      <View style={[styles.chartFrame, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View
          pointerEvents="none"
          style={[
            styles.trendWash,
            { backgroundColor: `${trendAccent}${trendState === 'neutral' ? '00' : '0A'}` },
          ]}
        />

        <LineChart
          data={chartData}
          width={screenWidth}
          height={height}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'transparent',
            backgroundGradientTo: 'transparent',
            decimalPlaces: 5,
            color: (opacity = 1) =>
              `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            labelColor: (opacity = 1) =>
              `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            propsForLabels: {
              fontSize: 10,
              fontWeight: '700',
            },
            propsForBackgroundLines: {
              stroke: `${theme.colors.border}55`,
              strokeDasharray: '2 10',
            },
            propsForDots: {
              r: '0',
            },
          }}
          bezier
          withDots={false}
          withInnerLines
          withOuterLines={false}
          withShadow={false}
          segments={5}
          style={styles.chart}
        />

        <View pointerEvents="none" style={styles.emaLegend}>
          <View style={[styles.emaChip, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}33` }]}>
            <Text variant="caption" style={[styles.emaChipText, { color: theme.colors.primary }]}>
              EMA20 {ema20Last.toFixed(5)}
            </Text>
          </View>
          <View style={[styles.emaChip, { backgroundColor: `${theme.colors.info}14`, borderColor: `${theme.colors.info}33` }]}>
            <Text variant="caption" style={[styles.emaChipText, { color: theme.colors.info }]}>
              EMA50 {ema50Last.toFixed(5)}
            </Text>
          </View>
          <View style={[styles.emaChip, { backgroundColor: `${theme.colors.textSecondary}14`, borderColor: `${theme.colors.textSecondary}33` }]}>
            <Text variant="caption" style={[styles.emaChipText, { color: theme.colors.textSecondary }]}>
              EMA200 {ema200Last.toFixed(5)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  title: {
    fontWeight: '900',
  },
  trendPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendText: {
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  chartFrame: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  trendWash: {
    ...StyleSheet.absoluteFillObject,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emaLegend: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emaChipText: {
    fontWeight: '900',
    letterSpacing: 0.15,
  },
});

