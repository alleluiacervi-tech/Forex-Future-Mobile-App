import React, { useMemo, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import { Text } from '../common/Text';
import { calculateRSI, generateMockSeries } from '../../utils/rsi';

interface RSIChartProps {
  basePrice: number;
  timeframe: string;
}

export const RSIChart: React.FC<RSIChartProps> = ({ basePrice, timeframe }) => {
  const theme = useTheme();
  const [zoomLevel, setZoomLevel] = useState(1);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  const rsiSeries = useMemo(() => {
    const totalPoints = 180;
    const displayPoints = Math.floor(totalPoints / zoomLevel);
    const prices = generateMockSeries(basePrice, displayPoints);
    const rsi = calculateRSI(prices, 14);
    return rsi.map((v) => Math.max(0, Math.min(100, v)));
  }, [basePrice, timeframe, zoomLevel]);

  const latest = rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : 50;
  const rsiColor =
    latest >= 70 ? '#f44336' : latest <= 30 ? '#4CAF50' : '#2196F3';

  const status = latest >= 70 ? 'Overbought' : latest <= 30 ? 'Oversold' : 'Neutral';

  const labels = Array.from({ length: rsiSeries.length }, (_, i) => (i % 12 === 0 ? `${i}` : ''));

  const data = {
    labels,
    datasets: [
      {
        data: rsiSeries,
        color: (opacity = 1) => {
          if (latest >= 70) return `rgba(244, 67, 54, ${opacity})`;
          if (latest <= 30) return `rgba(76, 175, 80, ${opacity})`;
          return `rgba(33, 150, 243, ${opacity})`;
        },
        strokeWidth: 2.8,
      },
      {
        data: rsiSeries.map(() => 70),
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity * 0.5})`,
        strokeWidth: 1.2,
        strokeDasharray: [8, 6],
      },
      {
        data: rsiSeries.map(() => 30),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity * 0.5})`,
        strokeWidth: 1.2,
        strokeDasharray: [8, 6],
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

  const baseWidth = Dimensions.get('window').width - 64;
  const chartWidth = baseWidth * zoomLevel;
  const height = 220;
  const scrollStep = baseWidth * 0.7;

  const handleScrollForward = () => {
    const newPosition = scrollPosition + scrollStep;
    scrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
  };

  const handleScrollBackward = () => {
    const newPosition = Math.max(0, scrollPosition - scrollStep);
    scrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
  };

  const handleScroll = (event: any) => {
    setScrollPosition(event.nativeEvent.contentOffset.x);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      const newZoom = Math.max(1, Math.min(4, scale.value));
      savedScale.value = newZoom;
      scale.value = newZoom;
      setZoomLevel(newZoom);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value, { damping: 20, stiffness: 90 }) }],
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text variant="h4" style={styles.title}>
            RSI (14)
          </Text>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {timeframe} • Overbought 70 / Oversold 30 • Pinch to zoom
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusPill, { backgroundColor: `${rsiColor}14`, borderColor: `${rsiColor}44` }]}>
            <Text variant="caption" style={[styles.statusText, { color: rsiColor }]}>
              {status}
            </Text>
          </View>
          <View style={[styles.valuePill, { backgroundColor: `${rsiColor}1A`, borderColor: `${rsiColor}55` }]}>
            <Text variant="caption" style={[styles.valueText, { color: rsiColor }]}>
              {Math.round(latest)}
            </Text>
          </View>
        </View>
      </View>

      <View style={frameStyle}>
        <View pointerEvents="none" style={styles.zones}>
          <View style={[styles.zoneTop, { backgroundColor: 'rgba(244, 67, 54, 0.08)' }]} />
          <View style={styles.zoneMiddle} />
          <View style={[styles.zoneBottom, { backgroundColor: 'rgba(76, 175, 80, 0.08)' }]} />
          <View style={[styles.midLine, { borderTopColor: `${theme.colors.textSecondary}18` }]} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: zoomLevel > 1 ? baseWidth * 0.5 : 0 }}
        >
          <GestureDetector gesture={pinchGesture}>
            <Animated.View style={animatedStyle}>
              <LineChart
                data={data}
                width={chartWidth}
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
                  fillShadowGradientOpacity: 0.08,
                  propsForLabels: {
                    fontSize: 10,
                    fontWeight: '700',
                  },
                  propsForDots: {
                    r: '0',
                  },
                  propsForBackgroundLines: {
                    stroke: `${theme.colors.border}44`,
                    strokeDasharray: '3 12',
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
            </Animated.View>
          </GestureDetector>
        </ScrollView>

        {zoomLevel > 1 && (
          <View style={styles.scrollControls}>
            <TouchableOpacity
              onPress={handleScrollBackward}
              style={[styles.scrollButton, { backgroundColor: `${theme.colors.surface}DD`, borderColor: theme.colors.border }]}
              activeOpacity={0.7}
            >
              <Icon name="chevron-back" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleScrollForward}
              style={[styles.scrollButton, { backgroundColor: `${theme.colors.surface}DD`, borderColor: theme.colors.border }]}
              activeOpacity={0.7}
            >
              <Icon name="chevron-forward" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        <View pointerEvents="none" style={styles.levelLabels}>
          <View style={[styles.levelLabel, styles.levelLabelTop, { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: 'rgba(244, 67, 54, 0.4)' }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: '#f44336' }]}>70</Text>
          </View>
          <View style={[styles.levelLabel, styles.levelLabelMid, { backgroundColor: `${theme.colors.surface}DD`, borderColor: `${theme.colors.border}88` }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: theme.colors.textSecondary }]}>50</Text>
          </View>
          <View style={[styles.levelLabel, styles.levelLabelBottom, { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: 'rgba(76, 175, 80, 0.4)' }]}>
            <Text variant="caption" style={[styles.levelLabelText, { color: '#4CAF50' }]}>30</Text>
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
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    letterSpacing: 0.3,
    fontSize: 10,
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
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusText: {
    fontWeight: '900',
    letterSpacing: 0.3,
    fontSize: 10,
  },
  valuePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valueText: {
    fontWeight: '900',
    letterSpacing: 0.3,
    fontSize: 14,
  },
  scrollControls: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  scrollButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
