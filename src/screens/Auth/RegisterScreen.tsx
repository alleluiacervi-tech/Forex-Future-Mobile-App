import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated } from 'react-native';
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

export default function RegisterScreen() {
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

  // basic validation helpers copied from SubscriptionScreen
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

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'transparent', width: '0%' as const };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels: Array<{ label: string; color: string; width: `${number}%` }> = [
      { label: 'Weak', color: '#EF4444', width: '25%' },
      { label: 'Fair', color: '#F59E0B', width: '50%' },
      { label: 'Good', color: '#3B82F6', width: '75%' },
      { label: 'Strong', color: '#22C55E', width: '100%' },
    ];
    const idx = Math.max(0, Math.min(score - 1, 3));
    return { score, ...levels[idx] };
  }, [password]);

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

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    // ADDED: Specific user feedback messages for validation
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert('Name too short', 'Name must be at least 2 characters.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      Alert.alert('Missing password', 'Please enter a password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      Alert.alert('Password too weak', 'Password must contain at least one uppercase letter and one number.');
      return;
    }
    if (!confirmPassword) {
      Alert.alert('Missing confirmation', 'Please confirm your password.');
      return;
    }
    if (confirmPassword !== password) {
      Alert.alert('Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    console.log('[RegisterScreen] Registration attempt for:', normalizedEmail);
    try {
      const verification = await register(name.trim(), normalizedEmail, password);
      console.log('[RegisterScreen] Register returned:', JSON.stringify(verification));
      if (verification?.verificationUnavailable) {
        Alert.alert(
          'Verification unavailable',
          'Email verification is temporarily unavailable. Please try again later.',
        );
        return;
      }
      if (verification?.verificationRequired) {
        // ADDED: User feedback message for registration success with verification
        Alert.alert('Account created!', 'Check your email for your verification code.');
        navigation.replace('VerifyEmail', {
          email: normalizedEmail,
          debugCode: verification?.debugCode,
          debugExpiresAt: verification?.debugExpiresAt,
          nextScreen: 'Welcome',
        });
        return;
      }

      // ADDED: User feedback message for registration success
      Alert.alert('Account created!', 'Your account has been created. You can now sign in.');
      navigation.replace('Welcome');
    } catch (error) {
      console.error('[RegisterScreen] Registration error:', error);
      // FIX: Extract error code for specific user feedback messages
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
      const message = error instanceof Error ? error.message : 'Registration failed';

      // ADDED: User feedback message for email already exists
      if (errorCode === 'AUTH_EMAIL_EXISTS' || message.toLowerCase().includes('already registered')) {
        Alert.alert(
          'Email already exists',
          'An account with this email already exists. Sign in instead?',
          [
            { text: 'Sign In', onPress: () => navigation.replace('Welcome') },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }
      // ADDED: User feedback message for network errors
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch') || message.toLowerCase().includes('connect')) {
        Alert.alert('Connection failed', 'Connection failed. Check your network.');
        return;
      }

      Alert.alert('Registration failed', message);
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Container>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text variant="h2" style={styles.headerTitle}>
                Create Account
              </Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.logoRow}>
              <BrandLogo />
            </View>

            <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Input
                label="Full Name"
                value={name}
                onChangeText={setName}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Your name"
                leftAccessory={<Icon name="person" size={20} color={theme.colors.textSecondary} />}
                error={nameError}
              />

              <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="trader@example.com"
                keyboardType="email-address"
                leftAccessory={<Icon name="mail" size={20} color={theme.colors.textSecondary} />}
                error={emailError}
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
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
                error={passwordError}
              />

              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthBar,
                        { width: passwordStrength.width, backgroundColor: passwordStrength.color },
                      ]}
                    />
                  </View>
                  <Text variant="caption" style={{ color: passwordStrength.color, marginTop: 4 }}>
                    {passwordStrength.label}
                  </Text>
                </View>
              )}

              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                leftAccessory={<Icon name="lock" size={20} color={theme.colors.textSecondary} />}
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
                error={confirmPasswordError}
              />

              <Button
                title={isLoading ? 'Signing up...' : 'Register'}
                variant="primary"
                size="large"
                style={styles.submitButton}
                onPress={handleSignUp}
                disabled={isLoading}
              />

              <View style={styles.signInPrompt}>
                <Text variant="body" color={theme.colors.textSecondary}>
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.replace('Welcome')} activeOpacity={0.7}>
                  <Text variant="body" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Container>
        </ScrollView>
      </LinearGradient>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  background: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: { padding: 8 },
  headerTitle: { fontWeight: '600' },
  placeholder: { width: 32 },
  logoRow: { alignItems: 'center', marginBottom: 24 },
  formCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  eyeInline: { padding: 6 },
  strengthContainer: { marginTop: -4, marginBottom: 8 },
  strengthTrack: { height: 4, borderRadius: 2, backgroundColor: '#1E293B', overflow: 'hidden' },
  strengthBar: { height: '100%', borderRadius: 2 },
  submitButton: { marginTop: 12 },
  signInPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});
