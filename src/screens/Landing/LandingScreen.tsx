import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, { Path } from 'react-native-svg';
import { RootStackParamList } from '../../types';
import { Text } from '../../components/common';
import { useTheme } from '../../hooks';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// App Icon Component - Green line graph/arrow
const AppIcon = () => {
  const theme = useTheme();
  return (
    <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceLight }]}>
      <Svg width="48" height="48" viewBox="0 0 48 48">
        {/* Upward trending line graph */}
        <Path
          d="M8 36 L12 28 L16 32 L20 24 L24 28 L28 20 L32 26"
          stroke={theme.colors.primary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow pointing up */}
        <Path
          d="M28 20 L32 14 L36 20"
          stroke={theme.colors.primary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M32 14 L32 8"
          stroke={theme.colors.primary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.iconWrapper}>
          <AppIcon />
        </View>

        {/* Headline */}
        <View style={styles.headlineContainer}>
          <Text style={[styles.headline, { color: theme.colors.text }]}>
            Trade with{' '}
            <Text style={[styles.headline, { color: theme.colors.primary }]}>Precision</Text>
          </Text>
        </View>

        {/* Description */}
        <Text style={[styles.description, { color: theme.colors.text }]}>
          Real-time forex notifications, volatility alerts, and market news delivered instantly to your device.
        </Text>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Explore Features Button */}
          <TouchableOpacity
            style={[styles.exploreButton, { backgroundColor: theme.colors.surface }]}
            onPress={handleExploreFeatures}
            activeOpacity={0.7}
          >
            <Text style={[styles.exploreButtonText, { color: theme.colors.text }]}>
              Explore Features
            </Text>
            <Icon name="arrow-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <Text style={[styles.signInButtonText, { color: theme.colors.text }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
          PROFESSIONAL TRADING TERMINAL V2.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  iconWrapper: {
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineContainer: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 44,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 40,
    paddingRight: 8,
  },
  buttonsContainer: {
    gap: 16,
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
