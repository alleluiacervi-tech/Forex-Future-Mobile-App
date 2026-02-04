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
type ScreenRouteProp = RouteProp<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const theme = useTheme();
  const { verifyEmail, resendEmailVerification, isLoading } = useAuth();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState(route.params?.debugCode ?? '');
  const [touched, setTouched] = useState({ email: false, code: false });

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
    if (!cleaned) return 'Verification code is required';
    if (cleaned.length < 4) return 'Code looks too short';
    return undefined;
  }, [code, touched.code]);

  const canSubmit = !emailError && !codeError && email.trim() && code.trim();

  const handleVerify = async () => {
    setTouched({ email: true, code: true });
    if (!canSubmit) {
      Alert.alert('Validation error', 'Please fix the errors and try again.');
      return;
    }

    const normalized = email.trim().toLowerCase();
    const cleaned = code.replace(/\s+/g, '');

    try {
      await verifyEmail(normalized, cleaned);
      Alert.alert('Verified', 'Your email is verified.', [
        {
          text: 'Continue',
          onPress: () => {
            const nextScreen = route.params?.nextScreen;
            if (nextScreen) {
              navigation.replace(nextScreen as any, route.params?.nextParams as any);
              return;
            }
            navigation.replace('Welcome');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Unable to verify email');
    }
  };

  const handleResend = async () => {
    setTouched((p) => ({ ...p, email: true }));
    if (emailError) {
      Alert.alert('Invalid email', emailError);
      return;
    }

    const normalized = email.trim().toLowerCase();
    try {
      const result = await resendEmailVerification(normalized);
      Alert.alert(
        'Sent',
        typeof result?.message === 'string' && result.message
          ? result.message
          : 'If the account exists, a new verification code will be sent shortly.',
      );
      if (result?.debugCode) {
        setCode(result.debugCode);
        Alert.alert('Dev code (debug)', result.debugCode);
      }
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to resend code');
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
            Verify Email
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
              Enter the 6‑digit code we sent to your email.
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
              label="Verification code"
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (!touched.code) setTouched((p) => ({ ...p, code: true }));
              }}
              placeholder="123456"
              keyboardType="number-pad"
              error={codeError}
            />

            <Button
              title="Verify"
              onPress={handleVerify}
              variant="primary"
              size="large"
              loading={isLoading}
              disabled={isLoading}
              style={styles.submit}
            />

            <TouchableOpacity onPress={handleResend} activeOpacity={0.7} style={styles.secondaryLink}>
              <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                Resend code
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
});

