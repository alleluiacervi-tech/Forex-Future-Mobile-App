import React, { useState, useEffect, useCallback } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { apiAuthGet, apiPost } from '../../services/api';
import { RootStackParamList } from '../../types';
import { resetToLanding } from '../../navigation/rootNavigation';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout, isLoading } = useAuth();

  type IconName = ComponentProps<typeof Icon>['name'];

  // Subscription state
  const [subscription, setSubscription] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  const fetchSubscription = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await apiAuthGet<{ subscription: any }>('/api/paypal/subscription');
      setSubscription(data?.subscription || null);
    } catch {
      setSubscription(null);
    } finally {
      setSubLoading(false);
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
            setCancellingSubscription(true);
            try {
              await apiPost('/api/paypal/cancel', { reason: 'Cancelled by user' });
              await fetchSubscription();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Unable to cancel subscription.');
            } finally {
              setCancellingSubscription(false);
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
      case 'suspended': return '#f44336';
      case 'past_due': return '#FBBF24';
      default: return '#9BB3BD';
    }
  };

  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState(true);

  const MenuItem = ({ icon, title, subtitle, onPress, showChevron = true, hasSwitch, switchValue, onSwitchChange, iconColor }: {
    icon: IconName;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    iconColor?: string;
  }) => (
    <TouchableOpacity
      activeOpacity={hasSwitch ? 1 : 0.7}
      onPress={hasSwitch ? undefined : onPress}
      style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
      disabled={hasSwitch}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor || theme.colors.primary}14` }]}>
        <Icon name={icon} size={22} color={iconColor || theme.colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text variant="body" style={styles.menuTitle}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color={theme.colors.textSecondary} style={styles.menuSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}88` }}
          thumbColor={switchValue ? theme.colors.primary : theme.colors.textSecondary}
          ios_backgroundColor={theme.colors.border}
        />
      ) : showChevron ? (
        <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      ) : null}
    </TouchableOpacity>
  );

  const FeatureItem = ({ icon, title, color }: {
    icon: IconName;
    title: string;
    color: string;
  }) => (
    <View style={styles.featureItem}>
      <View style={[styles.featureIconSmall, { backgroundColor: `${color}14` }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text variant="body" style={styles.featureItemText}>
        {title}
      </Text>
    </View>
  );

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              if (!resetToLanding()) {
                const rootNavigation =
                  (navigation.getParent()?.getParent() as ProfileScreenNavigationProp | undefined) ??
                  (navigation.getParent() as ProfileScreenNavigationProp | undefined);
                if (rootNavigation?.reset) {
                  rootNavigation.reset({
                    index: 0,
                    routes: [{ name: 'Landing' }],
                  });
                } else {
                  navigation.navigate('Landing');
                }
              }
            } catch (error) {
              Alert.alert('Logout failed', error instanceof Error ? error.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <TopNavBar />
      <ScrollView style={styles.scrollView}>
        <Container>
          <View style={[styles.profileHeader, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.avatarCircle, { backgroundColor: `${theme.colors.primary}22`, borderColor: theme.colors.primary }]}>
              <Icon name="person" size={48} color={theme.colors.primary} />
            </View>
            <Text variant="h3" style={styles.userName}>
              {user?.name || 'Trader Account'}
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.userEmail}>
              {user?.email || 'trader@forexfuture.com'}
            </Text>
            <TouchableOpacity
              style={[styles.editProfileButton, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}44` }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Security' as any)}
            >
              <Icon name="create-outline" size={16} color={theme.colors.primary} />
              <Text variant="caption" style={[styles.editProfileText, { color: theme.colors.primary }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              CORE FEATURES
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.featuresCompact}>
                <FeatureItem icon="flash-outline" title="Volatility Alerts" color="#4CAF50" />
                <FeatureItem icon="notifications-outline" title="Smart Alerts" color="#2196F3" />
                <FeatureItem icon="stats-chart-outline" title="Technical Tools" color="#FFC107" />
                <FeatureItem icon="shield-checkmark-outline" title="Risk Management" color="#f44336" />
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              SUBSCRIPTION
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {subLoading ? (
                <View style={styles.subLoadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : subscription ? (
                <View style={styles.subContainer}>
                  <View style={styles.subHeader}>
                    <Text variant="body" style={styles.subPlanName}>
                      {(subscription.plan || 'monthly').charAt(0).toUpperCase() + (subscription.plan || 'monthly').slice(1)} Plan
                    </Text>
                    <View style={[styles.subStatusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
                      <Text variant="caption" style={styles.subStatusText}>
                        {(subscription.status || 'unknown').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {subscription.trialEnd && subscription.status === 'trial' && (
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subDetail}>
                      Trial ends {new Date(subscription.trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                  {subscription.currentPeriodEnd && subscription.status !== 'trial' && (
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subDetail}>
                      Next billing {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                  {subscription.amount && (
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subDetail}>
                      ${Number(subscription.amount).toFixed(2)} per billing cycle
                    </Text>
                  )}
                  <View style={styles.subActions}>
                    {subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
                      <TouchableOpacity
                        style={[styles.subActionButton, { borderColor: theme.colors.error }]}
                        onPress={handleCancelSubscription}
                        disabled={cancellingSubscription}
                        activeOpacity={0.7}
                      >
                        {cancellingSubscription ? (
                          <ActivityIndicator size="small" color={theme.colors.error} />
                        ) : (
                          <Text variant="bodySmall" style={{ color: theme.colors.error, fontWeight: '700' }}>
                            Cancel Subscription
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.subActionButton, { borderColor: theme.colors.primary }]}
                      onPress={() => navigation.navigate('Pricing' as any)}
                      activeOpacity={0.7}
                    >
                      <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                        Change Plan
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.subContainer}>
                  <Text variant="body" color={theme.colors.textSecondary} style={styles.subDetail}>
                    No active subscription
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
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              SETTINGS
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="notifications-outline"
                title="Push Notifications"
                subtitle="Receive alerts for market events"
                hasSwitch
                switchValue={notificationsEnabled}
                onSwitchChange={setNotificationsEnabled}
              />
              <MenuItem
                icon="volume-high-outline"
                title="Sound Alerts"
                subtitle="Audio notifications for price movements"
                hasSwitch
                switchValue={soundEnabled}
                onSwitchChange={setSoundEnabled}
              />
              <MenuItem
                icon="pricetag-outline"
                title="Price Alerts"
                subtitle="Custom price level notifications"
                hasSwitch
                switchValue={priceAlertsEnabled}
                onSwitchChange={setPriceAlertsEnabled}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              ACCOUNT
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="card-outline"
                title="Subscription Plan"
                subtitle={
                  subLoading
                    ? 'Loading...'
                    : subscription
                      ? `${(subscription.plan || 'Monthly').charAt(0).toUpperCase() + (subscription.plan || 'Monthly').slice(1)} • ${(subscription.status || 'unknown').charAt(0).toUpperCase() + (subscription.status || 'unknown').slice(1)}`
                      : 'No active subscription'
                }
                onPress={() => navigation.navigate('SubscriptionPlan' as any)}
              />
              <MenuItem
                icon="shield-outline"
                title="Security"
                subtitle="Password, 2FA, and security settings"
                onPress={() => navigation.navigate('Security' as any)}
              />
              <MenuItem
                icon="wallet-outline"
                title="Billing & Payments"
                subtitle="Payment methods and history"
                onPress={() => navigation.navigate('BillingPayments' as any)}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              LEGAL & COMPLIANCE
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="document-text-outline"
                title="Terms of Service"
                subtitle="User agreement and conditions"
                onPress={() => navigation.navigate('TermsOfService' as any)}
              />
              <MenuItem
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                subtitle="How we protect your data"
                onPress={() => navigation.navigate('PrivacyPolicy' as any)}
              />
              <MenuItem
                icon="alert-circle-outline"
                title="Risk Disclosure"
                subtitle="Trading risks and disclaimers"
                onPress={() => navigation.navigate('RiskDisclosure' as any)}
              />
              <MenuItem
                icon="reader-outline"
                title="Licenses & Compliance"
                subtitle="Regulatory information"
                onPress={() => navigation.navigate('Licenses' as any)}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              SUPPORT
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="help-circle-outline"
                title="Help Center"
                subtitle="FAQs and support articles"
                onPress={() => navigation.navigate('HelpCenter' as any)}
              />
              <MenuItem
                icon="mail-outline"
                title="Contact Us"
                subtitle="Get in touch with our team"
                onPress={() => navigation.navigate('ContactUs' as any)}
              />
            </Card>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.sectionLabel}>
              DANGER ZONE
            </Text>
            <Card style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MenuItem
                icon="log-out-outline"
                title={isLoading ? 'Logging out...' : 'Logout'}
                subtitle="Sign out of your account"
                onPress={handleLogout}
                iconColor="#f44336"
                showChevron={false}
              />
              <MenuItem
                icon="close-circle-outline"
                title="Delete Account"
                subtitle="Permanently remove your data"
                onPress={() => {
                  Alert.alert(
                    'Delete Account',
                    'This will permanently delete your account and all data. This action cannot be undone. To proceed, please contact support at support@forexfuture.com.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Contact Support',
                        onPress: () => navigation.navigate('ContactUs' as any),
                      },
                    ]
                  );
                }}
                iconColor="#f44336"
              />
            </Card>
          </View>

          <View style={styles.footer}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              Forex Future v1.0.0 • Build 2024.12.20
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              Real-time market alerts • Not financial advice
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              © 2024 Forex Future. All rights reserved.
            </Text>
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  userName: {
    fontWeight: '900',
    marginBottom: 4,
  },
  userEmail: {
    marginBottom: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    marginTop: 4,
  },
  editProfileText: {
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  featuresCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
    gap: 8,
    minWidth: '47%',
  },
  featureIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureItemText: {
    fontWeight: '700',
    fontSize: 13,
  },
  menuCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerText: {
    textAlign: 'center',
  },
  subLoadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  subContainer: {
    padding: 16,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subPlanName: {
    fontWeight: '800',
    fontSize: 16,
  },
  subStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  subStatusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  subDetail: {
    marginBottom: 4,
  },
  subActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  subActionButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewPlansButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  viewPlansText: {
    color: '#fff',
    fontWeight: '800',
  },
});
