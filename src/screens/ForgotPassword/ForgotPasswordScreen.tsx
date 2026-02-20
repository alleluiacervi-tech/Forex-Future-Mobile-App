import React, { useMemo, useState } from 'react';
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
type ScreenRouteProp = RouteProp<RootStackParamList, 'ForgotPassword'>;

const getStringParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
};

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const theme = useTheme();
  const { requestPasswordReset, isLoading } = useAuth();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [touched, setTouched] = useState(false);

  const emailError = useMemo(() => {
    if (!touched) return undefined;
    if (!email.trim()) return 'Email is required';
    const normalized = email.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return ok ? undefined : 'Enter a valid email address';
  }, [email, touched]);

  const handleSubmit = async () => {
    setTouched(true);
    if (emailError) {
      Alert.alert('Invalid email', emailError);
      return;
    }

    const normalized = email.trim().toLowerCase();

    try {
      const result = await requestPasswordReset(normalized);
      const message =
        typeof result?.message === 'string' && result.message
          ? result.message
          : "If an account exists for that email, you'll receive reset instructions shortly.";

      Alert.alert('Check your email', message);

      let resolvedDebugToken = result?.debugToken;
      if (!resolvedDebugToken && result?.debugLink) {
        const parsed = Linking.parse(result.debugLink);
        resolvedDebugToken = getStringParam(parsed.queryParams?.token);
      }

      if (resolvedDebugToken) {
        Alert.alert('Dev token (debug)', resolvedDebugToken);
      }

      navigation.navigate('ResetPassword', {
        email: normalized,
        token: resolvedDebugToken,
      });
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to request reset');
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
            Forgot Password
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.subtitle}>
              Enter your email and we’ll send you a reset link or token.
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (!touched) setTouched(true);
              }}
              placeholder="trader@example.com"
              keyboardType="email-address"
              error={emailError}
            />

            <Button
              title="Send reset instructions"
              onPress={handleSubmit}
              variant="primary"
              size="large"
              loading={isLoading}
              disabled={isLoading}
              style={styles.submit}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ResetPassword')}
              activeOpacity={0.7}
              style={styles.secondaryLink}
            >
              <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                I already have a token
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
