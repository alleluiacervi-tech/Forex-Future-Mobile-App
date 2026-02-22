import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Input, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;

const getStringParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
};

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const theme = useTheme();
  const { resetPassword, isLoading } = useAuth();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState(route.params?.code ?? route.params?.debugCode ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, code: false, newPassword: false, confirmPassword: false });

  useEffect(() => {
    const applyCode = (value?: string) => {
      if (!value || !value.trim()) return;
      setCode((current) => (current.trim() ? current : value.trim()));
    };

    const applyEmail = (value?: string) => {
      if (!value || !value.trim()) return;
      setEmail((current) => (current.trim() ? current : value.trim()));
    };

    applyEmail(route.params?.email);
    applyCode(route.params?.code ?? route.params?.debugCode);

    const applyFromUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = parsed.path || '';
      if (!path.includes('reset-password')) return;
      applyEmail(getStringParam(parsed.queryParams?.email));
      applyCode(getStringParam(parsed.queryParams?.code));
    };

    void Linking.getInitialURL().then(applyFromUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => applyFromUrl(url));

    return () => subscription.remove();
  }, [route.params?.code, route.params?.debugCode, route.params?.email]);

  const emailError = useMemo(() => {
    if (!touched.email) return undefined;
    if (!email.trim()) return 'Email is required';
    const normalized = email.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return ok ? undefined : 'Enter a valid email address';
  }, [email, touched.email]);

  const codeError = useMemo(() => {
    if (!touched.code) return undefined;
    const cleaned = code.replace(/\s+/g, '');
    if (!cleaned) return 'Reset code is required';
    if (cleaned.length < 4) return 'Code looks too short';
    return undefined;
  }, [code, touched.code]);

  const passwordError = useMemo(() => {
    if (!touched.newPassword) return undefined;
    if (!newPassword) return 'New password is required';
    if (newPassword.length < 8) return 'Use at least 8 characters';
    if (!/[A-Z]/.test(newPassword)) return 'Add an uppercase letter';
    if (!/[a-z]/.test(newPassword)) return 'Add a lowercase letter';
    if (!/[0-9]/.test(newPassword)) return 'Add a number';
    return undefined;
  }, [newPassword, touched.newPassword]);

  const confirmError = useMemo(() => {
    if (!touched.confirmPassword) return undefined;
    if (!confirmPassword) return 'Confirm your password';
    if (confirmPassword !== newPassword) return 'Passwords do not match';
    return undefined;
  }, [confirmPassword, newPassword, touched.confirmPassword]);

  const canSubmit = !emailError && !codeError && !passwordError && !confirmError && email && code && newPassword && confirmPassword;

  const handleSubmit = async () => {
    setTouched({ email: true, code: true, newPassword: true, confirmPassword: true });
    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    try {
      const result = await resetPassword(email.trim().toLowerCase(), code.replace(/\s+/g, ''), newPassword);
      const message =
        typeof result?.message === 'string' && result.message
          ? result.message
          : 'Password reset successfully. Please log in with your new password.';

      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Welcome'),
        },
      ]);
    } catch (error) {
      Alert.alert('Reset failed', error instanceof Error ? error.message : 'Unable to reset password');
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text variant="h3" style={styles.title}>
            Reset Password
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
              Enter your email, reset code, and choose a new password.
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (!touched.email) setTouched((p) => ({ ...p, email: true }));
              }}
              placeholder="trader@example.com"
              keyboardType="email-address"
              error={emailError}
            />

            <Input
              label="Reset Code"
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (!touched.code) setTouched((p) => ({ ...p, code: true }));
              }}
              placeholder="123456"
              keyboardType="numeric"
              error={codeError}
            />

            <Input
              label="New Password"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                if (!touched.newPassword) setTouched((p) => ({ ...p, newPassword: true }));
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
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (!touched.confirmPassword) setTouched((p) => ({ ...p, confirmPassword: true }));
              }}
              placeholder="••••••••"
              secureTextEntry={!showConfirmPassword}
              error={confirmError}
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

            <Button
              title="Set new password"
              onPress={handleSubmit}
              variant="primary"
              size="large"
              loading={isLoading}
              disabled={isLoading}
              style={styles.submit}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
              style={styles.secondaryLink}
            >
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                  Need a new code?
                </Text>
              </TouchableOpacity>
          </Card>
        </View>
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  backButton: {
    padding: 8,
  },
  title: {
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  subtitle: {
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
  },
  secondaryLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  eyeInline: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
