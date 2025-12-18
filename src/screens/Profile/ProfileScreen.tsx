import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Tabs, Text } from '../../components/common';
import { mockTrades } from '../../constants/marketData';
import { useTheme } from '../../hooks';
import { formatCurrency, formatPrice, formatDate } from '../../utils';

export default function ProfileScreen() {
  const theme = useTheme();
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
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <Container>
          {/* Portfolio Summary */}
          <LinearGradient
            colors={[theme.colors.surface, theme.colors.surfaceLight]}
            style={styles.summaryCard}
          >
            <Text variant="h3" style={styles.summaryTitle}>Account Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text variant="caption" color={theme.colors.textSecondary}>Balance</Text>
                <Text variant="h4">${formatCurrency(portfolio.balance, 0)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption" color={theme.colors.textSecondary}>Equity</Text>
                <Text variant="h4" color={theme.colors.success}>
                  ${formatCurrency(portfolio.equity, 0)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text variant="caption" color={theme.colors.textSecondary}>Margin Used</Text>
                <Text variant="h4">${formatCurrency(portfolio.margin, 0)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption" color={theme.colors.textSecondary}>Free Margin</Text>
                <Text variant="h4">${formatCurrency(portfolio.freeMargin, 0)}</Text>
              </View>
            </View>
            <View style={styles.marginLevelContainer}>
              <Text variant="caption" color={theme.colors.textSecondary}>Margin Level</Text>
              <Text variant="h2" color={theme.colors.success}>
                {portfolio.marginLevel.toFixed(2)}%
              </Text>
            </View>
          </LinearGradient>

          {/* Tabs */}
          <Tabs
            tabs={[`Open Positions (${openPositions.length})`, `History (${closedPositions.length})`]}
            activeTab={activeTab === 'positions' ? `Open Positions (${openPositions.length})` : `History (${closedPositions.length})`}
            onTabChange={(tab) => setActiveTab(tab.includes('Open') ? 'positions' : 'history')}
          />

          {/* Positions/History List */}
          <View style={styles.listContainer}>
            {(activeTab === 'positions' ? openPositions : closedPositions).map((trade) => (
              <Card key={trade.id} style={styles.tradeCard}>
                <View style={styles.tradeHeader}>
                  <View>
                    <Text variant="h4">{trade.pair}</Text>
                    <Text variant="caption" color={theme.colors.textSecondary}>
                      {trade.type.toUpperCase()} • {trade.amount} lots
                    </Text>
                  </View>
                  <View style={styles.tradePriceContainer}>
                    <Text variant="body">${formatPrice(trade.price)}</Text>
                    {trade.profit !== undefined && (
                      <Text
                        variant="body"
                        color={trade.profit >= 0 ? theme.colors.success : theme.colors.error}
                        style={styles.tradeProfit}
                      >
                        {trade.profit >= 0 ? '+' : ''}${formatCurrency(trade.profit)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.tradeFooter}>
                  <Text variant="caption" color={theme.colors.textSecondary}>
                    {formatDate(trade.timestamp)}
                  </Text>
                  {activeTab === 'positions' && (
                    <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.error }]}>
                      <Text variant="caption" color={theme.colors.text}>Close</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
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
  summaryCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  summaryTitle: {
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
  marginLevelContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  listContainer: {
    marginTop: 16,
  },
  tradeCard: {
    marginBottom: 12,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tradePriceContainer: {
    alignItems: 'flex-end',
  },
  tradeProfit: {
    marginTop: 4,
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
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    // Handled by inline style
  },
});

