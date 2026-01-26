import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { PriceChart, RSIChart } from '../../components/charts';
import { Card, Text, Tabs } from '../../components/common';
import AIRecommendationCard from '../../components/market/AIRecommendationCard';
import { useAIRecommendation, useMarketData, useTheme } from '../../hooks';
import { formatPrice, formatPercent, formatNumber } from '../../utils';
import { APP_CONFIG } from '../../config';

type CurrencyDetailRouteProp = RouteProp<RootStackParamList, 'CurrencyDetail'>;

export default function CurrencyDetailScreen() {
  const route = useRoute<CurrencyDetailRouteProp>();
  const theme = useTheme();
  const { pair } = route.params;
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  const { pairs, loading, error } = useMarketData(APP_CONFIG.refreshInterval);

  // Debug logs
  console.log('[CurrencyDetail] route pair:', pair);
  console.log('[CurrencyDetail] pairs length:', pairs.length);
  console.log('[CurrencyDetail] first 3 symbols:', pairs.slice(0, 3).map(p => p.symbol));

  const currencyPair = pairs.find((p) => p.symbol === pair) || pairs[0] || null;
  console.log('[CurrencyDetail] resolved currencyPair:', currencyPair?.symbol);
  const recommendationOptions = useMemo(
    () => ({
      timeframe: selectedTimeframe,
      currentPrice: currencyPair?.price,
      change: currencyPair?.change,
      changePercent: currencyPair?.changePercent,
      riskPercent: 1,
    }),
    [selectedTimeframe, currencyPair?.price, currencyPair?.change, currencyPair?.changePercent],
  );

  const {
    recommendation: aiRecommendation,
    loading: aiLoading,
    error: aiError,
  } = useAIRecommendation(pair, recommendationOptions);

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
              <Text variant="h2">{currencyPair.symbol}</Text>
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

          <View style={styles.aiContainer}>
            <Text variant="h4" style={styles.aiTitle}>
              AI Recommendation
            </Text>
            {aiLoading ? (
              <Card style={[styles.aiEmptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <ActivityIndicator size="small" />
              </Card>
            ) : aiRecommendation ? (
              <AIRecommendationCard recommendation={aiRecommendation} />
            ) : aiError ? (
              <Card style={[styles.aiEmptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  {aiError}
                </Text>
              </Card>
            ) : (
              <Card style={[styles.aiEmptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  No AI recommendation is available for this pair yet.
                </Text>
              </Card>
            )}
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
  aiContainer: {
    marginBottom: 16,
  },
  aiTitle: {
    fontWeight: '800',
    marginBottom: 10,
  },
  aiEmptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
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
