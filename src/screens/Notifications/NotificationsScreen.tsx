import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';
import { Text } from '../../components/common';
import { MarketAlertCard } from '../../components/market/MarketAlertCard';
import { mockMarketAlerts } from '../../constants/marketData';

export default function NotificationsScreen() {
  const alerts = mockMarketAlerts;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <Container>
          <Text variant="h3" style={styles.title}>
            Notifications
          </Text>
          {alerts.length === 0 ? (
            <EmptyState
              icon="notifications-none"
              title="No Notifications"
              message="You don't have any notifications yet"
            />
          ) : (
            alerts.map((a) => <MarketAlertCard key={a.id} alert={a} />)
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

