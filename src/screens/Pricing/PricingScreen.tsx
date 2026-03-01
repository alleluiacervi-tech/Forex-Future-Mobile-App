import React from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = ComponentProps<typeof Icon>['name'];

const FEATURES = [
  'Real-time velocity alerts',
  'Institutional footprint detection',
  'Smart money signals',
  'All currency pairs',
  'Push notifications',
  'Entry SL TP on every alert',
  'Full alert history',
  'Email support',
];

interface Plan {
  key: 'monthly' | 'quarterly' | 'annual';
  name: string;
  price: string;
  priceLabel: string;
  perMonth?: string;
  originalPrice?: string;
  savingsBadge?: string;
  bestValue?: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'monthly',
    name: 'Monthly',
    price: '$20',
    priceLabel: '/month',
  },
  {
    key: 'quarterly',
    name: 'Quarterly',
    price: '$54',
    priceLabel: '/ 3 months',
    perMonth: '$18/month',
    originalPrice: '$60',
    savingsBadge: 'SAVE 10%',
  },
  {
    key: 'annual',
    name: 'Annual',
    price: '$192',
    priceLabel: '/year',
    perMonth: '$16/month',
    originalPrice: '$240',
    savingsBadge: 'SAVE $48 — 20% OFF',
    bestValue: true,
  },
];

export default function PricingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const handleSelectPlan = (planKey: string) => {
    navigation.navigate('Payment', { plan: planKey } as any);
  };

  const renderFeature = (feature: string, index: number) => (
    <View key={index} style={styles.featureRow}>
      <Icon name="checkmark-circle" size={18} color="#2DD4BF" />
      <Text variant="bodySmall" style={styles.featureText}>
        {feature}
      </Text>
    </View>
  );

  const renderPlan = (plan: Plan) => {
    const isGold = plan.bestValue;
    const borderColor = isGold ? theme.colors.accent : theme.colors.border;
    const buttonBg = isGold ? theme.colors.accent : theme.colors.primary;

    return (
      <View
        key={plan.key}
        style={[
          styles.planCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor,
            borderWidth: isGold ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {isGold && (
          <View style={[styles.bestValueBadge, { backgroundColor: theme.colors.accent }]}>
            <Icon name="star" size={12} color="#fff" />
            <Text variant="caption" style={styles.bestValueText}>
              BEST VALUE
            </Text>
          </View>
        )}

        <Text variant="h3" style={styles.planName}>
          {plan.name}
        </Text>

        <View style={styles.priceRow}>
          {plan.originalPrice && (
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={styles.originalPrice}
            >
              {plan.originalPrice}
            </Text>
          )}
          <Text variant="h1" style={styles.planPrice}>
            {plan.price}
          </Text>
          <Text variant="body" color={theme.colors.textSecondary}>
            {plan.priceLabel}
          </Text>
        </View>

        {plan.perMonth && (
          <Text variant="bodySmall" color={theme.colors.primary} style={styles.perMonth}>
            {plan.perMonth}
          </Text>
        )}

        {plan.savingsBadge && (
          <View style={[styles.savingsBadge, { backgroundColor: `${theme.colors.primary}22` }]}>
            <Text variant="caption" style={[styles.savingsBadgeText, { color: theme.colors.primary }]}>
              {plan.savingsBadge}
            </Text>
          </View>
        )}

        <View style={[styles.trialBadge, { backgroundColor: `${theme.colors.success}18` }]}>
          <Icon name="time-outline" size={14} color={theme.colors.success} />
          <Text variant="caption" style={[styles.trialBadgeText, { color: theme.colors.success }]}>
            7 days free
          </Text>
        </View>

        <View style={styles.featureList}>
          {FEATURES.map(renderFeature)}
        </View>

        <TouchableOpacity
          style={[styles.planButton, { backgroundColor: buttonBg }]}
          activeOpacity={0.8}
          onPress={() => handleSelectPlan(plan.key)}
        >
          <Text variant="button" style={styles.planButtonText}>
            Start Free Trial
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Choose Your Plan
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Container>
          <Text variant="h2" style={styles.pageTitle}>
            Choose Your Plan
          </Text>
          <Text variant="body" color={theme.colors.textSecondary} style={styles.pageSubtitle}>
            7 days free on every plan
          </Text>

          {PLANS.map(renderPlan)}

          <View style={styles.bottomSection}>
            <View style={styles.bottomRow}>
              <Icon name="shield-checkmark-outline" size={16} color={theme.colors.textSecondary} />
              <Text variant="caption" color={theme.colors.textSecondary}>
                Cancel anytime during trial
              </Text>
            </View>
            <View style={styles.bottomRow}>
              <Icon name="card-outline" size={16} color={theme.colors.textSecondary} />
              <Text variant="caption" color={theme.colors.textSecondary}>
                No charge until trial ends
              </Text>
            </View>
            <View style={styles.bottomRow}>
              <Icon name="lock-closed-outline" size={16} color={theme.colors.textSecondary} />
              <Text variant="caption" color={theme.colors.textSecondary}>
                Secure payment via PayPal
              </Text>
            </View>
          </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  pageTitle: {
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 4,
  },
  pageSubtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  planCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    marginBottom: 12,
  },
  bestValueText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  planName: {
    fontWeight: '900',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    fontSize: 16,
  },
  planPrice: {
    fontWeight: '900',
  },
  perMonth: {
    fontWeight: '600',
    marginBottom: 8,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  savingsBadgeText: {
    fontWeight: '800',
    fontSize: 11,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    marginBottom: 16,
  },
  trialBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  featureList: {
    marginBottom: 20,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontWeight: '500',
  },
  planButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  planButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
