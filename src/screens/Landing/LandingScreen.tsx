import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../../types';
import { Button, Text } from '../../components/common';
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

  const handleCreateAccount = () => {
    // Navigate to registration/subscription screen
    navigation.navigate('Subscription');
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
            <View style={styles.globeBadge}>
              <LinearGradient
                colors={['#061821', '#0b3946', '#0cc0d6']}
                start={{ x: 0.2, y: 0.1 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.globeInner}
              >
                <Ionicons name="globe-outline" size={56} color="#E7C77A" />
                <View style={styles.globeHighlight} />
              </LinearGradient>
            </View>

            <View style={styles.wordmarkContainer}>
              <Text style={[styles.forexTitle, {
                color: '#E7C77A',
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
                color: '#00CFEA',
                fontSize: Math.min(width * 0.075, isSmallScreen ? 20 : 26),
                fontWeight: '600',
                letterSpacing: 0.9,
                textAlign: 'center',
                opacity: 0.95,
              }]}>
                FUTURE
              </Text>
            </View>

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

        <View style={styles.actions}>
          <Text style={[styles.actionsTitle, { color: theme.colors.text }]}>
            Continue to your account
          </Text>
          <Text style={[styles.actionsSubtitle, { color: theme.colors.textSecondary }]}>
            Sign in to access AI insights, or create a new account to get started.
          </Text>

          <Button
            title="Sign in"
            onPress={handleSignIn}
            variant="primary"
            size="large"
            style={styles.primaryAction}
          />
          <Button
            title="Create account"
            onPress={handleCreateAccount}
            variant="outline"
            size="large"
            style={styles.secondaryAction}
          />
          <Button
            title="Explore features"
            onPress={handleExploreFeatures}
            variant="secondary"
            size="large"
            style={styles.tertiaryAction}
          />
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  globeBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 4,
    borderWidth: 2,
    borderColor: '#E7C77A',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  globeInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  globeHighlight: {
    position: 'absolute',
    top: 14,
    left: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  wordmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalLogoContainer: {
    width: 88,
    height: 80,
    position: 'relative',
    marginRight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'none',
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
  actions: {
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  actionsSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryAction: {
    width: '100%',
  },
  secondaryAction: {
    width: '100%',
    marginTop: 10,
  },
  tertiaryAction: {
    width: '100%',
    marginTop: 10,
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
  signInLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signInLinkText: {
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    letterSpacing: 1,
    fontWeight: '500',
  },
});
