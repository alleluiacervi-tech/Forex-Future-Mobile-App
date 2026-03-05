import React, { useState, useEffect, useCallback } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiAuthGet, apiPost } from '../../services/api';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionPlanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  type IconName = ComponentProps<typeof Icon>['name'];
  type Feature = { icon: IconName; title: string; description: string };

  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiAuthGet<{ subscription: any }>('/api/paypal/subscription');
      setSubscription(data?.subscription || null);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleCancelSubscription = () => {
    const accessUntil = subscription?.currentPeriodEnd || subscription?.trialEnd;
    const dateStr = accessUntil
      ? new Date(accessUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'end of your current period';

    Alert.alert(
      'Cancel Subscription',
      `Are you sure? You will keep access until ${dateStr}.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await apiPost('/api/paypal/cancel', { reason: 'Cancelled by user' });
              await fetchSubscription();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Unable to cancel subscription.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'trial': return '#FBBF24';
      case 'cancelled': return '#f44336';
      case 'expired': return '#9BB3BD';
      default: return '#9BB3BD';
    }
  };

  const getStatusIcon = (status: string): IconName => {
    switch (status) {
      case 'active': return 'checkmark-circle';
      case 'trial': return 'time-outline';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle-outline';
    }
  };

  const features: Feature[] = [
    { icon: 'flash-outline', title: 'Advanced Volatility Alerts', description: 'Smart alerts for large moves across multiple time windows' },
    { icon: 'notifications-outline', title: 'Unlimited Price Alerts', description: 'Set custom alerts for any currency pair' },
    { icon: 'stats-chart-outline', title: 'Professional Charts', description: 'Full access to EMA, RSI, and technical indicators' },
    { icon: 'newspaper-outline', title: 'Real-Time News', description: 'Breaking market news and economic calendar' },
    { icon: 'shield-checkmark-outline', title: 'Priority Support', description: '24/7 dedicated customer support' },
    { icon: 'cloud-download-outline', title: 'Data Export', description: 'Export your trading data and analysis' },
  ];

  const planName = subscription
    ? (subscription.plan || 'monthly').charAt(0).toUpperCase() + (subscription.plan || 'monthly').slice(1)
    : 'None';
  const status = subscription?.status || 'inactive';
  const amount = subscription?.amount ? `$${Number(subscription.amount).toFixed(2)}` : '--';
  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : subscription?.trialEnd
      ? new Date(subscription.trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Subscription Plan
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : subscription ? (
            <>
              <Card style={[styles.currentPlanCard, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
                <View style={styles.currentPlanHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
                    <Icon name={getStatusIcon(status)} size={16} color="#fff" />
                    <Text variant="caption" style={styles.statusText}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text variant="h2" style={[styles.planName, { color: theme.colors.primary }]}>
                  {planName}
                </Text>
                <View style={styles.priceRow}>
                  <Text variant="h1" style={[styles.price, { color: theme.colors.primary }]}>
                    {amount}
                  </Text>
                  <Text variant="body" color={theme.colors.textSecondary} style={styles.period}>
                    /month
                  </Text>
                </View>
                {renewalDate && (
                  <View style={styles.renewalRow}>
                    <Icon name="calendar-outline" size={16} color={theme.colors.primary} />
                    <Text variant="bodySmall" style={[styles.renewalText, { color: theme.colors.primary }]}>
                      {status === 'trial' ? `Trial ends ${renewalDate}` : `Renews on ${renewalDate}`}
                    </Text>
                  </View>
                )}
              </Card>

              <Text variant="h4" style={styles.sectionTitle}>
                Your Premium Features
              </Text>

              {features.map((feature, idx) => (
                <Card key={idx} style={[styles.featureCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={[styles.featureIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                    <Icon name={feature.icon} size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.featureContent}>
                    <Text variant="body" style={styles.featureTitle}>
                      {feature.title}
                    </Text>
                    <Text variant="caption" color={theme.colors.textSecondary} style={styles.featureDescription}>
                      {feature.description}
                    </Text>
                  </View>
                  <Icon name="checkmark-circle" size={24} color="#4CAF50" />
                </Card>
              ))}

              <Card style={[styles.managementCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text variant="h4" style={styles.managementTitle}>
                  Manage Subscription
                </Text>
                <TouchableOpacity
                  style={styles.managementButton}
                  onPress={() => navigation.navigate('Pricing' as any)}
                >
                  <Icon name="swap-horizontal-outline" size={20} color={theme.colors.text} />
                  <Text variant="body" style={styles.managementButtonText}>
                    Switch Plan
                  </Text>
                  <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.managementButton}
                  onPress={() => navigation.navigate('BillingPayments' as any)}
                >
                  <Icon name="receipt-outline" size={20} color={theme.colors.text} />
                  <Text variant="body" style={styles.managementButtonText}>
                    Billing History
                  </Text>
                  <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {status !== 'cancelled' && status !== 'expired' && (
                  <TouchableOpacity
                    style={styles.managementButton}
                    onPress={handleCancelSubscription}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator size="small" color="#f44336" />
                    ) : (
                      <Icon name="close-circle-outline" size={20} color="#f44336" />
                    )}
                    <Text variant="body" style={[styles.managementButtonText, { color: '#f44336' }]}>
                      Cancel Subscription
                    </Text>
                    <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </Card>
            </>
          ) : (
            <View style={styles.noSubContainer}>
              <Icon name="card-outline" size={64} color={theme.colors.textSecondary} />
              <Text variant="h4" style={styles.noSubTitle}>
                No Active Subscription
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.noSubText}>
                Subscribe to unlock premium features and real-time alerts.
              </Text>
              <TouchableOpacity
                style={[styles.viewPlansButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('Pricing' as any)}
                activeOpacity={0.8}
              >
                <Text variant="body" style={styles.viewPlansText}>
                  View Plans
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: '900',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 64,
    alignItems: 'center',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    marginTop: 16,
    marginBottom: 24,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  planName: {
    fontWeight: '900',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontWeight: '900',
  },
  period: {
    marginLeft: 4,
  },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  renewalText: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 16,
  },
  featureCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    lineHeight: 16,
  },
  managementCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  managementTitle: {
    fontWeight: '900',
    marginBottom: 16,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  managementButtonText: {
    flex: 1,
    fontWeight: '600',
  },
  noSubContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  noSubTitle: {
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  noSubText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  viewPlansButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  viewPlansText: {
    color: '#fff',
    fontWeight: '800',
  },
});
