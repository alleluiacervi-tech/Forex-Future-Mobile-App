import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Container } from '../../components/layout';
import { Text, Button, Input } from '../../components/common';
import { useTheme } from '../../hooks';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { width } = Dimensions.get('window');
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

            {/* Hero */}
            <LinearGradient
              colors={[theme.colors.surface, theme.colors.surfaceLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCard, { borderColor: theme.colors.border }]}
            >
              <View
                style={[
                  styles.brandMark,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <View style={styles.logoCandles}>
                  <View style={styles.candleBaseline} />
                  <View style={[styles.logoCandle, styles.logoCandleLeft, { backgroundColor: theme.colors.success }]} />
                  <View style={[styles.logoCandle, styles.logoCandleCenter, { backgroundColor: theme.colors.info }]} />
                  <View style={[styles.logoCandle, styles.logoCandleRight, { backgroundColor: theme.colors.error }]} />
                </View>
              </View>

              <Text
                variant="h2"
                style={[
                  styles.brandTitle,
                  {
                    color: theme.colors.text,
                    fontSize: Math.min(width * 0.065, 24),
                  },
                ]}
              >
                Sign in to{' '}
                <Text style={[styles.forexWord, { color: theme.colors.primary }]}>Forex</Text>{' '}
                <Text style={[styles.futureWord, { color: theme.colors.text }]}>Future</Text>
              </Text>
              <Text variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
                Get AI‑driven market insights to support smarter financial decisions.
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
                title="Sign in"
                onPress={handleSignIn}
                variant="primary"
                size="large"
                style={styles.signInButton}
              />

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
  heroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 14,
  },
  logoCandles: {
    width: 42,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  candleBaseline: {
    position: 'absolute',
    bottom: 6,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.5)',
  },
  logoCandle: {
    width: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  logoCandleLeft: {
    height: 14,
    position: 'absolute',
    bottom: 10,
    left: 6,
  },
  logoCandleCenter: {
    height: 20,
    position: 'absolute',
    bottom: 10,
    left: 18,
    backgroundColor: '#3B82F6',
  },
  logoCandleRight: {
    height: 12,
    position: 'absolute',
    bottom: 10,
    right: 6,
    backgroundColor: '#EF4444',
  },
  brandTitle: {
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  forexWord: {
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  futureWord: {
    fontWeight: '700',
    letterSpacing: 0.2,
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
  subtitle: {
    marginBottom: 0,
    lineHeight: 22,
    fontSize: 14,
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
