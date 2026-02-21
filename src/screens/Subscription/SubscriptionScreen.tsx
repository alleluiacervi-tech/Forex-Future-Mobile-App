import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/layout';
import { Card, Text, Button, Input, BrandLogo } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirmPassword: false });

  type Billing = 'monthly' | 'quarterly' | 'yearly';
  type BillingPlan = {
    id: Billing;
    name: string;
    headlinePrice: string;
    totalPrice: number;
    monthlyEquivalent: string;
    billingLabel: string;
    discountBadge?: string;
    isBestValue?: boolean;
    hasNoDiscount?: boolean;
  };

  const [selectedBilling, setSelectedBilling] = useState<Billing>('monthly');

  const plans = useMemo<BillingPlan[]>(
    () => [
      {
        id: 'monthly',
        name: 'Monthly',
        headlinePrice: '$20/month',
        totalPrice: 20,
        monthlyEquivalent: '$20/month',
        billingLabel: 'month',
        hasNoDiscount: true,
      },
      {
        id: 'quarterly',
        name: '3 Months',
        headlinePrice: '$54 total',
        totalPrice: 54,
        monthlyEquivalent: '$18/month',
        billingLabel: '3 months',
        discountBadge: '10% OFF',
      },
      {
        id: 'yearly',
        name: 'Annual',
        headlinePrice: '$192/year',
        totalPrice: 192,
        monthlyEquivalent: '$16/month',
        billingLabel: 'year',
        discountBadge: '20% OFF',
        isBestValue: true,
      },
    ],
    []
  );

  const selectedPlan = plans.find((plan) => plan.id === selectedBilling) ?? plans[0];
  const selectedPrice = selectedPlan.totalPrice;
  const billingLabel = selectedPlan.billingLabel;

  const nameError = useMemo(() => {
    if (!touched.name) return undefined;
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return undefined;
  }, [name, touched.name]);

  const emailError = useMemo(() => {
    if (!touched.email) return undefined;
    if (!email.trim()) return 'Email is required';
    const normalized = email.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!ok) return 'Enter a valid email address';
    return undefined;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return undefined;
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Use at least 8 characters';
    return undefined;
  }, [password, touched.password]);

  const confirmPasswordError = useMemo(() => {
    if (!touched.confirmPassword) return undefined;
    if (!confirmPassword) return 'Confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return undefined;
  }, [confirmPassword, password, touched.confirmPassword]);

  const canSubmit =
    !nameError &&
    !emailError &&
    !passwordError &&
    !confirmPasswordError &&
    name &&
    email &&
    password &&
    confirmPassword;

  const handleRedeemTrial = async () => {
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const billingParams = {
      setupTrial: true,
      email: normalizedEmail,
      password,
      selectedBilling,
      selectedPrice,
      billingLabel,
    } as const;

    try {
      try {
        const verification = await register(name.trim(), normalizedEmail, password);
        if (verification?.verificationUnavailable) {
          Alert.alert(
            'Verification unavailable',
            'Email verification is temporarily unavailable. Please try again later.',
          );
          return;
        }
        if (verification?.verificationRequired) {
          navigation.replace('VerifyEmail', {
            email: normalizedEmail,
            debugCode: verification?.debugCode,
            debugExpiresAt: verification?.debugExpiresAt,
            nextScreen: 'BillingPayments',
            nextParams: billingParams,
          });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        if (!message.toLowerCase().includes('already registered')) {
          throw error;
        }
      }

      navigation.replace('BillingPayments', billingParams);
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Unable to continue');
    }
  };

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View style={[styles.glowTop, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.glowBottom, { backgroundColor: theme.colors.accent }]} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text variant="h2" style={styles.headerTitle}>
              Request Access
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.logoRow}>
            <BrandLogo />
          </View>

          {/* Free Trial Banner */}
          <Card style={[styles.trialBanner, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.border }]}>
            <View style={styles.trialBannerContent}>
              <Icon name="stars" size={28} color={theme.colors.primary} />
              <View style={styles.trialBannerText}>
                <Text variant="h4" style={[styles.trialBannerTitle, { color: theme.colors.text }]}>
                  14‑Day Free Trial
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Create an account and choose billing. You won’t be charged until your trial ends.
                </Text>
              </View>
            </View>
          </Card>

          {/* Sign Up Form */}
          <Card style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="h3" style={styles.sectionTitle}>
              Create your account
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.sectionSubtitle}>
              Use your email and set a password to redeem your free trial.
            </Text>

            <Input
              label="Full Name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (!touched.name) setTouched((p) => ({ ...p, name: true }));
              }}
              placeholder="John Doe"
              error={nameError}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (!touched.email) setTouched((p) => ({ ...p, email: true }));
              }}
              placeholder="trader@example.com"
              keyboardType="email-address"
              error={emailError}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (!touched.password) setTouched((p) => ({ ...p, password: true }));
              }}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              error={passwordError}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.7}
                  style={styles.eyeInline}
                >
                  <Icon
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (!touched.confirmPassword) setTouched((p) => ({ ...p, confirmPassword: true }));
              }}
              placeholder="••••••••"
              secureTextEntry={!showConfirmPassword}
              error={confirmPasswordError}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  activeOpacity={0.7}
                  style={styles.eyeInline}
                >
                  <Icon
                    name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            {/* Plan Selection */}
            <View style={styles.planSection}>
              <View style={styles.planHeaderRow}>
                <Text variant="h3" style={styles.sectionTitleCompact}>
                  Choose your plan
                </Text>
                <Text variant="bodySmall" color={theme.colors.textSecondary}>
                  Starts after trial
                </Text>
              </View>

              <View style={styles.planCards}>
                {plans.map((plan) => {
                  const isSelected = selectedBilling === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      activeOpacity={0.9}
                      onPress={() => setSelectedBilling(plan.id)}
                      style={[
                        styles.planOptionCard,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '18' : theme.colors.surfaceLight,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                        isSelected && styles.planOptionCardSelected,
                      ]}
                    >
                      <View style={styles.planOptionHeader}>
                        <Text variant="h4" style={styles.planOptionTitle}>
                          {plan.name}
                        </Text>
                        <View style={styles.planBadges}>
                          {plan.discountBadge && (
                            <View style={[styles.discountBadge, { backgroundColor: theme.colors.primary }]}>
                              <Text variant="caption" style={styles.discountBadgeText}>
                                {plan.discountBadge}
                              </Text>
                            </View>
                          )}
                          {plan.isBestValue && (
                            <View style={[styles.bestValueBadge, { backgroundColor: theme.colors.accent }]}>
                              <Icon name="stars" size={12} color={theme.colors.onPrimary} />
                              <Text variant="caption" style={styles.bestValueText}>
                                BEST VALUE
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Text variant="h3" style={styles.planHeadlinePrice}>
                        {plan.headlinePrice}
                      </Text>
                      <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.planDetailText}>
                        {plan.hasNoDiscount ? 'No discount' : `Equivalent to ${plan.monthlyEquivalent}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.summaryRow, { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}>
                <View style={styles.summaryLeft}>
                  <Text variant="body" style={styles.summaryTitle}>
                    Signals • {selectedPlan.name}
                  </Text>
                  <Text variant="caption" color={theme.colors.textSecondary}>
                    Billed {selectedPlan.headlinePrice} after trial
                  </Text>
                </View>
                <Text variant="h3" style={styles.summaryPrice}>
                  ${selectedPrice}
                </Text>
              </View>
            </View>

            <View style={styles.confirmSection}>
              <Button
                title={isLoading ? 'Starting trial...' : `Redeem Free Trial • ${selectedPlan.name} ${selectedPlan.headlinePrice}`}
                onPress={handleRedeemTrial}
                variant="primary"
                size="large"
                style={styles.confirmButton}
                disabled={!canSubmit || isLoading}
              />
              <Text variant="caption" color={theme.colors.textSecondary} style={styles.confirmSubtext}>
                After the trial, you’ll be billed {selectedPlan.headlinePrice}. Cancel anytime.
              </Text>
            </View>
          </Card>
          </View>
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
  },
  background: {
    flex: 1,
  },
  glowTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -90,
    right: -60,
    opacity: 0.14,
  },
  glowBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -140,
    left: -90,
    opacity: 0.12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  trialBanner: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trialBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trialBannerText: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionSubtitle: {
    marginBottom: 16,
    lineHeight: 20,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  planSection: {
    marginTop: 6,
    gap: 12,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitleCompact: {
    fontSize: 18,
    fontWeight: '700',
  },
  planCards: {
    gap: 12,
  },
  planOptionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  planOptionCardSelected: {
    borderWidth: 2,
  },
  planOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  planOptionTitle: {
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  planBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  discountBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  bestValueBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  planHeadlinePrice: {
    fontWeight: '800',
  },
  planDetailText: {
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: {
    flex: 1,
    paddingRight: 12,
    gap: 4,
  },
  summaryTitle: {
    fontWeight: '700',
  },
  summaryPrice: {
    fontWeight: '800',
  },
  eyeInline: {
    padding: 6,
  },
  confirmSection: {
    paddingTop: 8,
  },
  confirmButton: {
    width: '100%',
    marginBottom: 12,
  },
  confirmSubtext: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
