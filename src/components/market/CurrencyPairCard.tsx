import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { CurrencyPair } from '../../types/market';
import { Card } from '../common/Card';
import { Text } from '../common/Text';
import { colors, spacing } from '../../theme';
import { formatPrice, formatPercent, getPriceColor } from '../../utils';

interface CurrencyPairCardProps {
  pair: CurrencyPair;
  onPress?: () => void;
}

export const CurrencyPairCard: React.FC<CurrencyPairCardProps> = ({
  pair,
  onPress,
}) => {
  const isPositive = pair.change >= 0;
  const changeColor = getPriceColor(pair.change);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text variant="h4" style={styles.symbol}>{pair.symbol}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {pair.base} / {pair.quote}
          </Text>
        </View>
        <View style={styles.rightSection}>
          <Text variant="body" style={styles.price}>
            ${formatPrice(pair.price)}
          </Text>
          <View style={styles.changeContainer}>
            <Icon
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={16}
              color={changeColor}
            />
            <Text variant="bodySmall" color={changeColor} style={styles.change}>
              {formatPercent(pair.changePercent)}
            </Text>
          </View>
        </View>
        {onPress && (
          <Icon name="chevron-right" size={24} color={colors.textSecondary} />
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
  },
  symbol: {
    marginBottom: spacing.xs,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  price: {
    marginBottom: spacing.xs,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  change: {
    fontWeight: '600',
  },
});

