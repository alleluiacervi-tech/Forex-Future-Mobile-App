import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, RootStackParamList } from '../../types';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';
import { Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { MarketAlertCard } from '../../components/market/MarketAlertCard';
import { useMarketAlerts, useMarketData, useTheme } from '../../hooks';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { APP_CONFIG } from '../../config';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const { isMarketOpen } = useMarketData(APP_CONFIG.refreshInterval);
  const { alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useMarketAlerts({
    limit: 50,
    pollMs: 15000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAlerts();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAlerts]);

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Live Feed</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Text variant="bodySmall" color={theme.colors.primary}>
                Alerts
              </Text>
            </TouchableOpacity>
          </View>

          <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.helperText}>
            {isMarketOpen
              ? 'Smart alerts surface fast market moves so you can react without watching charts all day.'
              : 'Market is closed right now. Alerts and prices remain frozen until reopen.'}
          </Text>

          <View style={styles.feedList}>
            {alerts.length === 0 ? (
              <EmptyState
                icon="notifications-none"
                title="No Alerts Yet"
                message={
                  alertsError
                    ? `Unable to load alerts: ${alertsError}`
                    : alertsLoading
                      ? 'Monitoring markets for big moves...'
                      : "When the market makes a big move, it will show up here."
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
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  helperText: {
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 18,
  },
  feedList: {
    paddingBottom: 10,
  },
});
