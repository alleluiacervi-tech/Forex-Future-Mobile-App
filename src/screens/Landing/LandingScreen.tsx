import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
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
  const { width, height } = Dimensions.get('window');

  // Responsive sizing
  const isSmallScreen = height < 700;
  const isNarrowScreen = width < 380;

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, {
          paddingHorizontal: Math.min(width * 0.06, 24),
          paddingTop: Math.max(height * 0.08, 40),
          paddingBottom: Math.max(height * 0.05, 20),
        }]}>
          {/* App Icon */}
          <View style={[styles.iconWrapper, { marginBottom: height * 0.05 }]}>
            <View style={styles.logoContainer}>
              <Text style={[styles.logoText, {
                color: theme.colors.primary,
                fontSize: Math.min(width * 0.12, isSmallScreen ? 36 : 48),
              }]}>
                FX
              </Text>
              <Text style={[styles.logoSubText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.05, isSmallScreen ? 14 : 18),
              }]}>
                Future
              </Text>
            </View>
          </View>

          {/* Headline */}
          <View style={[styles.headlineContainer, { marginBottom: height * 0.02 }]}>
            <Text style={[styles.headline, {
              color: theme.colors.text,
              fontSize: Math.min(width * 0.08, isSmallScreen ? 28 : 36),
              lineHeight: Math.min(width * 0.1, isSmallScreen ? 32 : 44),
            }]}>
              Welcome to{' '}
              <Text style={[styles.headline, { color: theme.colors.primary }]}>
                Forex Future
              </Text>
            </Text>
          </View>

          {/* Brief description */}
          <View style={[styles.descriptionContainer, { marginBottom: height * 0.04 }]}>
            <Text style={[styles.description, {
              color: theme.colors.text,
              fontSize: Math.min(width * 0.04, isSmallScreen ? 14 : 16),
              lineHeight: Math.min(width * 0.06, isSmallScreen ? 20 : 24),
            }]}>
              Your ultimate forex trading companion. Track markets, analyze trends, and make informed trading decisions with real-time data and advanced charting tools.
            </Text>
          </View>

          {/* Feature highlights */}
          <View style={[styles.featuresContainer, { marginBottom: height * 0.06 }]}>
            <View style={[styles.featureRow, { marginBottom: height * 0.01 }]}>
              <Icon name="trending-up" size={Math.min(width * 0.05, 24)} color={theme.colors.primary} />
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Real-time market data and live price updates
              </Text>
            </View>

            <View style={[styles.featureRow, { marginBottom: height * 0.01 }]}>
              <Icon name="show-chart" size={Math.min(width * 0.05, 24)} color={theme.colors.primary} />
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Advanced charting with multiple timeframes
              </Text>
            </View>

            <View style={[styles.featureRow, { marginBottom: height * 0.01 }]}>
              <Icon name="notifications" size={Math.min(width * 0.05, 24)} color={theme.colors.primary} />
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Price alerts and market notifications
              </Text>
            </View>

            <View style={styles.featureRow}>
              <Icon name="account-balance-wallet" size={Math.min(width * 0.05, 24)} color={theme.colors.primary} />
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Portfolio tracking and performance analytics
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={[styles.buttonsContainer, { gap: height * 0.02, marginTop: height * 0.01 }]}>
            <TouchableOpacity
              style={[styles.exploreButton, {
                backgroundColor: theme.colors.surface,
                paddingVertical: Math.max(height * 0.02, 12),
                paddingHorizontal: Math.min(width * 0.05, 20),
                borderRadius: Math.min(width * 0.03, 12),
              }]}
              onPress={handleExploreFeatures}
            >
              <Text style={[styles.exploreButtonText, {
                color: theme.colors.primary,
                fontSize: Math.min(width * 0.04, isSmallScreen ? 14 : 16),
              }]}>
                Explore Features
              </Text>
              <Icon name="arrow-forward" size={Math.min(width * 0.04, 20)} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.signInButton, {
                backgroundColor: theme.colors.primary,
                paddingVertical: Math.max(height * 0.025, 14),
                paddingHorizontal: Math.min(width * 0.05, 20),
                borderRadius: Math.min(width * 0.03, 12),
              }]}
              onPress={handleSignIn}
            >
              <Text style={[styles.signInButtonText, {
                color: theme.colors.onPrimary,
                fontSize: Math.min(width * 0.045, isSmallScreen ? 16 : 18),
              }]}>
                Get Started
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Math.max(height * 0.04, 20) }]}>
            <Text style={[styles.footerText, {
              color: theme.colors.textSecondary,
              fontSize: Math.min(width * 0.025, 10),
            }]}>
              © 2025 Forex Future. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logoSubText: {
    fontWeight: '600',
  },
  headlineContainer: {},
  headline: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  descriptionContainer: {},
  description: {
    textAlign: 'center',
    opacity: 0.8,
  },
  featuresContainer: {},
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
  },
  buttonsContainer: {},
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exploreButtonText: {
    fontWeight: '600',
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    letterSpacing: 1,
    fontWeight: '500',
  },
});
