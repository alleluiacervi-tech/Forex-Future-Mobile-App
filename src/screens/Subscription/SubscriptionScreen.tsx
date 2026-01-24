import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/layout';
import { Card, Text, Button, Input, BrandLogo } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false });

  type Billing = 'monthly' | 'quarterly' | 'yearly';

  const [selectedBilling, setSelectedBilling] = useState<Billing>('monthly');

  const pricing = useMemo(
    () =>
      ({
        monthly: 10,
        quarterly: 30,
        yearly: 120,
      }) as const,
    []
  );

  const selectedPrice = pricing[selectedBilling];
  const billingLabel = selectedBilling === 'monthly' ? 'month' : selectedBilling === 'quarterly' ? '3 months' : 'year';

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

  const canSubmit = !emailError && !passwordError && !confirmPasswordError && email && password && confirmPassword;

  const handleRedeemTrial = () => {
    setTouched({ email: true, password: true, confirmPassword: true });
    if (!canSubmit) return;

    console.log('Free trial redeemed:', {
      email: email.trim().toLowerCase(),
      plan: {
        billing: selectedBilling,
        price: selectedPrice,
      },
    });
    navigation.replace('Main', { screen: 'Home' } as any);
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

              <View style={styles.planGrid}>
                <View
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.colors.surfaceLight,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <View style={styles.planCardTopRow}>
                    <Text variant="h4" style={styles.planTitle}>
                      Signals
                    </Text>
                    <View style={[styles.selectedBadge, { backgroundColor: theme.colors.primary }]}>
                      <Icon name="check" size={14} color={theme.colors.onPrimary} />
                    </View>
                  </View>
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    All users get the same live feed signals and alerts
                  </Text>
                </View>
              </View>

              <View style={styles.billingRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedBilling('monthly')}
                  style={[
                    styles.billingChip,
                    {
                      backgroundColor: selectedBilling === 'monthly' ? theme.colors.primary + '22' : 'transparent',
                      borderColor: selectedBilling === 'monthly' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    color={selectedBilling === 'monthly' ? theme.colors.text : theme.colors.textSecondary}
                    style={styles.billingChipText}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedBilling('quarterly')}
                  style={[
                    styles.billingChip,
                    {
                      backgroundColor: selectedBilling === 'quarterly' ? theme.colors.primary + '22' : 'transparent',
                      borderColor: selectedBilling === 'quarterly' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    color={selectedBilling === 'quarterly' ? theme.colors.text : theme.colors.textSecondary}
                    style={styles.billingChipText}
                  >
                    3 Months
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedBilling('yearly')}
                  style={[
                    styles.billingChip,
                    {
                      backgroundColor: selectedBilling === 'yearly' ? theme.colors.primary + '22' : 'transparent',
                      borderColor: selectedBilling === 'yearly' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    color={selectedBilling === 'yearly' ? theme.colors.text : theme.colors.textSecondary}
                    style={styles.billingChipText}
                  >
                    Yearly
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.summaryRow, { backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.border }]}>
                <View style={styles.summaryLeft}>
                  <Text variant="body" style={styles.summaryTitle}>
                    Signals • {selectedBilling === 'monthly' ? 'Monthly' : selectedBilling === 'quarterly' ? '3 Months' : 'Yearly'}
                  </Text>
                  <Text variant="caption" color={theme.colors.textSecondary}>
                    Billed ${selectedPrice}/{billingLabel} after trial
                  </Text>
                </View>
                <Text variant="h3" style={styles.summaryPrice}>
                  ${selectedPrice}
                </Text>
              </View>
            </View>

            <View style={styles.confirmSection}>
              <Button
                title={`Redeem Free Trial • Signals $${selectedPrice}/${billingLabel}`}
                onPress={handleRedeemTrial}
                variant="primary"
                size="large"
                style={styles.confirmButton}
                disabled={!canSubmit}
              />
              <Text variant="caption" color={theme.colors.textSecondary} style={styles.confirmSubtext}>
                After the trial, you’ll be billed ${selectedPrice} per {billingLabel}. Cancel anytime.
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
  planGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  planCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  selectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  billingChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingChipText: {
    fontWeight: '600',
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
