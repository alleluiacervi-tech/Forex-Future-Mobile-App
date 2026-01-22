import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { ScreenWrapper, Container } from '../../components/layout';
import TopNavBar from '../../components/navigation/TopNavBar';
import { CurrencyPairCard } from '../../components/market';
import { Tabs, Text } from '../../components/common';
import { MAJOR_PAIRS } from '../../constants/forexPairs';
import { useMarketData } from '../../hooks';
import { APP_CONFIG } from '../../config';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const { pairs, loading, error } = useMarketData(APP_CONFIG.refreshInterval);

  const filters = ['All', 'Major', 'Minor', 'Exotic'];

  const filteredPairs =
    selectedFilter === 'All'
      ? pairs
      : selectedFilter === 'Major'
      ? pairs.filter((pair) => MAJOR_PAIRS.includes(pair.symbol))
      : pairs;

  return (
    <ScreenWrapper>
      <TopNavBar />
      <Container>
        <Tabs tabs={filters} activeTab={selectedFilter} onTabChange={setSelectedFilter} />
        {loading && !pairs.length ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodySmall" style={styles.stateText}>
              Loading live market data...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text variant="bodySmall" style={styles.stateText}>
              {error}
            </Text>
          </View>
        ) : (
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
        )}
      </Container>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 16,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    textAlign: 'center',
  },
});
