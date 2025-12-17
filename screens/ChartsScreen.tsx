import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import PriceCard from '../components/PriceCard';
import { mockCurrencyPairs } from '../data/mockData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChartsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedFilter, setSelectedFilter] = useState('All');

  const filters = ['All', 'Major', 'Minor', 'Exotic'];

  const filteredPairs =
    selectedFilter === 'All'
      ? mockCurrencyPairs
      : mockCurrencyPairs.filter((pair) => {
          if (selectedFilter === 'Major') {
            return ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF'].includes(
              pair.symbol
            );
          }
          return true;
        });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Currency Pairs List */}
      <FlatList
        data={filteredPairs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PriceCard
            pair={item}
            onPress={() =>
              navigation.navigate('ChartDetail', { pair: item.symbol })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    color: '#9e9e9e',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

