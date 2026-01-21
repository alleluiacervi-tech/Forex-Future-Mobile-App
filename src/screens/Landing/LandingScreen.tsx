import React from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  const handleExploreFeatures = () => {
    // Navigate to about screen
    navigation.navigate('About');
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
            <Image
              source={require('../../../assets/image.png')}
              resizeMode="contain"
              style={[
                styles.logoImage,
                {
                  width: Math.min(width * 0.7, isSmallScreen ? 240 : 280),
                  height: Math.min(width * 0.7, isSmallScreen ? 240 : 280),
                },
              ]}
            />

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
            Discover Forex Future
          </Text>
          <Text style={[styles.actionsSubtitle, { color: theme.colors.textSecondary }]}>
            Explore the core features before creating your account.
          </Text>

          <Button
            title="Explore features"
            onPress={handleExploreFeatures}
            variant="primary"
            size="large"
            style={styles.primaryAction}
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
  logoImage: {
    borderRadius: 32,
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
