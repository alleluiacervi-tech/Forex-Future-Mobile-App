import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';

export default function SubscriptionPlanScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const currentPlan = {
    name: 'Premium',
    price: '$29.99',
    period: 'month',
    renewalDate: 'January 20, 2026',
    status: 'Active',
  };

  const features = [
    { icon: 'analytics-outline', title: 'Advanced AI Analysis', description: 'Real-time market insights powered by machine learning' },
    { icon: 'notifications-outline', title: 'Unlimited Price Alerts', description: 'Set custom alerts for any currency pair' },
    { icon: 'stats-chart-outline', title: 'Professional Charts', description: 'Full access to EMA, RSI, and technical indicators' },
    { icon: 'newspaper-outline', title: 'Real-Time News', description: 'Breaking market news and economic calendar' },
    { icon: 'shield-checkmark-outline', title: 'Priority Support', description: '24/7 dedicated customer support' },
    { icon: 'cloud-download-outline', title: 'Data Export', description: 'Export your trading data and analysis' },
  ];

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: ['Basic charts', 'Limited alerts (5/day)', 'Standard support'],
      isCurrent: false,
    },
    {
      name: 'Premium',
      price: '$29.99',
      period: 'month',
      features: ['All features unlocked', 'Unlimited alerts', 'Priority support', 'AI analysis', 'Real-time news'],
      isCurrent: true,
      popular: true,
    },
    {
      name: 'Pro',
      price: '$79.99',
      period: 'month',
      features: ['Everything in Premium', 'Advanced AI models', 'Custom indicators', 'API access', 'White-label options'],
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
              {plan.popular && (
                <View style={[styles.popularBadge, { backgroundColor: theme.colors.primary }]}>
                  <Icon name="star" size={12} color="#fff" />
                  <Text variant="caption" style={styles.popularText}>
                    MOST POPULAR
                  </Text>
                </View>
              )}
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
              <View style={styles.planFeatures}>
                {plan.features.map((feature, featureIdx) => (
                  <View key={featureIdx} style={styles.planFeatureRow}>
                    <Icon name="checkmark" size={20} color={theme.colors.primary} />
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.planFeatureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
              {plan.isCurrent ? (
                <View style={[styles.currentButton, { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.primary }]}>
                  <Text variant="body" style={[styles.currentButtonText, { color: theme.colors.primary }]}>
                    Current Plan
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}>
                  <Text variant="body" style={styles.upgradeButtonText}>
                    {plan.price === '$0' ? 'Downgrade' : 'Upgrade'}
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
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  popularText: {
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
    marginBottom: 20,
  },
  planPrice: {
    fontWeight: '900',
    marginRight: 4,
  },
  planFeatures: {
    marginBottom: 20,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  planFeatureText: {
    flex: 1,
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
