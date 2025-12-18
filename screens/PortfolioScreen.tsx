import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { mockTrades } from '../data/mockData';

export default function PortfolioScreen() {
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');

  const portfolio = {
    balance: 10000,
    equity: 10245.50,
    margin: 2450,
    freeMargin: 7795.50,
    marginLevel: 417.78,
    openPositions: 5,
    totalProfit: 245.50,
  };

  const openPositions = mockTrades.filter((t) => !t.profit);
  const closedPositions = mockTrades.filter((t) => t.profit !== undefined);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Portfolio Summary */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.summaryCard}
        >
          <Text style={styles.summaryTitle}>Account Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={styles.summaryValue}>
                ${portfolio.balance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Equity</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                ${portfolio.equity.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Margin Used</Text>
              <Text style={styles.summaryValue}>
                ${portfolio.margin.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Free Margin</Text>
              <Text style={styles.summaryValue}>
                ${portfolio.freeMargin.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.marginLevelContainer}>
            <Text style={styles.summaryLabel}>Margin Level</Text>
            <Text style={styles.marginLevelValue}>
              {portfolio.marginLevel.toFixed(2)}%
            </Text>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'positions' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('positions')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'positions' && styles.tabTextActive,
              ]}
            >
              Open Positions ({openPositions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'history' && styles.tabTextActive,
              ]}
            >
              History ({closedPositions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Positions/History List */}
        <View style={styles.listContainer}>
          {(activeTab === 'positions' ? openPositions : closedPositions).map(
            (trade) => (
              <View key={trade.id} style={styles.tradeCard}>
                <View style={styles.tradeHeader}>
                  <View>
                    <Text style={styles.tradePair}>{trade.pair}</Text>
                    <Text style={styles.tradeType}>
                      {trade.type.toUpperCase()} • {trade.amount} lots
                    </Text>
                  </View>
                  <View style={styles.tradePriceContainer}>
                    <Text style={styles.tradePrice}>
                      ${trade.price.toFixed(5)}
                    </Text>
                    {trade.profit !== undefined && (
                      <Text
                        style={[
                          styles.tradeProfit,
                          {
                            color: trade.profit >= 0 ? '#4CAF50' : '#f44336',
                          },
                        ]}
                      >
                        {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.tradeFooter}>
                  <Text style={styles.tradeTime}>
                    {new Date(trade.timestamp).toLocaleString()}
                  </Text>
                  {activeTab === 'positions' && (
                    <TouchableOpacity style={styles.closeButton}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          )}
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
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9e9e9e',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  marginLevelContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  marginLevelValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    color: '#9e9e9e',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tradeCard: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tradePair: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  tradeType: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  tradePriceContainer: {
    alignItems: 'flex-end',
  },
  tradePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  tradeProfit: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  tradeTime: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f44336',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

