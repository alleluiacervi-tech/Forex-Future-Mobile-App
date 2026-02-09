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

export default function AuthScreenExample() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { register, verifyEmail, resendEmailVerification, startTrial, isLoading } = useAuth();

  const [screen, setScreen] = useState<'subscription' | 'signup' | 'verify' | 'trial'>('subscription');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Validation
  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

  const nameError = useMemo(() => {
    if (!touched.name) return undefined;
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return undefined;
  }, [name, touched.name]);

  const emailError = useMemo(() => {
    if (!touched.email) return undefined;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return 'Email is required';
    if (!validateEmail(normalized)) return 'Enter a valid email address';
    return undefined;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return undefined;
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Use at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Add a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Add a number';
    return undefined;
  }, [password, touched.password]);

  const confirmPasswordError = useMemo(() => {
    if (!touched.confirmPassword) return undefined;
    if (!confirmPassword) return 'Confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return undefined;
  }, [confirmPassword, password, touched.confirmPassword]);

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (nameError || emailError || passwordError || confirmPasswordError) {
      Alert.alert('Validation Error', 'Please fix the errors above');
      return;
    }

    try {
      const trimmedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      setName(trimmedName);
      setEmail(normalizedEmail);

      const verification = await register(trimmedName, normalizedEmail, password);
      if (verification?.verificationUnavailable) {
        Alert.alert(
          'Verification unavailable',
          'Email verification is temporarily unavailable. Please try again later.',
        );
        return;
      }

      if (verification?.verificationRequired) {
        if (verification?.debugCode) {
          setVerificationCode(verification.debugCode);
        }
        setScreen('verify');
        Alert.alert('Success', 'Account created! Please verify your email.');
        return;
      }

      setScreen('trial');
      Alert.alert('Success', 'Account created! Please activate your free trial.');
    } catch (error) {
      Alert.alert('Registration Error', error instanceof Error ? error.message : 'Failed to register');
    }
  };

  const handleVerifyEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanedCode = verificationCode.replace(/\s+/g, '');

    if (!normalizedEmail || !validateEmail(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!cleanedCode || cleanedCode.length < 4) {
      Alert.alert('Invalid code', 'Please enter the verification code from your email.');
      return;
    }

    try {
      await verifyEmail(normalizedEmail, cleanedCode);
      Alert.alert('Verified', 'Your email is verified. You can now activate your free trial.');
      setScreen('trial');
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Unable to verify email');
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !validateEmail(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    try {
      const result = await resendEmailVerification(normalizedEmail);
      Alert.alert(
        'Sent',
        typeof result?.message === 'string' && result.message
          ? result.message
          : 'If the account exists, a new verification code will be sent shortly.',
      );

      if (result?.debugCode) {
        setVerificationCode(result.debugCode);
      }
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to resend code');
    }
  };

  const handleStartTrial = async () => {
    try {
      await startTrial(email.trim().toLowerCase(), password);
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Trial Error', error instanceof Error ? error.message : 'Failed to start trial');
    }
  };

  const handleSignIn = () => {
    navigation.navigate('Welcome');
  };

  return (
    <ScreenWrapper style={styles.screen}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.surface, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <BrandLogo style={styles.logo} />
          </View>

          {screen === 'subscription' && (
            <View style={styles.content}>
              <Text variant="h3" style={styles.title}>
                Try Risk-Free
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
                Get 14 days to explore all premium features
              </Text>

              <Card style={[styles.trialCard, { backgroundColor: theme.colors.primary + '15' }]}>
                <View style={styles.trialContent}>
                  <Icon name="stars" size={32} color={theme.colors.primary} />
                  <Text variant="h4" style={[styles.trialTitle, { color: theme.colors.primary }]}>
                    14‑Day Free Trial
                  </Text>
                  <Text variant="bodySmall" color={theme.colors.textSecondary}>
                    Create account • Activate trial • Start trading
                  </Text>
                </View>
              </Card>

              <Button
                title="Create Account"
                onPress={() => setScreen('signup')}
                variant="primary"
                size="large"
              />

              <View style={styles.signInPrompt}>
                <Text variant="body" color={theme.colors.textSecondary}>
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity onPress={handleSignIn} activeOpacity={0.7}>
                  <Text variant="body" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {screen === 'signup' && (
            <View style={styles.content}>
              <Text variant="h3" style={styles.title}>
                Create Account
              </Text>

              <Card style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Input
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                    placeholder="John Doe"
                    leftAccessory={<Icon name="person" size={20} color={theme.colors.textSecondary} />}
                    error={nameError}
                  />
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Input
                    label="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                    placeholder="trader@example.com"
                    keyboardType="email-address"
                    leftAccessory={<Icon name="mail" size={20} color={theme.colors.textSecondary} />}
                    error={emailError}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text variant="body" color={theme.colors.textSecondary} style={styles.passwordLabel}>
                    Password
                  </Text>
                  <Input
                    label=""
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    leftAccessory={<Icon name="lock" size={20} color={theme.colors.textSecondary} />}
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                        <Icon
                          name={showPassword ? 'visibility' : 'visibility-off'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    }
                    error={passwordError}
                  />
                  {password && (
                    <View style={styles.passwordRequirements}>
                      <Text
                        variant="bodySmall"
                        color={password.length >= 8 ? theme.colors.success : theme.colors.textSecondary}
                      >
                        ✓ At least 8 characters
                      </Text>
                      <Text
                        variant="bodySmall"
                        color={/[A-Z]/.test(password) ? theme.colors.success : theme.colors.textSecondary}
                      >
                        ✓ One uppercase letter
                      </Text>
                      <Text
                        variant="bodySmall"
                        color={/[a-z]/.test(password) ? theme.colors.success : theme.colors.textSecondary}
                      >
                        ✓ One lowercase letter
                      </Text>
                      <Text
                        variant="bodySmall"
                        color={/[0-9]/.test(password) ? theme.colors.success : theme.colors.textSecondary}
                      >
                        ✓ One number
                      </Text>
                    </View>
                  )}
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Input
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                    placeholder="••••••••"
                    secureTextEntry={!showConfirmPassword}
                    leftAccessory={<Icon name="lock" size={20} color={theme.colors.textSecondary} />}
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowConfirmPassword((v) => !v)} activeOpacity={0.7}>
                        <Icon
                          name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    }
                    error={confirmPasswordError}
                  />
                </View>

                <Button
                  title="Create Account"
                  onPress={handleSignUp}
                  variant="primary"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                />

                <TouchableOpacity
                  onPress={() => setScreen('subscription')}
                  activeOpacity={0.7}
                  style={styles.backButton}
                >
                  <Text variant="body" color={theme.colors.primary}>
                    ← Back
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}

          {screen === 'verify' && (
            <View style={styles.content}>
              <Text variant="h3" style={styles.title}>
                Verify Email
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
                Enter the verification code we sent to your email
              </Text>

              <Card style={[styles.formCard, { backgroundColor: theme.colors.surface }]}>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  editable={false}
                  placeholder={email}
                  leftAccessory={<Icon name="mail" size={20} color={theme.colors.textSecondary} />}
                />

                <View style={styles.inputGroup}>
                  <Input
                    label="Verification Code"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="123456"
                    keyboardType="numeric"
                    leftAccessory={<Icon name="vpn-key" size={20} color={theme.colors.textSecondary} />}
                  />
                </View>

                <Button
                  title="Verify Email"
                  onPress={handleVerifyEmail}
                  variant="primary"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                />

                <TouchableOpacity
                  onPress={handleResendVerification}
                  activeOpacity={0.7}
                  style={styles.backButton}
                  disabled={isLoading}
                >
                  <Text variant="body" color={theme.colors.primary}>
                    Resend code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setScreen('signup')}
                  activeOpacity={0.7}
                  style={styles.backButton}
                >
                  <Text variant="body" color={theme.colors.primary}>
                    ← Back
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}

          {screen === 'trial' && (
            <View style={styles.content}>
              <Text variant="h3" style={styles.title}>
                Activate Free Trial
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
                Confirm your email and password to start your 14-day trial
              </Text>

              <Card style={[styles.formCard, { backgroundColor: theme.colors.surface }]}>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  editable={false}
                  placeholder={email}
                  leftAccessory={<Icon name="mail" size={20} color={theme.colors.textSecondary} />}
                />

                <View style={styles.inputGroup}>
                  <Input
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    leftAccessory={<Icon name="lock" size={20} color={theme.colors.textSecondary} />}
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                        <Icon
                          name={showPassword ? 'visibility' : 'visibility-off'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    }
                  />
                </View>

                <Button
                  title="Start Free Trial"
                  onPress={handleStartTrial}
                  variant="primary"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                />

                <TouchableOpacity
                  onPress={() => setScreen('signup')}
                  activeOpacity={0.7}
                  style={styles.backButton}
                >
                  <Text variant="body" color={theme.colors.primary}>
                    ← Back
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  background: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingVertical: 20 },
  headerContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 80, height: 80 },
  content: { paddingHorizontal: 16 },
  title: { marginBottom: 8, fontWeight: '900' },
  subtitle: { marginBottom: 24, lineHeight: 20 },
  trialCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  trialContent: { alignItems: 'center' },
  trialTitle: { marginVertical: 8, fontWeight: '700' },
  formCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 16 },
  passwordLabel: { marginBottom: 8, fontWeight: '500' },
  passwordRequirements: { marginTop: 8, gap: 4 },
  signInPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  backButton: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
});
