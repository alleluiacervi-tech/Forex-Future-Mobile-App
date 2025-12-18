import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../../types';
import { Text } from '../../components/common';
import { useTheme } from '../../hooks';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleExploreFeatures = () => {
    // Navigate to about screen
    navigation.navigate('About');
  };

  const handleSignIn = () => {
    // Navigate to welcome/login screen
    navigation.navigate('Welcome');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.iconWrapper}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logoText, { color: theme.colors.primary }]}>
              FX
            </Text>
            <Text style={[styles.logoSubText, { color: theme.colors.text }]}>
              Future
            </Text>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.headlineContainer}>
          <Text style={[styles.headline, { color: theme.colors.text }]}>
            Welcome to{' '}
            <Text style={[styles.headline, { color: theme.colors.primary }]}>
              Forex Future
            </Text>
          </Text>
        </View>

        {/* Brief description */}
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: theme.colors.text }]}>
            Your ultimate forex trading companion. Track markets, analyze trends, and make informed trading decisions with real-time data and advanced charting tools.
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <Icon name="trending-up" size={24} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Real-time market data and live price updates
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Icon name="show-chart" size={24} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Advanced charting with multiple timeframes
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Icon name="notifications" size={24} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Price alerts and market notifications
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Icon name="account-balance-wallet" size={24} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              Portfolio tracking and performance analytics
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.exploreButton, { backgroundColor: theme.colors.surface }]}
            onPress={handleExploreFeatures}
          >
            <Text style={[styles.exploreButtonText, { color: theme.colors.primary }]}>
              Explore Features
            </Text>
            <Icon name="arrow-forward" size={20} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSignIn}
          >
            <Text style={[styles.signInButtonText, { color: theme.colors.onPrimary }]}>
              Get Started
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            © 2025 Forex Future. All rights reserved.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logoSubText: {
    fontSize: 18,
    fontWeight: '600',
  },
  headlineContainer: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 44,
    textAlign: 'center',
  },
  descriptionContainer: {
    marginBottom: 32,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.8,
  },
  featuresContainer: {
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonsContainer: {
    gap: 16,
    marginTop: 8,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '500',
  },
});
