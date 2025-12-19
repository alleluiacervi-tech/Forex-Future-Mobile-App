import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { PriceChart, RSIChart } from '../../components/charts';
import { Card, Text, Tabs } from '../../components/common';
import { mockCurrencyPairs } from '../../constants/marketData';
import { useTheme } from '../../hooks';
import { formatPrice, formatPercent, formatNumber } from '../../utils';

type CurrencyDetailRouteProp = RouteProp<RootStackParamList, 'CurrencyDetail'>;

export default function CurrencyDetailScreen() {
  const route = useRoute<CurrencyDetailRouteProp>();
  const theme = useTheme();
  const { pair } = route.params;
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');

  const currencyPair = mockCurrencyPairs.find((p) => p.symbol === pair) || mockCurrencyPairs[0];

  const timeframes = ['1M', '5M', '15M', '1H', '4H', '1D'];

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

          <Card style={[styles.insightsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.insightsTitle}>
              Institutional Insights
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.insightsBody}>
              These analytics are designed to support smart financial decision-making. Evaluate trend strength, volatility,
              and momentum across multiple timeframes. RSI highlights potential overbought/oversold conditions; confirm with
              structure and risk parameters.
            </Text>
          </Card>

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
  priceContainer: {
    alignItems: 'flex-end',
  },
  chartContainer: {
    height: 300,
    marginVertical: 16,
    borderRadius: 12,
    padding: 16,
  },
  insightsCard: {
    marginTop: 4,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  insightsTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },
  insightsBody: {
    lineHeight: 18,
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
});

