import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { CurrencyPairCard } from '../../components/market';
import { Text } from '../../components/common';
import { mockCurrencyPairs } from '../../constants/marketData';
import { useTheme } from '../../hooks';
import { formatCurrency, formatPercent } from '../../utils';
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
  const [pairs, setPairs] = useState(mockCurrencyPairs);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setPairs(mockCurrencyPairs);
      setRefreshing(false);
    }, 1000);
  }, []);

  const totalBalance = 10000;
  const totalProfit = 245.50;
  const profitPercent = 2.46;

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          {/* Header Card */}
          <LinearGradient colors={[theme.colors.surface, theme.colors.surfaceLight]} style={styles.headerCard}>
            <Text variant="caption" color={theme.colors.textSecondary}>Portfolio Balance</Text>
            <Text variant="h1" style={styles.balanceAmount}>
              ${formatCurrency(totalBalance, 0)}
            </Text>
            <View style={styles.profitContainer}>
              <Icon
                name={totalProfit >= 0 ? 'trending-up' : 'trending-down'}
                size={20}
                color={totalProfit >= 0 ? theme.colors.success : theme.colors.error}
              />
              <Text
                variant="body"
                color={totalProfit >= 0 ? theme.colors.success : theme.colors.error}
                style={styles.profitText}
              >
                ${totalProfit.toFixed(2)} ({formatPercent(profitPercent)})
              </Text>
            </View>
          </LinearGradient>

          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Text variant="caption" color={theme.colors.textSecondary}>Open Positions</Text>
              <Text variant="h4">5</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Text variant="caption" color={theme.colors.textSecondary}>Margin Used</Text>
              <Text variant="h4">$2,450</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Text variant="caption" color={theme.colors.textSecondary}>Free Margin</Text>
              <Text variant="h4">$7,550</Text>
            </View>
          </View>

          {/* Popular Pairs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="h3">Popular Pairs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Market')}>
                <Text variant="bodySmall" color={theme.colors.primary}>See All</Text>
              </TouchableOpacity>
            </View>
            {pairs.slice(0, 5).map((pair) => (
              <CurrencyPairCard
                key={pair.id}
                pair={pair}
                onPress={() => navigation.navigate('CurrencyDetail', { pair: pair.symbol })}
              />
            ))}
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
  headerCard: {
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
  },
  balanceAmount: {
    marginVertical: 12,
  },
  profitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profitText: {
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
});

