import React, { useMemo, useState, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Generate mock chart data
  const { chartData, latest, ema20Last, ema50Last, ema200Last, trendState, ema20Color, ema50Color, ema200Color } = useMemo(() => {
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
    const baseDisplayCandles = 180;
    const displayCandles = Math.floor(baseDisplayCandles / zoomLevel);
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

    const ema20Color = '#4CAF50';
    const ema50Color = '#FFC107';
    const ema200Color = '#E0E0E0';

    return {
      chartData: {
        labels,
        datasets: [
          {
            data: ema20View,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            strokeWidth: 2.6,
          },
          {
            data: ema50View,
            color: (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
            strokeWidth: 2.4,
          },
          {
            data: ema200View,
            color: (opacity = 1) => `rgba(224, 224, 224, ${opacity * 0.85})`,
            strokeWidth: 2.2,
          },
        ],
      },
      latest,
      ema20Last,
      ema50Last,
      ema200Last,
      trendState,
      ema20Color,
      ema50Color,
      ema200Color,
    };
  }, [pair.id, pair.price, pair.symbol, theme.colors.info, theme.colors.primary, theme.colors.textSecondary, timeframe, zoomLevel]);

  const baseWidth = windowWidth - 64;
  const chartWidth = baseWidth * zoomLevel;
  const height = 240;
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

  const trendAccent =
    trendState === 'bullish' ? theme.colors.success : trendState === 'bearish' ? theme.colors.error : theme.colors.textSecondary;
  const trendLabel = trendState === 'bullish' ? 'Bullish trend' : trendState === 'bearish' ? 'Bearish trend' : 'Neutral trend';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text variant="h4" style={styles.title}>
            {pair.symbol}
          </Text>
          <Text variant="caption" color={theme.colors.textSecondary}>
            {timeframe} • EMA Analysis • Pinch to zoom
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.trendPill,
              {
                backgroundColor: `${trendAccent}14`,
                borderColor: `${trendAccent}44`,
              },
            ]}
          >
            <Text variant="caption" style={[styles.trendText, { color: trendAccent }]}>
              {trendLabel}
            </Text>
          </View>
          <View
            style={[
              styles.pricePill,
              {
                backgroundColor: `${theme.colors.primary}1A`,
                borderColor: `${theme.colors.primary}55`,
              },
            ]}
          >
            <Text variant="caption" style={[styles.priceText, { color: theme.colors.primary }]}>
              {latest.toFixed(5)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.chartFrame,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.trendWash,
            {
              backgroundColor:
                trendState === 'bullish'
                  ? `${theme.colors.success}08`
                  : trendState === 'bearish'
                  ? `${theme.colors.error}08`
                  : 'transparent',
            },
          ]}
        />

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
                data={chartData}
                width={chartWidth}
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
                    stroke: `${theme.colors.border}44`,
                    strokeDasharray: '3 12',
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

        <View pointerEvents="none" style={styles.emaLegend}>
          <View style={[styles.emaChip, { backgroundColor: 'rgba(76, 175, 80, 0.12)', borderColor: 'rgba(76, 175, 80, 0.3)' }]}>
            <View style={[styles.emaIndicator, { backgroundColor: ema20Color }]} />
            <Text variant="caption" style={[styles.emaChipText, { color: ema20Color }]}>
              EMA20
            </Text>
            <Text variant="caption" style={[styles.emaValue, { color: theme.colors.text }]}>
              {ema20Last.toFixed(5)}
            </Text>
          </View>
          <View style={[styles.emaChip, { backgroundColor: 'rgba(255, 193, 7, 0.12)', borderColor: 'rgba(255, 193, 7, 0.3)' }]}>
            <View style={[styles.emaIndicator, { backgroundColor: ema50Color }]} />
            <Text variant="caption" style={[styles.emaChipText, { color: ema50Color }]}>
              EMA50
            </Text>
            <Text variant="caption" style={[styles.emaValue, { color: theme.colors.text }]}>
              {ema50Last.toFixed(5)}
            </Text>
          </View>
          <View style={[styles.emaChip, { backgroundColor: 'rgba(224, 224, 224, 0.12)', borderColor: 'rgba(224, 224, 224, 0.3)' }]}>
            <View style={[styles.emaIndicator, { backgroundColor: ema200Color }]} />
            <Text variant="caption" style={[styles.emaChipText, { color: ema200Color }]}>
              EMA200
            </Text>
            <Text variant="caption" style={[styles.emaValue, { color: theme.colors.text }]}>
              {ema200Last.toFixed(5)}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 10,
  },
  pricePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceText: {
    fontWeight: '900',
    letterSpacing: 0.3,
    fontSize: 14,
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
    marginVertical: 0,
    borderRadius: 16,
  },
  emaLegend: {
    position: 'absolute',
    left: 12,
    top: 10,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  emaIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emaChipText: {
    fontWeight: '900',
    letterSpacing: 0.2,
    fontSize: 10,
  },
  emaValue: {
    fontWeight: '700',
    letterSpacing: 0.15,
    fontSize: 10,
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

