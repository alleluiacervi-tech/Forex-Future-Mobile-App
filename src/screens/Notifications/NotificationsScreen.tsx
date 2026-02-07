import React, { useCallback, useState } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';
import { Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { MarketAlertCard } from '../../components/market/MarketAlertCard';
import { useMarketAlerts } from '../../hooks';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Notifications'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const { alerts, loading, error, refetch } = useMarketAlerts({ limit: 100, pollMs: 15000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <Text variant="h3" style={styles.title}>
            Notifications
          </Text>
          {alerts.length === 0 ? (
            <EmptyState
              icon="notifications-none"
              title="No Notifications"
              message={
                error
                  ? `Unable to load alerts: ${error}`
                  : loading
                    ? 'Monitoring markets for big moves...'
                    : "You don't have any notifications yet"
              }
            />
          ) : (
            alerts.map((a) => (
              <MarketAlertCard
                key={a.id}
                alert={a}
                onPress={() => navigation.navigate('CurrencyDetail', { pair: a.pair })}
              />
            ))
          )}
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  title: {
    marginBottom: 12,
  },
});
