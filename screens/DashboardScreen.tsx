import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import PriceCard from '../components/PriceCard';
import { mockCurrencyPairs } from '../data/mockData';

type TabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<TabNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [pairs, setPairs] = useState(mockCurrencyPairs);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setPairs(mockCurrencyPairs);
      setRefreshing(false);
    }, 1000);
  }, []);

  const totalBalance = 10000;
  const totalProfit = 245.50;
  const profitPercent = 2.46;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Card */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.headerCard}
        >
          <Text style={styles.headerTitle}>Portfolio Balance</Text>
          <Text style={styles.balanceAmount}>${totalBalance.toLocaleString()}</Text>
          <View style={styles.profitContainer}>
            <Icon
              name={totalProfit >= 0 ? 'trending-up' : 'trending-down'}
              size={20}
              color={totalProfit >= 0 ? '#4CAF50' : '#f44336'}
            />
            <Text
              style={[
                styles.profitText,
                { color: totalProfit >= 0 ? '#4CAF50' : '#f44336' },
              ]}
            >
              ${totalProfit.toFixed(2)} ({profitPercent}%)
            </Text>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Open Positions</Text>
            <Text style={styles.statValue}>5</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Margin Used</Text>
            <Text style={styles.statValue}>$2,450</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Free Margin</Text>
            <Text style={styles.statValue}>$7,550</Text>
          </View>
        </View>

        {/* Popular Pairs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Pairs</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Charts')}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {pairs.slice(0, 5).map((pair) => (
            <PriceCard
              key={pair.id}
              pair={pair}
              onPress={() =>
                navigation.navigate('ChartDetail', { pair: pair.symbol })
              }
            />
          ))}
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
  headerCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 14,
    color: '#9e9e9e',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  profitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4CAF50',
  },
});

