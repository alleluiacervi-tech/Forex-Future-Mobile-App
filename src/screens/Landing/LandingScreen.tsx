import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
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

  // Responsive scale for logo candles
  const candleScale = Math.min(Math.max(width / 380, 0.85), 1.25);

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
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: Math.min(width * 0.06, 24),
            paddingTop: Math.max(height * 0.06, 24),
            paddingBottom: Math.max(height * 0.04, 16),
          },
        ]}
      >
          {/* App Logo */}
          <View style={[styles.logoWrapper, { marginBottom: height * 0.04 }]}>
            <View style={[styles.logoContainer, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              paddingVertical: Math.max(height * 0.022, 14),
              paddingHorizontal: Math.min(width * 0.07, 28),
              borderRadius: 18,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 18,
              elevation: 10,
            }]}>
              {/* Professional Candlestick Logo */}
              <View style={styles.logoSymbol}>
                {/* Clean, professional trading candles */}
                <View style={styles.professionalLogoContainer}>
                  {/* Baseline */}
                  <View style={styles.candleBaseline} />

                  {/* Bullish Candle (Green) */}
                  <View style={[styles.professionalCandle, styles.candle1]}>
                    <View style={[styles.candleWick, styles.upperWick]} />
                    <View style={[styles.candleBody, styles.bullishBody, { transform: [{ scaleY: candleScale }] }]} />
                    <View style={[styles.candleWick, styles.lowerWick]} />
                  </View>

                  {/* Neutral Center Candle (Blue) */}
                  <View style={[styles.professionalCandle, styles.candleCenter]}>
                    <View style={[styles.candleWick, styles.upperWick]} />
                    <View style={[styles.candleBody, styles.neutralBody, { transform: [{ scaleY: candleScale * 1.1 }] }]} />
                    <View style={[styles.candleWick, styles.lowerWick]} />
                  </View>

                  {/* Bearish Candle (Red) */}
                  <View style={[styles.professionalCandle, styles.candle2]}>
                    <View style={[styles.candleWick, styles.upperWick]} />
                    <View style={[styles.candleBody, styles.bearishBody, { transform: [{ scaleY: candleScale * 0.95 }] }]} />
                    <View style={[styles.candleWick, styles.lowerWick]} />
                  </View>
                </View>

                {/* Forex Future Text */}
                <View style={styles.forexText}>
                  <Text style={[styles.forexTitle, {
                    color: theme.colors.primary,
                    fontSize: Math.min(width * 0.11, isSmallScreen ? 32 : 42),
                    fontWeight: '800',
                    letterSpacing: 1.2,
                    textAlign: 'center',
                    textShadowColor: 'transparent',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 0,
                  }]}>
                    FOREX
                  </Text>
                  <Text style={[styles.futureTitle, {
                    color: theme.colors.textSecondary || theme.colors.text,
                    fontSize: Math.min(width * 0.075, isSmallScreen ? 20 : 26),
                    fontWeight: '600',
                    letterSpacing: 0.9,
                    textAlign: 'center',
                    opacity: 0.95,
                  }]}>
                    Future
                  </Text>
                </View>
              </View>

              {/* Professional tagline */}
              <Text style={[styles.logoTagline, {
                color: theme.colors.textSecondary || theme.colors.text,
                fontSize: Math.min(width * 0.04, isSmallScreen ? 12 : 14),
                marginTop: Math.max(height * 0.02, 8),
                opacity: 0.8,
                textAlign: 'center',
                fontWeight: '500',
                letterSpacing: 0.6,
              }]}>
                Advanced Trading Technology
              </Text>
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
          <View style={[styles.featuresContainer, { marginBottom: height * 0.04 }]}>
            <View style={[styles.featureRow, { marginBottom: height * 0.015 }]}>
              <View style={styles.featureIconWrapper}>
                <View style={[styles.featureIconBadge, { backgroundColor: theme.colors.primary }]}>
                  <Icon
                    name="query-stats"
                    size={Math.min(width * 0.045, 22)}
                    color={theme.colors.onPrimary}
                  />
                </View>
              </View>
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Real-time market data and live price updates
              </Text>
            </View>

            <View style={[styles.featureRow, { marginBottom: height * 0.015 }]}>
              <View style={styles.featureIconWrapper}>
                <View style={[styles.featureIconBadge, { backgroundColor: '#0EA5E9' }]}>
                  <Icon
                    name="show-chart"
                    size={Math.min(width * 0.045, 22)}
                    color={theme.colors.onPrimary}
                  />
                </View>
              </View>
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Advanced charting with multiple timeframes
              </Text>
            </View>

            <View style={[styles.featureRow, { marginBottom: height * 0.015 }]}>
              <View style={styles.featureIconWrapper}>
                <View style={[styles.featureIconBadge, { backgroundColor: '#F97316' }]}>
                  <Icon
                    name="notifications-active"
                    size={Math.min(width * 0.045, 22)}
                    color={theme.colors.onPrimary}
                  />
                </View>
              </View>
              <Text style={[styles.featureText, {
                color: theme.colors.text,
                fontSize: Math.min(width * 0.035, isSmallScreen ? 12 : 14),
                lineHeight: Math.min(width * 0.05, isSmallScreen ? 16 : 20),
              }]}>
                Price alerts and market notifications
              </Text>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureIconWrapper}>
                <View style={[styles.featureIconBadge, { backgroundColor: '#22C55E' }]}>
                  <Icon
                    name="pie-chart"
                    size={Math.min(width * 0.045, 22)}
                    color={theme.colors.onPrimary}
                  />
                </View>
              </View>
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
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
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
  logoSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  professionalLogoContainer: {
    width: 88,
    height: 80,
    position: 'relative',
    marginRight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalCandle: {
    position: 'absolute',
    alignItems: 'center',
  },
  candle1: {
    left: 8,
    top: 15,
  },
  candleCenter: {
    left: 37,
    top: 10,
  },
  candle2: {
    right: 8,
    top: 23,
  },
  candleBody: {
    width: 12,
    height: 30,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  bullishBody: {
    backgroundColor: '#10B981', // Professional green
  },
  bearishBody: {
    backgroundColor: '#EF4444', // Professional red
  },
  neutralBody: {
    backgroundColor: '#3B82F6', // Professional blue
  },
  candleWick: {
    width: 1.5,
    backgroundColor: '#94A3B8', // Professional gray
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  upperWick: {
    top: -12,
    height: 12,
  },
  lowerWick: {
    bottom: -12,
    height: 12,
  },
  volumeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 12,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  bullishVolume: {
    backgroundColor: '#10B981',
  },
  bearishVolume: {
    backgroundColor: '#EF4444',
  },
  candleBaseline: {
    position: 'absolute',
    bottom: 18,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
  },
  forexText: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  forexTitle: {
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  futureTitle: {
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  logoTagline: {
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 1,
  },
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
    gap: 10,
  },
  featureIconWrapper: {
    width: 36,
    alignItems: 'center',
  },
  featureIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
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
