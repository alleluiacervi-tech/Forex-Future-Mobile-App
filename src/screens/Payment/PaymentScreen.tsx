import React, { useState, useCallback } from 'react';
import type { ComponentProps } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { apiPost } from '../../services/api';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = ComponentProps<typeof Icon>['name'];

type FlowState = 'idle' | 'loading' | 'success' | 'cancelled' | 'error';

const PLAN_DETAILS: Record<string, { name: string; price: string; interval: string; amount: string }> = {
  monthly: { name: 'Monthly Plan', price: '$20', interval: 'every month', amount: '$20.00' },
  quarterly: { name: 'Quarterly Plan', price: '$54', interval: 'every 3 months', amount: '$54.00' },
  annual: { name: 'Annual Plan', price: '$192', interval: 'every year', amount: '$192.00' },
};

const getTrialEndDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function PaymentScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const planKey = (route.params as any)?.plan || 'monthly';
  const plan = PLAN_DETAILS[planKey] || PLAN_DETAILS.monthly;

  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const firstChargeDate = getTrialEndDate();

  const handlePayWithPayPal = useCallback(async () => {
    setFlowState('loading');
    setErrorMessage('');

    try {
      const data = await apiPost<{ subscriptionId: string; approvalUrl: string }>(
        '/api/paypal/create-subscription',
        { planKey }
      );

      if (!data?.approvalUrl) {
        throw new Error('Unable to start payment. Please try again.');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.approvalUrl,
        'forexapp://billing/success'
      );

      if (result.type === 'success' || result.type === 'dismiss') {
        setFlowState('success');
      } else if (result.type === 'cancel') {
        setFlowState('cancelled');
      } else {
        setFlowState('cancelled');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setErrorMessage(msg);
      setFlowState('error');
    }
  }, [planKey]);

  // SUCCESS STATE
  if (flowState === 'success') {
    return (
      <ScreenWrapper>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centeredContent}>
          <Container>
            <View style={styles.stateContainer}>
              <View style={[styles.successCircle, { backgroundColor: `${theme.colors.success}22` }]}>
                <Icon name="checkmark-circle" size={80} color={theme.colors.success} />
              </View>
              <Text variant="h2" style={styles.stateTitle}>
                Trial Started!
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.stateText}>
                Your 7 day free trial has started
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.stateText}>
                First charge on {firstChargeDate}
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.stateText}>
                You can cancel anytime before then
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
                }}
              >
                <Text variant="button" style={styles.actionButtonText}>
                  Start Trading
                </Text>
              </TouchableOpacity>
            </View>
          </Container>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // CANCELLED STATE
  if (flowState === 'cancelled') {
    return (
      <ScreenWrapper>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centeredContent}>
          <Container>
            <View style={styles.stateContainer}>
              <View style={[styles.successCircle, { backgroundColor: `${theme.colors.warning}22` }]}>
                <Icon name="close-circle" size={80} color={theme.colors.warning} />
              </View>
              <Text variant="h2" style={styles.stateTitle}>
                Payment Cancelled
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.stateText}>
                No problem — no charge was made
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.stateText}>
                Your plan is still available
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
                onPress={() => navigation.goBack()}
              >
                <Text variant="button" style={styles.actionButtonText}>
                  Choose a Plan
                </Text>
              </TouchableOpacity>
            </View>
          </Container>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ERROR STATE
  if (flowState === 'error') {
    return (
      <ScreenWrapper>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centeredContent}>
          <Container>
            <View style={styles.stateContainer}>
              <View style={[styles.successCircle, { backgroundColor: `${theme.colors.error}22` }]}>
                <Icon name="alert-circle" size={80} color={theme.colors.error} />
              </View>
              <Text variant="h2" style={styles.stateTitle}>
                Something Went Wrong
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.stateText}>
                {errorMessage || 'Unable to process your payment. Please try again.'}
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
                onPress={() => {
                  setFlowState('idle');
                  setErrorMessage('');
                }}
              >
                <Text variant="button" style={styles.actionButtonText}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </Container>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // IDLE / LOADING — ORDER SUMMARY
  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Complete Your Order
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Container>
          <Card style={[styles.orderCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h4" style={styles.orderTitle}>
              Order Summary
            </Text>

            <View style={styles.orderRow}>
              <Text variant="body" color={theme.colors.textSecondary}>Plan</Text>
              <Text variant="body" style={styles.orderValue}>{plan.name}</Text>
            </View>

            <View style={styles.orderRow}>
              <Text variant="body" color={theme.colors.textSecondary}>Price</Text>
              <Text variant="body" style={styles.orderValue}>{plan.amount}</Text>
            </View>

            <View style={styles.orderRow}>
              <Text variant="body" color={theme.colors.textSecondary}>Trial</Text>
              <Text variant="body" style={[styles.orderValue, { color: theme.colors.success }]}>7 days free</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.orderRow}>
              <Text variant="body" color={theme.colors.textSecondary}>First charge</Text>
              <Text variant="body" style={styles.orderValue}>{firstChargeDate}</Text>
            </View>

            <View style={styles.orderRow}>
              <Text variant="body" color={theme.colors.textSecondary}>Then</Text>
              <Text variant="body" style={styles.orderValue}>
                {plan.amount} {plan.interval}
              </Text>
            </View>
          </Card>

          <TouchableOpacity
            style={[styles.paypalButton, flowState === 'loading' && styles.paypalButtonDisabled]}
            activeOpacity={0.8}
            onPress={handlePayWithPayPal}
            disabled={flowState === 'loading'}
          >
            {flowState === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#003087" size="small" />
                <Text variant="button" style={styles.paypalButtonText}>
                  Setting up your account...
                </Text>
              </View>
            ) : (
              <View style={styles.paypalRow}>
                <Text variant="button" style={styles.paypalButtonText}>
                  Pay with PayPal
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.securitySection}>
            <View style={styles.securityRow}>
              <Icon name="lock-closed" size={16} color={theme.colors.textSecondary} />
              <Text variant="caption" color={theme.colors.textSecondary}>
                SSL secured
              </Text>
            </View>
            <View style={styles.securityRow}>
              <Icon name="shield-checkmark" size={16} color={theme.colors.textSecondary} />
              <Text variant="caption" color={theme.colors.textSecondary}>
                PayPal protected
              </Text>
            </View>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.securityText}>
              Your payment is secured by PayPal
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.securityText}>
              Full refund within 48 hours if unsatisfied
            </Text>
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
    paddingTop: 16,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  orderCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  orderTitle: {
    fontWeight: '900',
    marginBottom: 20,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderValue: {
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  paypalButton: {
    backgroundColor: '#FFC43A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  paypalButtonDisabled: {
    opacity: 0.7,
  },
  paypalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paypalButtonText: {
    color: '#003087',
    fontWeight: '800',
    fontSize: 17,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  securitySection: {
    alignItems: 'center',
    gap: 8,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    textAlign: 'center',
  },
  stateContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stateTitle: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  stateText: {
    textAlign: 'center',
    marginBottom: 6,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
