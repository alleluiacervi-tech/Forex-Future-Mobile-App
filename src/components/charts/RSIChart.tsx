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

  const labels = Array.from({ length: rsiSeries.length }, (_, i) => (i % 8 === 0 ? `${i}` : ''));

  const data = {
    labels,
    datasets: [
      {
        data: rsiSeries,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: rsiSeries.map(() => 70),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity * 0.75})`,
        strokeWidth: 1,
      },
      {
        data: rsiSeries.map(() => 30),
        color: (opacity = 1) => `rgba(34, 197, 94, ${opacity * 0.75})`,
        strokeWidth: 1,
      },
    ],
    legend: ['RSI', 'Overbought 70', 'Oversold 30'],
  };

  const width = Dimensions.get('window').width - 64;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="h4" style={styles.title}>
          RSI
        </Text>
        <Text variant="caption" color={theme.colors.textSecondary}>
          {timeframe} • Overbought 70 / Oversold 30
        </Text>
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
          color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          propsForDots: {
            r: '0',
          },
          propsForBackgroundLines: {
            stroke: theme.colors.border,
          },
        }}
        bezier
        withDots={false}
        withInnerLines
        withOuterLines={false}
        withShadow={false}
        style={styles.chart}
        segments={4}
      />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: theme.colors.info }]} />
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
  title: {
    fontWeight: '800',
  },
  chart: {
    borderRadius: 16,
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
