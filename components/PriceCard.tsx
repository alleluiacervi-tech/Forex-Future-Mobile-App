import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CurrencyPair } from '../types';

interface PriceCardProps {
  pair: CurrencyPair;
  onPress?: () => void;
}

export default function PriceCard({ pair, onPress }: PriceCardProps) {
  const isPositive = pair.change >= 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <Text style={styles.symbol}>{pair.symbol}</Text>
        <Text style={styles.baseQuote}>
          {pair.base} / {pair.quote}
        </Text>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.price}>${pair.price.toFixed(5)}</Text>
        <View style={styles.changeContainer}>
          <Icon
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={16}
            color={isPositive ? '#4CAF50' : '#f44336'}
          />
          <Text
            style={[
              styles.change,
              { color: isPositive ? '#4CAF50' : '#f44336' },
            ]}
          >
            {isPositive ? '+' : ''}
            {pair.changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
      {onPress && (
        <Icon name="chevron-right" size={24} color="#9e9e9e" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  leftSection: {
    flex: 1,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  baseQuote: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
});

