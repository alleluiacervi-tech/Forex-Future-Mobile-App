import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';
import { Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { MarketAlertCard } from '../../components/market/MarketAlertCard';
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
  const alerts = [];

  return (
    <ScreenWrapper>
      <TopNavBar />
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
