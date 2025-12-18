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
          {/* App Logo */}
          <View style={[styles.logoWrapper, { marginBottom: height * 0.06 }]}>
            <View style={[styles.logoContainer, {
              backgroundColor: theme.colors.surface,
              borderRadius: Math.min(width * 0.04, 20),
              paddingVertical: Math.max(height * 0.025, 20),
              paddingHorizontal: Math.min(width * 0.08, 32),
              shadowColor: theme.colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 12,
              borderWidth: 1,
              borderColor: theme.colors.primary + '30',
              minWidth: Math.min(width * 0.4, 160),
              minHeight: Math.min(height * 0.15, 120),
              maxWidth: Math.min(width * 0.6, 200),
            }]}>
              <Text style={[styles.logoMainText, {
                color: theme.colors.primary,
                fontSize: Math.min(width * 0.12, isSmallScreen ? 36 : 48),
                textShadowColor: theme.colors.primary + '60',
                textShadowOffset: { width: 0, height: 3 },
                textShadowRadius: 6,
              }]}>
                FX
              </Text>
              <Text style={[styles.logoSubText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.05, isSmallScreen ? 16 : 18),
                marginTop: Math.max(height * 0.008, 4),
                opacity: 0.9,
              }]}>
                Future
              </Text>
              <View style={[styles.logoAccent, {
                backgroundColor: theme.colors.primary,
                height: Math.max(height * 0.004, 3),
                width: Math.min(width * 0.12, 60),
                marginTop: Math.max(height * 0.015, 6),
                borderRadius: 2,
                shadowColor: theme.colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
                elevation: 4,
              }]} />
            </View>
          </View>

          {/* Headline */}
          <View style={[styles.headlineContainer, { marginBottom: height * 0.03 }]}>
            <Text style={[styles.headline, {
              color: theme.colors.text,
              fontSize: Math.min(width * 0.08, isSmallScreen ? 28 : 36),
              lineHeight: Math.min(width * 0.1, isSmallScreen ? 32 : 44),
              textAlign: 'center',
              fontWeight: '700',
              textShadowColor: theme.colors.text + '20',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }]}>
              Welcome to{' '}
              <Text style={[styles.headline, {
                color: theme.colors.primary,
                fontWeight: '900',
                textShadowColor: theme.colors.primary + '40',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              }]}>
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
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    minHeight: 100,
  },
  logoMainText: {
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  logoSubText: {
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  logoAccent: {
    alignSelf: 'center',
  },
  headlineContainer: {},
  headline: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
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
