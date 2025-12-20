import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../../hooks';
import { Text } from '../common/Text';
import { calculateRSI, generateMockSeries } from '../../utils/rsi';

interface RSIChartProps {
  basePrice: number;
  timeframe: string;
}

export const RSIChart: React.FC<RSIChartProps> = ({ basePrice, timeframe }) => {
  const theme = useTheme();

  const rsiSeries = useMemo(() => {
    const prices = generateMockSeries(basePrice, 64);
    const rsi = calculateRSI(prices, 14);
    return rsi.map((v) => Math.max(0, Math.min(100, v)));
  }, [basePrice, timeframe]);

  const latest = rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : 50;
  const rsiColor =
    latest >= 70 ? theme.colors.error : latest <= 30 ? theme.colors.success : theme.colors.primary;

  const labels = Array.from({ length: rsiSeries.length }, (_, i) => (i % 8 === 0 ? `${i}` : ''));

  const data = {
    labels,
    datasets: [
      {
        data: rsiSeries,
        color: (opacity = 1) => `${rsiColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        strokeWidth: 2.5,
      },
      {
        data: rsiSeries.map(() => 70),
        color: (opacity = 1) => `${theme.colors.error}${Math.round(opacity * 180).toString(16).padStart(2, '0')}`,
        strokeWidth: 1,
        strokeDasharray: [6, 6],
      },
      {
        data: rsiSeries.map(() => 30),
        color: (opacity = 1) => `${theme.colors.success}${Math.round(opacity * 180).toString(16).padStart(2, '0')}`,
        strokeWidth: 1,
        strokeDasharray: [6, 6],
      },
      {
        data: rsiSeries.map(() => 100),
        color: () => 'transparent',
        strokeWidth: 0,
      },
    ],
  };

  const chartStyle = StyleSheet.flatten([
    styles.chart,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]);

  const width = Dimensions.get('window').width - 64;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="h4" style={styles.title}>
          RSI
        </Text>
        <View style={styles.headerRight}>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {timeframe} • Overbought 70 / Oversold 30
          </Text>
          <View style={[styles.valuePill, { backgroundColor: `${rsiColor}1A`, borderColor: `${rsiColor}55` }]}
          >
            <Text variant="caption" style={[styles.valueText, { color: rsiColor }]}>
              {Math.round(latest)}
            </Text>
          </View>
        </View>
      </View>

      <LineChart
        data={data}
        width={width}
        height={220}
        fromZero
        yAxisInterval={1}
        chartConfig={{
          backgroundColor: theme.colors.surface,
          backgroundGradientFrom: theme.colors.surface,
          backgroundGradientTo: theme.colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
          labelColor: (opacity = 1) => `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
          fillShadowGradient: rsiColor,
          fillShadowGradientOpacity: 0.12,
          propsForLabels: {
            fontSize: 10,
            fontWeight: '700',
          },
          propsForDots: {
            r: '0',
          },
          propsForBackgroundLines: {
            stroke: theme.colors.border,
            strokeDasharray: '4 8',
          },
        }}
        formatYLabel={(y) => `${Math.round(Number(y))}`}
        bezier
        withDots={false}
        withInnerLines
        withOuterLines={false}
        withShadow
        style={chartStyle}
        segments={5}
      />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: rsiColor }]} />
          <Text variant="caption" color={theme.colors.textSecondary}>
            RSI
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: theme.colors.error }]} />
          <Text variant="caption" color={theme.colors.textSecondary}>
            70
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: theme.colors.success }]} />
          <Text variant="caption" color={theme.colors.textSecondary}>
            30
          </Text>
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
    alignItems: 'baseline',
    marginBottom: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  title: {
    fontWeight: '800',
  },
  chart: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valueText: {
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
