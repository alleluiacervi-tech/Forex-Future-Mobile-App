import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { Text } from '../common/Text';
import { CurrencyPair } from '../../types/market';
import { formatPrice, formatNumber } from '../../utils';
import { colors, spacing } from '../../theme';

interface MarketOverviewProps {
  pairs: CurrencyPair[];
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({ pairs }) => {
  const totalVolume = pairs.reduce((sum, pair) => sum + pair.volume24h, 0);
  const activePairs = pairs.length;

  return (
    <Card style={styles.card}>
      <Text variant="h3" style={styles.title}>Market Overview</Text>
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.textSecondary}>Active Pairs</Text>
          <Text variant="h4">{activePairs}</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.textSecondary}>24h Volume</Text>
          <Text variant="h4">${formatNumber(totalVolume)}</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
});

