import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/layout';
import { Button, Card, Input, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const theme = useTheme();
  const { resetPassword, isLoading } = useAuth();

  const [token, setToken] = useState(route.params?.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ token: false, newPassword: false, confirmPassword: false });

  const tokenError = useMemo(() => {
    if (!touched.token) return undefined;
    if (!token.trim()) return 'Token is required';
    if (token.trim().length < 20) return 'Token looks too short';
    return undefined;
  }, [token, touched.token]);

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

  const canSubmit = !tokenError && !passwordError && !confirmError && token && newPassword && confirmPassword;

  const handleSubmit = async () => {
    setTouched({ token: true, newPassword: true, confirmPassword: true });
    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    try {
      const result = await resetPassword(token.trim(), newPassword);
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
              Paste the token from your email and choose a new password.
            </Text>

            <Input
              label="Reset Token"
              value={token}
              onChangeText={(value) => {
                setToken(value);
                if (!touched.token) setTouched((p) => ({ ...p, token: true }));
              }}
              placeholder="eyJhbGciOi..."
              error={tokenError}
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
                Need a new token?
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

