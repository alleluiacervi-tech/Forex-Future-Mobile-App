import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

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
        navigation.replace('VerifyEmail', {
          email: normalizedEmail,
          debugCode: verification?.debugCode,
          debugExpiresAt: verification?.debugExpiresAt,
          nextScreen: 'Welcome',
        });
        return;
      }

      Alert.alert('Success', 'Your account has been created. You can now sign in.');
      navigation.replace('Welcome');
    } catch (error) {
      console.error('[RegisterScreen] Registration error:', error);
      const message = error instanceof Error ? error.message : 'Registration failed';
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
                onChangeText={(t) => {
                  setName(t);
                }}
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
  submitButton: { marginTop: 12 },
  signInPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});
