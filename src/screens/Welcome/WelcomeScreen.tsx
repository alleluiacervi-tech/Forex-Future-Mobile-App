import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
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
              style={[styles.heroCard, { borderColor: theme.colors.border }]}
            >
              <View
                style={[
                  styles.brandMark,
                  {
                    borderColor: theme.colors.accent,
                    backgroundColor: theme.colors.surfaceLight,
                  },
                ]}
              >
                <Image
                  source={require('../../../assets/image.png')}
                  resizeMode="contain"
                  style={styles.brandLogo}
                />
              </View>

              <Text variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
                Get AI‑driven market insights to support smarter financial decisions.
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.signInHint}>
                Sign in to continue
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
  brandMark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 14,
  },
  brandLogo: {
    width: 68,
    height: 68,
    borderRadius: 16,
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
  signInHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
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
