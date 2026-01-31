import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Text } from '../common';
import { useTheme } from '../../hooks';
import { AIRecommendation, RecommendationType } from '../../types/ai';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  onPress?: () => void;
}

export default function AIRecommendationCard({ recommendation, onPress }: AIRecommendationCardProps) {
  const theme = useTheme();

  const getRecommendationColor = (rec: RecommendationType) => {
    switch (rec) {
      case 'BUY':
        return theme.colors.success;
      case 'SELL':
        return theme.colors.error;
      case 'WAIT':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getRecommendationIcon = (rec: RecommendationType) => {
    switch (rec) {
      case 'BUY':
        return 'trending-up';
      case 'SELL':
        return 'trending-down';
      case 'WAIT':
        return 'schedule';
      default:
        return 'help-outline';
    }
  };

  const getRecommendationText = (rec: RecommendationType) => {
    switch (rec) {
      case 'BUY':
        return 'BUY SIGNAL';
      case 'SELL':
        return 'SELL SIGNAL';
      case 'WAIT':
        return 'WAIT & MONITOR';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <Card onPress={onPress} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.pairContainer}>
            <Text variant="h4" style={styles.pairText}>
              {recommendation.pair}
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary}>
              {recommendation.timeframe}
            </Text>
          </View>
          <View style={[styles.recommendationBadge, { backgroundColor: getRecommendationColor(recommendation.recommendation) + '20' }]}>
            <Icon
              name={getRecommendationIcon(recommendation.recommendation)}
              size={16}
              color={getRecommendationColor(recommendation.recommendation)}
            />
            <Text
              variant="caption"
              style={[styles.recommendationText, { color: getRecommendationColor(recommendation.recommendation) }]}
            >
              {getRecommendationText(recommendation.recommendation)}
            </Text>
          </View>
        </View>

        <View style={styles.confidenceContainer}>
          <Text variant="caption" color={theme.colors.textSecondary}>
            Confidence: {recommendation.confidence}%
          </Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${recommendation.confidence}%`,
                  backgroundColor: getRecommendationColor(recommendation.recommendation),
                },
              ]}
            />
          </View>
        </View>

        <Text variant="body" style={styles.insight}>
          {recommendation.insight}
        </Text>

        {/* Institutional fields */}
        {(recommendation.rationale || recommendation.invalidation || recommendation.assumptions) && (
          <View style={styles.institutionalContainer}>
            {recommendation.rationale && (
              <View style={styles.fieldBlock}>
                <Text variant="caption" color={theme.colors.textSecondary} style={styles.fieldLabel}>
                  Rationale
                </Text>
                <Text variant="bodySmall">{recommendation.rationale}</Text>
              </View>
            )}
            {recommendation.invalidation && (
              <View style={styles.fieldBlock}>
                <Text variant="caption" color={theme.colors.textSecondary} style={styles.fieldLabel}>
                  Invalidation
                </Text>
                <Text variant="bodySmall" color={theme.colors.error}>{recommendation.invalidation}</Text>
              </View>
            )}
            {recommendation.assumptions && (
              <View style={styles.fieldBlock}>
                <Text variant="caption" color={theme.colors.textSecondary} style={styles.fieldLabel}>
                  Assumptions
                </Text>
                <Text variant="bodySmall">{recommendation.assumptions}</Text>
              </View>
            )}
          </View>
        )}

        {recommendation.keyLevels && recommendation.keyLevels.length > 0 && (
          <View style={styles.fieldBlock}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.fieldLabel}>
              Key Levels
            </Text>
            <Text variant="bodySmall">{recommendation.keyLevels.map(l => l.toFixed(4)).join(', ')}</Text>
          </View>
        )}

        {(recommendation.entryPrice || recommendation.targetPrice || recommendation.stopLoss) && (
          <View style={styles.levelsContainer}>
            {recommendation.entryPrice && (
              <View style={styles.level}>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Entry:
                </Text>
                <Text variant="bodySmall">{recommendation.entryPrice.toFixed(4)}</Text>
              </View>
            )}
            {recommendation.targetPrice && (
              <View style={styles.level}>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Take Profit:
                </Text>
                <Text variant="bodySmall" color={theme.colors.success}>
                  {recommendation.targetPrice.toFixed(4)}
                </Text>
              </View>
            )}
            {recommendation.stopLoss && (
              <View style={styles.level}>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Stop Loss:
                </Text>
                <Text variant="bodySmall" color={theme.colors.error}>
                  {recommendation.stopLoss.toFixed(4)}
                </Text>
              </View>
            )}
            {recommendation.validityMinutes && (
              <View style={styles.level}>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Valid:
                </Text>
                <Text variant="bodySmall">{recommendation.validityMinutes}m</Text>
              </View>
            )}
          </View>
        )}
                  {recommendation.targetPrice.toFixed(4)}
                </Text>
              </View>
            )}
            {recommendation.stopLoss && (
              <View style={styles.level}>
                <Text variant="caption" color={theme.colors.textSecondary}>
                  Stop Loss:
                </Text>
                <Text variant="bodySmall" color={theme.colors.error}>
                  {recommendation.stopLoss.toFixed(4)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 0,
    borderRadius: 12,
  },
  inner: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pairContainer: {
    flex: 1,
  },
  pairText: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recommendationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  recommendationText: {
    fontWeight: 'bold',
    fontSize: 10,
  },
  confidenceContainer: {
    marginBottom: 12,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  insight: {
    lineHeight: 20,
    marginBottom: 12,
  },
  levelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  level: {
    alignItems: 'center',
    flex: 1,
  },
});