import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text } from '../../components/common';
import { mockAIRecommendations, mockMarketAlerts } from '../../constants/marketData';
import AIRecommendationCard from '../../components/market/AIRecommendationCard';
import { MarketAlertCard } from '../../components/market/MarketAlertCard';
import { useTheme } from '../../hooks';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ai' | 'alerts'>('all');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const ai = mockAIRecommendations;
  const alerts = mockMarketAlerts;

  const feed =
    filter === 'ai'
      ? ai.map((r) => ({ kind: 'ai' as const, id: r.id, data: r }))
      : filter === 'alerts'
        ? alerts.map((a) => ({ kind: 'alert' as const, id: a.id, data: a }))
        : [
            ...alerts.map((a) => ({ kind: 'alert' as const, id: a.id, data: a })),
            ...ai.map((r) => ({ kind: 'ai' as const, id: r.id, data: r })),
          ].sort((x, y) => {
            const xRank = x.kind === 'alert' ? (x.data.minutesAgo ?? 9999) : 9999;
            const yRank = y.kind === 'alert' ? (y.data.minutesAgo ?? 9999) : 9999;
            return xRank - yRank;
          });

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Live Feed</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Text variant="bodySmall" color={theme.colors.primary}>
                Alerts
              </Text>
            </TouchableOpacity>
          </View>

          <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.helperText}>
            Tap any pair to view detailed insights, including momentum and RSI overbought/oversold levels.
          </Text>

          <View style={[styles.filtersRow, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              activeOpacity={0.8}
              style={[
                styles.filterChip,
                filter === 'all' && { backgroundColor: `${theme.colors.primary}25` },
              ]}
            >
              <Text
                variant="bodySmall"
                color={filter === 'all' ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.filterChipText}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('ai')}
              activeOpacity={0.8}
              style={[
                styles.filterChip,
                filter === 'ai' && { backgroundColor: `${theme.colors.primary}25` },
              ]}
            >
              <Text
                variant="bodySmall"
                color={filter === 'ai' ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.filterChipText}
              >
                AI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('alerts')}
              activeOpacity={0.8}
              style={[
                styles.filterChip,
                filter === 'alerts' && { backgroundColor: `${theme.colors.primary}25` },
              ]}
            >
              <Text
                variant="bodySmall"
                color={filter === 'alerts' ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.filterChipText}
              >
                Alerts
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.feedList}>
            {feed.map((item) =>
              item.kind === 'alert' ? (
                <MarketAlertCard
                  key={`a-${item.id}`}
                  alert={item.data}
                  onPress={() => navigation.navigate('CurrencyDetail', { pair: item.data.pair })}
                />
              ) : (
                <AIRecommendationCard
                  key={`r-${item.id}`}
                  recommendation={item.data}
                  onPress={() => navigation.navigate('CurrencyDetail', { pair: item.data.pair })}
                />
              )
            )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  helperText: {
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 18,
  },
  filtersRow: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 14,
    marginBottom: 14,
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontWeight: '700',
  },
  feedList: {
    paddingBottom: 10,
  },
});

