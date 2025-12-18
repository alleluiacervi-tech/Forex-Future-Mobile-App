import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
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

          {/* Title */}
          <Text variant="h1" style={styles.title}>
            Welcome Back
          </Text>

          {/* Subtitle */}
          <Text variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
            Sign in to access your trading terminal.
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text variant="body" color={theme.colors.textSecondary} style={styles.inputLabel}>
              Email Address
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
              title="Sign In →"
              onPress={handleSignIn}
              variant="primary"
              size="large"
              style={styles.signInButton}
            />
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
    fontSize: 32,
    fontWeight: 'bold',
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
