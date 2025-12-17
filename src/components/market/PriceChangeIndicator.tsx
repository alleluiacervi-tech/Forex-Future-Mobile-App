import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Text';
import { getPriceColor } from '../../utils';
import { formatPercent } from '../../utils';

interface PriceChangeIndicatorProps {
  change: number;
  changePercent: number;
  size?: 'small' | 'medium' | 'large';
}

export const PriceChangeIndicator: React.FC<PriceChangeIndicatorProps> = ({
  change,
  changePercent,
  size = 'medium',
}) => {
  const isPositive = change >= 0;
  const color = getPriceColor(change);
  const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;
  const fontSize = size === 'small' ? 12 : size === 'large' ? 18 : 14;

  return (
    <View style={styles.container}>
      <Icon
        name={isPositive ? 'trending-up' : 'trending-down'}
        size={iconSize}
        color={color}
      />
      <Text variant="bodySmall" color={color} style={[styles.text, { fontSize }]}>
        {formatPercent(changePercent)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontWeight: '600',
  },
});

