import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button, Input, BrandLogo } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { login, isLoading, isAuthenticated } = useAuth();
  const { height } = Dimensions.get('window');
  const isSmallScreen = height < 700;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPaymentSetupAction, setShowPaymentSetupAction] = useState(false);

  const emailError = useMemo(() => {
    if (!email) return undefined;
    const normalized = email.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return ok ? undefined : 'Enter a valid email address';
  }, [email]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigation.replace('Main');
    }
  }, [isAuthenticated, isLoading, navigation]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    if (emailError) {
      Alert.alert('Invalid email', emailError);
      return;
    }

    setShowPaymentSetupAction(false);

    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result?.otpRequired) {
        navigation.navigate('LoginOtp', {
          email: email.trim().toLowerCase(),
          debugCode: result.debugCode,
          debugExpiresAt: result.debugExpiresAt,
        });
        return;
      }
      navigation.replace('Main');
    } catch (error) {
      const verificationRequired =
        typeof error === 'object' &&
        error !== null &&
        (error as { verificationRequired?: boolean }).verificationRequired;
      if (verificationRequired) {
        navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
        return;
      }
      const trialRequired =
        (typeof error === 'object' && error !== null && (error as { trialRequired?: boolean }).trialRequired) ||
        (error instanceof Error &&
          (error.message.toLowerCase().includes('trial must be activated') ||
            error.message.toLowerCase().includes('free trial must be activated')));
      if (trialRequired) {
        setShowPaymentSetupAction(true);
        Alert.alert(
          'Payment setup required',
          'Continue to payment methods to activate your trial, then sign in again.',
        );
        return;
      }
      Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Unable to sign in');
    }
  };

  const handleContinueToPaymentMethods = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('Missing info', 'Please enter your email and password first.');
      return;
    }
    if (emailError) {
      Alert.alert('Invalid email', emailError);
      return;
    }

    navigation.navigate('BillingPayments', {
      setupTrial: true,
      email: normalizedEmail,
      password,
      selectedBilling: 'monthly',
      selectedPrice: 20,
      billingLabel: 'month',
    });
  };

  const handleRequestAccess = () => {
    // Navigate to registration/subscription screen
    navigation.navigate('Subscription');
  };

  const handleForgotPassword = () => {
    const normalized = email.trim().toLowerCase();
    if (normalized) {
      navigation.navigate('ForgotPassword', { email: normalized });
      return;
    }
    navigation.navigate('ForgotPassword');
  };

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Container>
          <View style={styles.contentInner}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={24} color={theme.colors.text} />
              <Text variant="body" color={theme.colors.text} style={styles.backButtonText}>
                Back
              </Text>
            </TouchableOpacity>

            {/* Hero */}
            <LinearGradient
              colors={[theme.colors.surface, theme.colors.surfaceLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.heroCard,
                { borderColor: theme.colors.border, padding: isSmallScreen ? 16 : 18 },
              ]}
            >
              <View style={styles.brandLogoRow}>
                <BrandLogo style={styles.brandLogo} />
              </View>

              <Text variant="h4" style={styles.headline}>
                Professional trading, simplified.
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.signInHint}>
                Sign in to continue.
              </Text>
            </LinearGradient>

            {/* Form Card */}
            <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="trader@example.com"
                keyboardType="email-address"
                leftAccessory={<Icon name="mail" size={20} color={theme.colors.textSecondary} />}
                error={emailError}
              />

              <View style={styles.passwordLabelContainer}>
                <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                  Password
                </Text>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text variant="bodySmall" color={theme.colors.primary} style={styles.forgotPassword}>
                    Forgot?
                  </Text>
                </TouchableOpacity>
              </View>
              <Input
                label=""
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                leftAccessory={<Icon name="lock" size={20} color={theme.colors.textSecondary} />}
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

              <Button
                title={isLoading ? 'Signing in...' : 'Sign in'}
                onPress={handleSignIn}
                variant="primary"
                size="large"
                style={styles.signInButton}
                disabled={isLoading}
              />

              {showPaymentSetupAction && (
                <>
                  <Button
                    title="Continue to Payment Methods"
                    onPress={handleContinueToPaymentMethods}
                    variant="outline"
                    size="large"
                    style={styles.paymentSetupButton}
                    disabled={isLoading}
                  />
                  <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.paymentSetupHint}>
                    Use the same account details to add your payment method and activate your trial.
                  </Text>
                </>
              )}

              <View style={[styles.dividerRow, { borderColor: theme.colors.border }]}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                <Text variant="caption" color={theme.colors.textSecondary} style={styles.dividerText}>
                  OR
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              </View>

              <Button
                title="Request Access"
                onPress={handleRequestAccess}
                variant="outline"
                size="large"
                style={styles.requestAccessButton}
              />

              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.disclaimer}>
                By continuing you agree to our Terms and acknowledge our Privacy Policy.
              </Text>
            </View>
          </View>
          </Container>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentInner: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  heroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  brandLogoRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  brandLogo: {
    transform: [{ scale: 0.82 }],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
  },
  backButtonText: {
    marginLeft: 8,
  },
  signInHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  headline: {
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  formCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  passwordLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eyeInline: {
    padding: 6,
  },
  forgotPassword: {
    fontSize: 14,
  },
  signInButton: {
    width: '100%',
    marginTop: 6,
  },
  paymentSetupButton: {
    width: '100%',
    marginTop: 10,
  },
  paymentSetupHint: {
    marginTop: 8,
    lineHeight: 18,
    textAlign: 'center',
    fontSize: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  dividerText: {
    letterSpacing: 1.2,
  },
  requestAccessButton: {
    width: '100%',
  },
  disclaimer: {
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
  },
});
