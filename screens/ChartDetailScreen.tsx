import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import PriceChart from '../components/PriceChart';
import { mockCurrencyPairs } from '../data/mockData';

type ChartDetailRouteProp = RouteProp<RootStackParamList, 'ChartDetail'>;

export default function ChartDetailScreen() {
  const route = useRoute<ChartDetailRouteProp>();
  const { pair } = route.params;
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');

  const currencyPair = mockCurrencyPairs.find((p) => p.symbol === pair) || mockCurrencyPairs[0];

  const timeframes = ['1M', '5M', '15M', '1H', '4H', '1D'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Pair Info */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pairSymbol}>{currencyPair.symbol}</Text>
            <Text style={styles.pairName}>
              {currencyPair.base} / {currencyPair.quote}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>${currencyPair.price.toFixed(5)}</Text>
            <Text
              style={[
                styles.change,
                {
                  color:
                    currencyPair.change >= 0 ? '#4CAF50' : '#f44336',
                },
              ]}
            >
              {currencyPair.change >= 0 ? '+' : ''}
              {currencyPair.change.toFixed(5)} ({currencyPair.changePercent.toFixed(2)}%)
            </Text>
          </View>
        </View>

        {/* Timeframe Selector */}
        <View style={styles.timeframeContainer}>
          {timeframes.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[
                styles.timeframeButton,
                selectedTimeframe === tf && styles.timeframeButtonActive,
              ]}
              onPress={() => setSelectedTimeframe(tf)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  selectedTimeframe === tf && styles.timeframeTextActive,
                ]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <PriceChart pair={currencyPair} timeframe={selectedTimeframe} />
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h High</Text>
            <Text style={styles.statValue}>
              ${currencyPair.high24h.toFixed(5)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h Low</Text>
            <Text style={styles.statValue}>
              ${currencyPair.low24h.toFixed(5)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h Volume</Text>
            <Text style={styles.statValue}>
              {currencyPair.volume24h.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
    marginBottom: 16,
  },
  pairSymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  pairName: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeframeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  timeframeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  timeframeText: {
    color: '#9e9e9e',
    fontSize: 12,
    fontWeight: '500',
  },
  timeframeTextActive: {
    color: '#fff',
  },
  chartContainer: {
    height: 300,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9e9e9e',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

