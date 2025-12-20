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

  const status = latest >= 70 ? 'Overbought' : latest <= 30 ? 'Oversold' : 'Neutral';

  const labels = Array.from({ length: rsiSeries.length }, (_, i) => (i % 12 === 0 ? `${i}` : ''));

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
        color: (opacity = 1) => `${theme.colors.error}${Math.round(opacity * 130).toString(16).padStart(2, '0')}`,
        strokeWidth: 1,
        strokeDasharray: [6, 6],
      },
      {
        data: rsiSeries.map(() => 30),
        color: (opacity = 1) => `${theme.colors.success}${Math.round(opacity * 130).toString(16).padStart(2, '0')}`,
        strokeWidth: 1,
        strokeDasharray: [6, 6],
      },
      {
        data: rsiSeries.map(() => 0),
        color: () => 'transparent',
        strokeWidth: 0,
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
    { backgroundColor: 'transparent' },
  ]);

  const frameStyle = StyleSheet.flatten([
    styles.chartFrame,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]);

  const width = Dimensions.get('window').width - 64;
  const height = 220;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="h4" style={styles.title}>
          RSI (14)
        </Text>
        <View style={styles.headerRight}>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {timeframe} • {status} • 70 / 30
          </Text>
          <View style={[styles.valuePill, { backgroundColor: `${rsiColor}1A`, borderColor: `${rsiColor}55` }]}
          >
            <Text variant="caption" style={[styles.valueText, { color: rsiColor }]}>
              {Math.round(latest)}
            </Text>
          </View>
        </View>
      </View>

      <View style={frameStyle}>
        <View pointerEvents="none" style={styles.zones}>
          <View style={[styles.zoneTop, { backgroundColor: `${theme.colors.error}10` }]} />
          <View style={styles.zoneMiddle} />
          <View style={[styles.zoneBottom, { backgroundColor: `${theme.colors.success}10` }]} />
          <View style={[styles.midLine, { borderTopColor: `${theme.colors.textSecondary}22` }]} />
        </View>

        <LineChart
          data={data}
          width={width}
          height={height}
          fromZero
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'transparent',
            backgroundGradientTo: 'transparent',
            decimalPlaces: 0,
            color: (opacity = 1) =>
              `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            labelColor: (opacity = 1) =>
              `${theme.colors.textSecondary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            fillShadowGradient: rsiColor,
            fillShadowGradientOpacity: 0.06,
            propsForLabels: {
              fontSize: 10,
              fontWeight: '700',
            },
            propsForDots: {
              r: '0',
            },
            propsForBackgroundLines: {
              stroke: `${theme.colors.border}55`,
              strokeDasharray: '2 10',
            },
          }}
          formatYLabel={(y) => `${Math.round(Number(y))}`}
          bezier
          withDots={false}
          withInnerLines
          withOuterLines={false}
          withShadow
          withHorizontalLabels
          withVerticalLabels
          style={chartStyle}
          segments={5}
        />

        <View pointerEvents="none" style={styles.levelLabels}>
          <View style={[styles.levelLabel, styles.levelLabelTop, { backgroundColor: `${theme.colors.surface}CC`, borderColor: theme.colors.border }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: theme.colors.textSecondary }]}>70</Text>
          </View>
          <View style={[styles.levelLabel, styles.levelLabelMid, { backgroundColor: `${theme.colors.surface}CC`, borderColor: theme.colors.border }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: theme.colors.textSecondary }]}>50</Text>
          </View>
          <View style={[styles.levelLabel, styles.levelLabelBottom, { backgroundColor: `${theme.colors.surface}CC`, borderColor: theme.colors.border }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: theme.colors.textSecondary }]}>30</Text>
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
  },
  chartFrame: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  levelLabels: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  levelLabel: {
    position: 'absolute',
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelLabelTop: {
    top: '18%',
    transform: [{ translateY: -10 }],
  },
  levelLabelMid: {
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  levelLabelBottom: {
    bottom: '18%',
    transform: [{ translateY: 10 }],
  },
  levelLabelText: {
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  zones: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  zoneTop: {
    height: '30%',
  },
  zoneMiddle: {
    flex: 1,
  },
  zoneBottom: {
    height: '30%',
  },
  midLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
