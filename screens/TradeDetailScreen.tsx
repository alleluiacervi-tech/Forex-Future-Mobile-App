import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { mockCurrencyPairs } from '../data/mockData';

type TradeDetailRouteProp = RouteProp<RootStackParamList, 'TradeDetail'>;

export default function TradeDetailScreen() {
  const route = useRoute<TradeDetailRouteProp>();
  const { pair } = route.params;

  const currencyPair = mockCurrencyPairs.find((p) => p.symbol === pair) || mockCurrencyPairs[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Trade Details</Text>
        <View style={styles.infoCard}>
          <Text style={styles.label}>Pair</Text>
          <Text style={styles.value}>{currencyPair.symbol}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.label}>Current Price</Text>
          <Text style={styles.value}>${currencyPair.price.toFixed(5)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.label}>24h Change</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  currencyPair.change >= 0 ? '#4CAF50' : '#f44336',
              },
            ]}
          >
            {currencyPair.change >= 0 ? '+' : ''}
            {currencyPair.change.toFixed(5)} ({currencyPair.changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#9e9e9e',
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

