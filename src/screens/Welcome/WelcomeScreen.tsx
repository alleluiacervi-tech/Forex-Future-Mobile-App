import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { width, height } = Dimensions.get('window');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = () => {
    // Navigate to main app after sign in
    navigation.replace('Main');
  };

  const handleRequestAccess = () => {
    // Navigate to registration/subscription screen
    navigation.navigate('Subscription');
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password screen (if you have one)
    console.log('Forgot Password');
  };

  return (
    <ScreenWrapper>
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

            {/* Brand Logo */}
            <View style={styles.logoWrapper}>
              <View style={styles.logoRow}>
                <View style={styles.logoCandles}>
                  <View style={styles.candleBaseline} />
                  <View style={[styles.logoCandle, styles.logoCandleLeft]} />
                  <View style={[styles.logoCandle, styles.logoCandleCenter]} />
                  <View style={[styles.logoCandle, styles.logoCandleRight]} />
                </View>
                <View style={styles.logoTextBlock}>
                  <Text
                    variant="h2"
                    style={[
                      styles.logoTitle,
                      {
                        color: theme.colors.primary,
                        fontSize: Math.min(width * 0.08, 26),
                      },
                    ]}
                  >
                    FOREX
                  </Text>
                  <Text
                    variant="subtitle"
                    style={[
                      styles.logoSubtitle,
                      {
                        color: theme.colors.textSecondary || theme.colors.text,
                        fontSize: Math.min(width * 0.05, 18),
                      },
                    ]}
                  >
                    Future
                  </Text>
                </View>
              </View>
            </View>

            {/* Title */}
            <Text variant="h1" style={styles.title}>
              Sign in. Trade with confidence.
            </Text>

            {/* Subtitle */}
            <Text variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
              Secure access to your AI‑driven trading terminal.
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                Email Address
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Icon name="mail" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="trader@example.com"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <View style={styles.passwordLabelContainer}>
                <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
                  Password
                </Text>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text variant="bodySmall" color={theme.colors.primary} style={styles.forgotPassword}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Icon name="lock" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  style={styles.eyeIcon}
                >
                  <Icon
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <View style={styles.buttonContainer}>
              <Button
                title="Sign in and launch terminal →"
                onPress={handleSignIn}
                variant="primary"
                size="large"
                style={styles.signInButton}
              />

              {/* Secondary forgot password link */}
              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.forgotInline}>
                  Forgot your password? Reset it securely.
                </Text>
              </TouchableOpacity>
            </View>

            {/* Request Access Link */}
            <View style={styles.registerContainer}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={handleRequestAccess} activeOpacity={0.7}>
                <Text variant="body" color={theme.colors.primary} style={styles.requestAccess}>
                  Request Access
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
  logoWrapper: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCandles: {
    width: 64,
    height: 48,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  candleBaseline: {
    position: 'absolute',
    bottom: 8,
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.5)',
  },
  logoCandle: {
    width: 8,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  logoCandleLeft: {
    height: 22,
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
  logoCandleCenter: {
    height: 30,
    position: 'absolute',
    bottom: 10,
    left: 28,
    backgroundColor: '#3B82F6',
  },
  logoCandleRight: {
    height: 18,
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#EF4444',
  },
  logoTextBlock: {
    justifyContent: 'center',
  },
  logoTitle: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  logoSubtitle: {
    fontWeight: '500',
    letterSpacing: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  backButtonText: {
    marginLeft: 8,
  },
  title: {
    marginBottom: 12,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    marginBottom: 32,
    lineHeight: 24,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 24,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  eyeIcon: {
    marginLeft: 12,
    padding: 4,
  },
  forgotPassword: {
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  signInButton: {
    width: '100%',
  },
  forgotInline: {
    marginTop: 12,
    textAlign: 'center',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  requestAccess: {
    fontSize: 16,
    fontWeight: '500',
  },
});
