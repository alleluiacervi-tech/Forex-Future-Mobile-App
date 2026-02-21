import React from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function SubscriptionPlanScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  type IconName = ComponentProps<typeof Icon>['name'];
  type Feature = { icon: IconName; title: string; description: string };

  const currentPlan = {
    name: 'Monthly',
    price: '$20',
    period: 'month',
    renewalDate: 'March 20, 2026',
    status: 'Active',
  };

  const features: Feature[] = [
    { icon: 'flash-outline', title: 'Advanced Volatility Alerts', description: 'Smart alerts for large moves across multiple time windows' },
    { icon: 'notifications-outline', title: 'Unlimited Price Alerts', description: 'Set custom alerts for any currency pair' },
    { icon: 'stats-chart-outline', title: 'Professional Charts', description: 'Full access to EMA, RSI, and technical indicators' },
    { icon: 'newspaper-outline', title: 'Real-Time News', description: 'Breaking market news and economic calendar' },
    { icon: 'shield-checkmark-outline', title: 'Priority Support', description: '24/7 dedicated customer support' },
    { icon: 'cloud-download-outline', title: 'Data Export', description: 'Export your trading data and analysis' },
  ];

  const plans = [
    {
      name: 'Monthly',
      price: '$20',
      period: 'month',
      detail: 'No discount',
      isCurrent: true,
    },
    {
      name: '3 Months',
      price: '$54',
      period: 'total',
      detail: '$18/month',
      discountBadge: '10% OFF',
      isCurrent: false,
    },
    {
      name: 'Annual',
      price: '$192',
      period: 'year',
      detail: '$16/month',
      discountBadge: '20% OFF',
      bestValue: true,
      isCurrent: false,
    },
  ];

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
          <Card style={[styles.currentPlanCard, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
            <View style={styles.currentPlanHeader}>
              <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                <Icon name="checkmark-circle" size={16} color="#fff" />
                <Text variant="caption" style={styles.statusText}>
                  {currentPlan.status}
                </Text>
              </View>
            </View>
            <Text variant="h2" style={[styles.planName, { color: theme.colors.primary }]}>
              {currentPlan.name}
            </Text>
            <View style={styles.priceRow}>
              <Text variant="h1" style={[styles.price, { color: theme.colors.primary }]}>
                {currentPlan.price}
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.period}>
                /{currentPlan.period}
              </Text>
            </View>
            <View style={styles.renewalRow}>
              <Icon name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text variant="bodySmall" style={[styles.renewalText, { color: theme.colors.primary }]}>
                Renews on {currentPlan.renewalDate}
              </Text>
            </View>
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

          <Text variant="h4" style={styles.sectionTitle}>
            Available Plans
          </Text>

          {plans.map((plan, idx) => (
            <Card key={idx} style={[
              styles.planCard,
              { backgroundColor: theme.colors.surface, borderColor: plan.isCurrent ? theme.colors.primary : theme.colors.border },
              plan.isCurrent && { borderWidth: 2 },
            ]}>
              <View style={styles.planBadgeRow}>
                {plan.discountBadge && (
                  <View style={[styles.discountBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text variant="caption" style={styles.discountBadgeText}>
                      {plan.discountBadge}
                    </Text>
                  </View>
                )}
                {plan.bestValue && (
                  <View style={[styles.bestValueBadge, { backgroundColor: theme.colors.accent }]}>
                    <Icon name="star" size={12} color="#fff" />
                    <Text variant="caption" style={styles.bestValueText}>
                      BEST VALUE
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="h3" style={styles.planCardName}>
                {plan.name}
              </Text>
              <View style={styles.planPriceRow}>
                <Text variant="h2" style={styles.planPrice}>
                  {plan.price}
                </Text>
                <Text variant="body" color={theme.colors.textSecondary}>
                  /{plan.period}
                </Text>
              </View>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.planDetailText}>
                {plan.detail}
              </Text>
              {plan.isCurrent ? (
                <View style={[styles.currentButton, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
                  <Text variant="body" style={[styles.currentButtonText, { color: theme.colors.primary }]}>
                    Current Plan
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}>
                  <Text variant="body" style={styles.upgradeButtonText}>
                    Switch Plan
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          ))}

          <Card style={[styles.managementCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.managementTitle}>
              Manage Subscription
            </Text>
            <TouchableOpacity style={styles.managementButton}>
              <Icon name="card-outline" size={20} color={theme.colors.text} />
              <Text variant="body" style={styles.managementButtonText}>
                Update Payment Method
              </Text>
              <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementButton}>
              <Icon name="receipt-outline" size={20} color={theme.colors.text} />
              <Text variant="body" style={styles.managementButtonText}>
                Billing History
              </Text>
              <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementButton}>
              <Icon name="close-circle-outline" size={20} color="#f44336" />
              <Text variant="body" style={[styles.managementButtonText, { color: '#f44336' }]}>
                Cancel Subscription
              </Text>
              <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </Card>
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
  planCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  discountBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  bestValueText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  planCardName: {
    fontWeight: '900',
    marginBottom: 8,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontWeight: '900',
    marginRight: 4,
  },
  planDetailText: {
    marginBottom: 20,
    lineHeight: 18,
  },
  currentButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  currentButtonText: {
    fontWeight: '800',
  },
  upgradeButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '800',
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
});
