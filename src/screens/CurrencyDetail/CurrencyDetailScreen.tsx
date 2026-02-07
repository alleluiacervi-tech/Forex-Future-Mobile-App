import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import TopNavBar from '../../components/navigation/TopNavBar';
import LiveIndicator from '../../components/common/LiveIndicator';
import { PriceChart, RSIChart } from '../../components/charts';
import { Text, Card, Tabs } from '../../components/common';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useMarketData, useTheme } from '../../hooks';
import { formatPrice, formatPercent, formatNumber } from '../../utils';
import { APP_CONFIG } from '../../config';

type CurrencyDetailRouteProp = RouteProp<RootStackParamList, 'CurrencyDetail'>;

export default function CurrencyDetailScreen() {
  const route = useRoute<CurrencyDetailRouteProp>();
  const theme = useTheme();
  const { pair } = route.params;
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  const { pairs, loading, error } = useMarketData(APP_CONFIG.refreshInterval);

  const currencyPair = pairs.find((p) => p.symbol === pair) || pairs[0] || null;

  const timeframes = ['1M', '5M', '15M', '1H', '4H', '1D'];

  if (!currencyPair) {
    return (
      <ScreenWrapper>
        <Container>
          <View style={styles.stateContainer}>
            {loading ? <ActivityIndicator size="large" /> : null}
            <Text variant="bodySmall" style={styles.stateText}>
              {error || 'Loading market data...'}
            </Text>
          </View>
        </Container>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <Container>
          {/* Pair Info */}
          <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
            <View>
              <View style={styles.titleRow}>
                <Text variant="h2">{currencyPair.symbol}</Text>
                <LiveIndicator size="medium" />
              </View>
              <Text variant="bodySmall" color={theme.colors.textSecondary}>
                {currencyPair.base} / {currencyPair.quote}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text variant="h3">${formatPrice(currencyPair.price)}</Text>
              <Text
                variant="bodySmall"
                color={currencyPair.change >= 0 ? theme.colors.success : theme.colors.error}
              >
                {currencyPair.change >= 0 ? '+' : ''}
                {formatPrice(currencyPair.change)} ({formatPercent(currencyPair.changePercent)})
              </Text>
            </View>
          </View>

          {/* Timeframe Selector */}
          <Tabs
            tabs={timeframes}
            activeTab={selectedTimeframe}
            onTabChange={setSelectedTimeframe}
          />

          {/* Chart */}
          <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
            <PriceChart pair={currencyPair} timeframe={selectedTimeframe} />
          </View>

          <View style={[styles.rsiContainer, { backgroundColor: theme.colors.surface }]}
          >
            <RSIChart basePrice={currencyPair.price} timeframe={selectedTimeframe} />
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <Card style={styles.statItem}>
              <Text variant="caption" color={theme.colors.textSecondary}>24h High</Text>
              <Text variant="body">${formatPrice(currencyPair.high24h)}</Text>
            </Card>
            <Card style={styles.statItem}>
              <Text variant="caption" color={theme.colors.textSecondary}>24h Low</Text>
              <Text variant="body">${formatPrice(currencyPair.low24h)}</Text>
            </Card>
            <Card style={styles.statItem}>
              <Text variant="caption" color={theme.colors.textSecondary}>24h Volume</Text>
              <Text variant="body">{formatNumber(currencyPair.volume24h)}</Text>
            </Card>
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  chartContainer: {
    height: 300,
    marginVertical: 16,
    borderRadius: 12,
    padding: 16,
  },
  rsiContainer: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    textAlign: 'center',
  },
});
