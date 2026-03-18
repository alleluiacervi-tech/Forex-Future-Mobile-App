import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button, Input, BrandLogo } from '../../components/common';
import { useTheme } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { ONBOARDING_STORAGE_KEY } from '../Onboarding';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { login, verifyEmail, resendEmailVerification, isLoading, isAuthenticated, user } = useAuth();
  const { height } = Dimensions.get('window');
  const isSmallScreen = height < 700;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPaymentSetupAction, setShowPaymentSetupAction] = useState(false);
  // FIXED: added emailTouched state so validation error doesn't show while user is still typing
  const [emailTouched, setEmailTouched] = useState(false);
  const [showVerificationAction, setShowVerificationAction] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [isSendingVerificationCode, setIsSendingVerificationCode] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  const emailError = useMemo(() => {
    if (!emailTouched || !email) return undefined;
    const normalized = email.trim().toLowerCase();
    const ok = EMAIL_REGEX.test(normalized);
    return ok ? undefined : 'Enter a valid email address';
  }, [email, emailTouched]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (user?.isAdmin) {
        navigation.replace('AdminDashboard');
        return;
      }
      AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((seen) => {
        navigation.replace(seen === 'true' ? 'Main' : 'Onboarding');
      });
    }
  }, [isAuthenticated, isLoading, navigation, user?.isAdmin]);

  const getNormalizedEmail = () => email.trim().toLowerCase();

  const handleSendVerificationCode = async () => {
    setEmailTouched(true);
    const normalizedEmail = getNormalizedEmail();
    if (!normalizedEmail) {
      Alert.alert('Missing email', 'Please enter your email address first.');
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    try {
      setIsSendingVerificationCode(true);
      const result = await resendEmailVerification(normalizedEmail);
      setVerificationCodeSent(true);
      if (result?.debugCode) {
        setVerificationCode(result.debugCode);
      }
      Alert.alert('Code sent', `A verification code has been sent to ${normalizedEmail}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send verification code';
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch') || message.toLowerCase().includes('connect')) {
        Alert.alert('No connection', 'No internet connection. Check your network and try again.');
        return;
      }
      Alert.alert('Request failed', message);
    } finally {
      setIsSendingVerificationCode(false);
    }
  };

  const handleVerifyEmailInline = async () => {
    setEmailTouched(true);
    const normalizedEmail = getNormalizedEmail();
    if (!normalizedEmail) {
      Alert.alert('Missing email', 'Please enter your email address first.');
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    const cleanedCode = verificationCode.replace(/\s+/g, '');
    if (!cleanedCode) {
      Alert.alert('Missing code', 'Enter the verification code from your email.');
      return;
    }

    try {
      setIsVerifyingEmail(true);
      await verifyEmail(normalizedEmail, cleanedCode);
      setShowVerificationAction(false);
      setVerificationCodeSent(false);
      setVerificationCode('');
      Alert.alert('Email verified', 'Your email is verified. Sign in again to continue.');
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
      if (errorCode === 'AUTH_OTP_INVALID') {
        Alert.alert('Incorrect code', 'Incorrect code. Please try again.');
        return;
      }
      if (errorCode === 'AUTH_OTP_EXPIRED') {
        Alert.alert('Code expired', 'This code has expired. Send a new code and try again.');
        return;
      }
      if (errorCode === 'AUTH_OTP_MAX_ATTEMPTS') {
        Alert.alert('Too many attempts', 'Too many incorrect attempts. Send a new code and try again.');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to verify email';
      Alert.alert('Verification failed', message);
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleSignIn = async () => {
    setEmailTouched(true); // FIXED: mark touched on submit so validation shows

    // ADDED: User feedback message for empty email
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    // ADDED: User feedback message for empty password
    if (!password) {
      Alert.alert('Missing password', 'Please enter your password.');
      return;
    }

    // FIXED: validate inline since emailError memo may not reflect touched state yet
    const normalizedCheck = email.trim().toLowerCase();
    const isValidEmail = EMAIL_REGEX.test(normalizedCheck);
    // ADDED: User feedback message for invalid email format
    if (!isValidEmail) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setShowVerificationAction(false);
    setVerificationCodeSent(false);
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
      // FIXED: removed manual navigation.replace('Main') — the useEffect watching
      // isAuthenticated handles navigation to avoid double-navigation race condition
    } catch (error) {
      // FIX: Extract error code for specific user feedback messages
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

      const verificationRequired =
        typeof error === 'object' &&
        error !== null &&
        ((error as { verificationRequired?: boolean }).verificationRequired || errorCode === 'AUTH_EMAIL_NOT_VERIFIED');
      if (verificationRequired) {
        setShowVerificationAction(true);
        setShowPaymentSetupAction(false);
        setVerificationCodeSent(false);
        // ADDED: User feedback message for unverified email
        Alert.alert(
          'Email not verified',
          'Your email is not verified yet. Use the Verify Email section below to request a code and verify.',
        );
        return;
      }

      const trialRequired =
        (typeof error === 'object' && error !== null && (error as { trialRequired?: boolean }).trialRequired) ||
        errorCode === 'SUB_TRIAL_EXPIRED' ||
        (error instanceof Error &&
          (error.message.toLowerCase().includes('trial must be activated') ||
            error.message.toLowerCase().includes('free trial must be activated')));
      if (trialRequired) {
        setShowVerificationAction(false);
        setVerificationCodeSent(false);
        setShowPaymentSetupAction(true);
        // ADDED: User feedback message for trial expired / payment required
        const isExpired = error instanceof Error && error.message.toLowerCase().includes('expired');
        Alert.alert(
          isExpired ? 'Trial expired' : 'Payment setup required',
          isExpired
            ? 'Your free trial has ended. Add a payment method to continue.'
            : 'Continue to payment methods to activate your trial, then sign in again.',
        );
        return;
      }

      // ADDED: User feedback message for network errors
      const message = error instanceof Error ? error.message : 'Unable to sign in';
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch') || message.toLowerCase().includes('connect')) {
        Alert.alert('No connection', 'No internet connection. Check your network and try again.');
        return;
      }
      // ADDED: User feedback message for server errors
      if (message.toLowerCase().includes('server') || message.toLowerCase().includes('500')) {
        Alert.alert('Server error', 'Something went wrong on our end. Please try again in a moment.');
        return;
      }

      // ADDED: User feedback message for user not found
      if (errorCode === 'AUTH_USER_NOT_FOUND') {
        Alert.alert('Sign in failed', 'No account found with this email.');
        return;
      }
      // ADDED: User feedback message for wrong password
      if (errorCode === 'AUTH_INVALID_CREDENTIALS') {
        Alert.alert('Sign in failed', 'Incorrect password. Please try again.');
        return;
      }
      // ADDED: User feedback message for account suspended
      if (errorCode === 'AUTH_ACCOUNT_SUSPENDED') {
        Alert.alert('Account suspended', 'Your account has been suspended. Please contact support.');
        return;
      }
      // ADDED: User feedback message for rate limiting
      if (errorCode === 'RATE_LIMIT_EXCEEDED' || message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('too many')) {
        Alert.alert('Too many attempts', 'Too many failed attempts. Please wait before trying again.');
        return;
      }

      Alert.alert('Sign in failed', message);
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
    const normalizedEmail = email.trim().toLowerCase();
    navigation.navigate('BillingPayments', {
      setupTrial: true,
      email: normalizedEmail || undefined,
      password: password || undefined,
      selectedBilling: 'monthly',
      selectedPrice: 20,
      billingLabel: 'month',
    });
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

              {showVerificationAction && (
                <View style={[styles.verificationCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.verificationHint}>
                    Email verification is required before sign in.
                  </Text>
                  <Button
                    title={isSendingVerificationCode ? 'Sending code...' : 'Send verification code'}
                    onPress={handleSendVerificationCode}
                    variant="outline"
                    size="large"
                    style={styles.verificationActionButton}
                    disabled={isLoading || isVerifyingEmail || isSendingVerificationCode}
                  />
                  {verificationCodeSent && (
                    <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.verificationHint}>
                      Check your email inbox for the OTP, then enter it below.
                    </Text>
                  )}
                  <View style={styles.verificationInputWrap}>
                    <Input
                      label="Verification code"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="123456"
                      keyboardType="numeric"
                      leftAccessory={<Icon name="verified-user" size={20} color={theme.colors.textSecondary} />}
                    />
                  </View>
                  <Button
                    title={isVerifyingEmail ? 'Verifying...' : 'Verify email'}
                    onPress={handleVerifyEmailInline}
                    variant="primary"
                    size="large"
                    style={styles.verificationActionButton}
                    disabled={isLoading || isVerifyingEmail || isSendingVerificationCode}
                  />
                </View>
              )}

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
                title="Create account"
                onPress={() => navigation.navigate('Register')}
                variant="outline"
                size="large"
                style={styles.requestAccessButton}
              />
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
  verificationCard: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  verificationHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  verificationActionButton: {
    width: '100%',
    marginTop: 6,
  },
  verificationInputWrap: {
    marginTop: 8,
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
