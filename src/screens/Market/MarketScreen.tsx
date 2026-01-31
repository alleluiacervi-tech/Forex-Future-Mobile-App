import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import TopNavBar from '../../components/navigation/TopNavBar';
import { CurrencyPairCard, PriceChangeIndicator } from '../../components/market';
import AIRecommendationCard from '../../components/market/AIRecommendationCard';
import LiveIndicator from '../../components/common/LiveIndicator';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { CurrencyPair } from '../../types/market';
import { PriceChart, RSIChart } from '../../components/charts';
import { Tabs, Text, Card } from '../../components/common';
import { MAJOR_PAIRS } from '../../constants/forexPairs';
import { useMarketData, useTheme, useAIRecommendation } from '../../hooks';
import { APP_CONFIG } from '../../config';
import { formatPrice, formatPercent } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedPair, setSelectedPair] = useState(null);
  const { pairs, loading, error } = useMarketData(APP_CONFIG.refreshInterval);

  // AI recommendation for selected pair
  const aiOptions = selectedPair
    ? {
        timeframe: '1H',
        currentPrice: selectedPair.price,
        change: selectedPair.change,
        changePercent: selectedPair.changePercent,
        riskPercent: 1,
      }
    : {};
  const {
    recommendation: aiRecommendation,
    loading: aiLoading,
    error: aiError,
  } = useAIRecommendation(selectedPair?.symbol || '', aiOptions);

  const filters = ['All', 'Major', 'Minor', 'Exotic'];

  const filteredPairs =
    selectedFilter === 'All'
      ? pairs
      : selectedFilter === 'Major'
      ? pairs.filter((pair) => MAJOR_PAIRS.includes(pair.symbol))
      : pairs;

  return (
    <ScreenWrapper>
      <TopNavBar />
      <Container>
        {/* Live price summary with mini charts – only when a pair is selected */}
        {selectedPair && (
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.summaryHeader}>
              <View>
                <View style={styles.summaryTitleRow}>
                  <Text variant="h4">{selectedPair.symbol}</Text>
                  <LiveIndicator size="small" />
                </View>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  {selectedPair.base} / {selectedPair.quote}
                </Text>
              </View>
              <View style={styles.summaryPrice}>
                <Text variant="h3">${formatPrice(selectedPair.price)}</Text>
                <PriceChangeIndicator
                  change={selectedPair.change}
                  changePercent={selectedPair.changePercent}
                  size="small"
                />
              </View>
              <TouchableOpacity onPress={() => setSelectedPair(null)} style={styles.closeBtn}>
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.miniCharts}>
              <View style={styles.miniChart}>
                <Text variant="caption" color={theme.colors.textSecondary}>EMA</Text>
                <PriceChart pair={selectedPair} timeframe="1H" />
              </View>
              <View style={styles.miniChart}>
                <Text variant="caption" color={theme.colors.textSecondary}>RSI</Text>
                <RSIChart basePrice={selectedPair.price} timeframe="1H" />
              </View>
            </View>
            {/* AI Recommendation */}
            <View style={styles.aiSection}>
              <Text variant="caption" color={theme.colors.textSecondary} style={styles.aiTitle}>
                AI Recommendation
              </Text>
              {aiLoading ? (
                <View style={[styles.aiEmpty, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <ActivityIndicator size="small" />
                </View>
              ) : aiRecommendation ? (
                <AIRecommendationCard recommendation={aiRecommendation} />
              ) : aiError ? (
                <View style={[styles.aiEmpty, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text variant="caption" color={theme.colors.textSecondary}>{aiError}</Text>
                </View>
              ) : (
                <View style={[styles.aiEmpty, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text variant="caption" color={theme.colors.textSecondary}>No AI recommendation available</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        <Tabs tabs={filters} activeTab={selectedFilter} onTabChange={setSelectedFilter} />
        {loading && !pairs.length ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodySmall" style={styles.stateText}>
              Loading live market data...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text variant="bodySmall" style={styles.stateText}>
              {error}
            </Text>
          </View>
        ) : (
          <ErrorBoundary>
            <FlatList
              data={filteredPairs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CurrencyPairCard
                  pair={item}
                  onPress={() => {
                    setSelectedPair(item);
                    navigation.navigate('CurrencyDetail', { pair: item.symbol });
                  }}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </ErrorBoundary>
        )}
      </Container>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryPrice: {
    alignItems: 'flex-end',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  miniCharts: {
    flexDirection: 'row',
    gap: 12,
  },
  miniChart: {
    flex: 1,
    height: 120,
  },
  aiSection: {
    marginTop: 16,
  },
  aiTitle: {
    marginBottom: 8,
  },
  aiEmpty: {
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
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
