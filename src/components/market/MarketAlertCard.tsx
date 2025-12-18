import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Card } from '../common/Card';
import { Text } from '../common/Text';
import { useTheme } from '../../hooks';
import type { MarketAlert, MarketAlertType } from '../../types/alerts';

interface MarketAlertCardProps {
  alert: MarketAlert;
  onPress?: () => void;
}

export const MarketAlertCard: React.FC<MarketAlertCardProps> = ({ alert, onPress }) => {
  const theme = useTheme();

  const getTypeLabel = (type: MarketAlertType) => {
    switch (type) {
      case 'PRICE_ALERT':
        return 'PRICE ALERT';
      case 'VOLATILITY':
        return 'VOLATILITY';
      case 'MARKET_NEWS':
        return 'MARKET NEWS';
      default:
        return 'ALERT';
    }
  };

  const getTypeIcon = (type: MarketAlertType) => {
    switch (type) {
      case 'PRICE_ALERT':
        return 'bolt';
      case 'VOLATILITY':
        return 'show-chart';
      case 'MARKET_NEWS':
        return 'newspaper';
      default:
        return 'notifications';
    }
  };

  const getTypeColor = (type: MarketAlertType) => {
    switch (type) {
      case 'PRICE_ALERT':
        return theme.colors.warning;
      case 'VOLATILITY':
        return theme.colors.primary;
      case 'MARKET_NEWS':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const changeColor =
    typeof alert.changePercent === 'number'
      ? alert.changePercent >= 0
        ? theme.colors.success
        : theme.colors.error
      : theme.colors.textSecondary;

  return (
    <Card onPress={onPress} style={[styles.card, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <Text variant="h4" style={styles.pairText}>
            {alert.pair}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: `${getTypeColor(alert.type)}20` },
              ]}
            >
              <Icon
                name={getTypeIcon(alert.type)}
                size={14}
                color={getTypeColor(alert.type)}
              />
              <Text
                variant="caption"
                style={[styles.badgeText, { color: getTypeColor(alert.type) }]}
              >
                {getTypeLabel(alert.type)}
              </Text>
            </View>
            {alert.timeframe ? (
              <Text variant="caption" color={theme.colors.textSecondary}>
                {alert.timeframe}
              </Text>
            ) : null}
            {typeof alert.minutesAgo === 'number' ? (
              <Text variant="caption" color={theme.colors.textSecondary}>
                {alert.minutesAgo}m ago
              </Text>
            ) : null}
          </View>
        </View>

        {typeof alert.changePercent === 'number' ? (
          <View style={styles.rightHeader}>
            <Text variant="bodySmall" color={changeColor} style={styles.changeText}>
              {alert.changePercent >= 0 ? '+' : ''}
              {alert.changePercent.toFixed(2)}%
            </Text>
          </View>
        ) : null}
      </View>

      <Text variant="body" style={styles.title}>
        {alert.title}
      </Text>
      <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.message}>
        {alert.message}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  leftHeader: {
    flex: 1,
    paddingRight: 12,
  },
  rightHeader: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  pairText: {
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 10,
  },
  changeText: {
    fontWeight: '700',
  },
  title: {
    fontWeight: '600',
    marginBottom: 6,
  },
  message: {
    lineHeight: 18,
  },
});
