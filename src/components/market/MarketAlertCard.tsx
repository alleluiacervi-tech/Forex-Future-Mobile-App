import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Text } from '../common/Text';
import { useTheme } from '../../hooks';
import type { MarketAlert, MarketAlertType } from '../../types/alerts';

interface MarketAlertCardProps {
  alert: MarketAlert;
  onPress?: () => void;
  expanded?: boolean;
}

const decimalsForPair = (pair: string) => (pair.includes('JPY') ? 3 : 5);

const formatPrice = (pair: string, price: number | undefined) => {
  const normalizedPrice = Number(price);
  if (!Number.isFinite(normalizedPrice)) return 'N/A';
  const decimals = decimalsForPair(pair);
  return normalizedPrice.toFixed(decimals);
};

export const MarketAlertCard: React.FC<MarketAlertCardProps> = ({ alert, onPress, expanded = false }) => {
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

  const severityColor = (() => {
    const severity = (alert.severity || 'medium').toLowerCase();
    if (severity.includes('high') || severity.includes('maximum')) return theme.colors.error;
    if (severity.includes('very')) return theme.colors.warning;
    if (severity.includes('moderate')) return theme.colors.warning;
    return theme.colors.primary;
  })();

  const changeColor =
    typeof alert.changePercent === 'number'
      ? alert.changePercent >= 0
        ? theme.colors.success
        : theme.colors.error
      : theme.colors.textSecondary;

  const containerStyle = alert.velocity
    ? [styles.card, { backgroundColor: theme.colors.surface, borderLeftColor: severityColor, borderLeftWidth: 4 }]
    : [styles.card, { backgroundColor: theme.colors.surface }];

  // Detailed sections (shown expanded)
  const velocityDisplay = alert.velocity ? (
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <Text variant="caption" style={styles.sectionLabel}>
        ⚡ Velocity Metrics
      </Text>
      <View style={styles.row}>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          Signal:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
            {alert.velocity.signal}
          </Text>
        </Text>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          {Number(alert.velocity.pipsPerSecond ?? 0).toFixed(2)} pips/sec
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          Accel:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
            {(Number(alert.velocity.accelerationRatio ?? 0) * 100).toFixed(0)}%
          </Text>
        </Text>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          {alert.velocity.windowDetected}
        </Text>
      </View>
    </View>
  ) : null;

  const priceDisplay =
    alert.fromPrice != null || alert.toPrice != null ? (
      <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
        <Text variant="caption" style={styles.sectionLabel}>
          Price Move
        </Text>
        <View style={styles.row}>
          <Text variant="bodySmall" color={theme.colors.textSecondary}>
            From:{' '}
            <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
              {formatPrice(alert.pair, alert.fromPrice)}
            </Text>
          </Text>
          <Text variant="bodySmall" color={theme.colors.textSecondary}>
            To:{' '}
            <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
              {formatPrice(alert.pair, alert.toPrice)}
            </Text>
          </Text>
        </View>
      </View>
    ) : null;

  const levelsDisplay = alert.levels ? (
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <Text variant="caption" style={styles.sectionLabel}>
        📊 Trade Levels
      </Text>
      <View style={styles.row}>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          Entry:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
            {formatPrice(alert.pair, alert.levels.entry)}
          </Text>
        </Text>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          SL:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.error, fontWeight: '600' }}>
            {formatPrice(alert.pair, alert.levels.stopLoss)}
          </Text>
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          TP:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.success, fontWeight: '600' }}>
            {formatPrice(alert.pair, alert.levels.takeProfit)}
          </Text>
        </Text>
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          R:R:{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.text, fontWeight: '600' }}>
            {Number(alert.levels.riskReward ?? 0).toFixed(1)}:1
          </Text>
        </Text>
      </View>
    </View>
  ) : null;

  const confidenceDisplay = alert.confidence ? (
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <Text variant="caption" style={styles.sectionLabel}>
        🎯 Confidence: {alert.confidence.label}
      </Text>
      <View style={styles.row}>
        <View style={[styles.scoreBar, { backgroundColor: severityColor }]} />
        <Text variant="bodySmall" color={theme.colors.textSecondary}>
          {alert.confidence.score}% confidence
        </Text>
      </View>
      {alert.confidence.factors && alert.confidence.factors.length > 0 ? (
        <Text variant="caption" color={theme.colors.textSecondary} style={styles.factors}>
          Factors: {alert.confidence.factors.slice(0, 3).join(', ')}
          {alert.confidence.factors.length > 3 ? '...' : ''}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <Card onPress={onPress} style={containerStyle}>
      {/* Header Section */}
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

      {/* Title & Message */}
      <Text variant="body" style={styles.title}>
        {alert.title}
      </Text>
      <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.message}>
        {alert.message}
      </Text>

      {/* Expanded Details (conditional) */}
      {expanded && (
        <View>
          {velocityDisplay}
          {priceDisplay}
          {levelsDisplay}
          {confidenceDisplay}
        </View>
      )}
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
    marginBottom: 8,
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sectionLabel: {
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreBar: {
    width: 6,
    height: 12,
    borderRadius: 3,
    marginRight: 8,
  },
  factors: {
    marginTop: 6,
    fontStyle: 'italic',
  },
});
