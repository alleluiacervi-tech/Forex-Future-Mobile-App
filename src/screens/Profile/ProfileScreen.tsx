import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import TopNavBar from '../../components/navigation/TopNavBar';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState(true);

  const MenuItem = ({ icon, title, subtitle, onPress, showChevron = true, hasSwitch, switchValue, onSwitchChange, iconColor }: {
    icon: string;
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
    icon: string;
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
              Trader Account
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.userEmail}>
              trader@forexfuture.com
            </Text>
            <TouchableOpacity
              style={[styles.editProfileButton, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}44` }]}
              activeOpacity={0.7}
              onPress={() => {}}
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
                <FeatureItem icon="analytics-outline" title="AI Analysis" color="#4CAF50" />
                <FeatureItem icon="notifications-outline" title="Smart Alerts" color="#2196F3" />
                <FeatureItem icon="stats-chart-outline" title="Technical Tools" color="#FFC107" />
                <FeatureItem icon="shield-checkmark-outline" title="Risk Management" color="#f44336" />
              </View>
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
                subtitle="Premium • Renews Jan 20, 2026"
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
                title="Logout"
                subtitle="Sign out of your account"
                onPress={() => {}}
                iconColor="#f44336"
              />
              <MenuItem
                icon="close-circle-outline"
                title="Delete Account"
                subtitle="Permanently remove your data"
                onPress={() => {}}
                iconColor="#f44336"
              />
            </Card>
          </View>

          <View style={styles.footer}>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              Forex Future v1.0.0 • Build 2024.12.20
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              AI-driven market insights • Not financial advice
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
});

