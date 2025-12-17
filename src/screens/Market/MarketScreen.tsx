import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import { CurrencyPairCard } from '../../components/market';
import { Tabs } from '../../components/common';
import { mockCurrencyPairs } from '../../constants/marketData';
import { MAJOR_PAIRS } from '../../constants/forexPairs';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedFilter, setSelectedFilter] = useState('All');

  const filters = ['All', 'Major', 'Minor', 'Exotic'];

  const filteredPairs =
    selectedFilter === 'All'
      ? mockCurrencyPairs
      : selectedFilter === 'Major'
      ? mockCurrencyPairs.filter((pair) => MAJOR_PAIRS.includes(pair.symbol))
      : mockCurrencyPairs;

  return (
    <ScreenWrapper>
      <Container>
        <Tabs tabs={filters} activeTab={selectedFilter} onTabChange={setSelectedFilter} />
        <FlatList
          data={filteredPairs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CurrencyPairCard
              pair={item}
              onPress={() => navigation.navigate('CurrencyDetail', { pair: item.symbol })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Container>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 16,
  },
});

